require('dotenv').config();
const nodemailer = require('nodemailer');
const db = require('../../models');
const { resumenSinAceptar, DIAS_DE_VENTANA } = require('../services/wellData/pendientesDga.service');
const { leerUltimaCorrida } = require('../jobs/estado-reintento');
const moment = require('moment-timezone');

const escapeHtml = (s) => {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(s ?? '').replace(/[&<>"']/g, (c) => map[c]);
};

const Well = db.well;
const WellData = db.wellData;
const Client = db.client;
const User = db.user;

const GREEN_THRESHOLD_MINUTES = 60;
const RED_THRESHOLD_MINUTES = 360;

// La alerta automática corre una vez al día y solo avisa de los pozos que
// pasaron a rojo desde el chequeo anterior. Un pozo que ya estaba en rojo, por
// ejemplo por una falla de hardware conocida, no genera un correo nuevo cada
// día: aparece al final, como recordatorio, solo cuando hay alguno nuevo.
//
// No guarda estado. Un pozo entra en rojo cuando pasa RED_THRESHOLD_MINUTES sin
// reportar, así que es "nuevo" mientras ese tiempo no supere el umbral más el
// intervalo entre chequeos. Por eso la ventana tiene que coincidir con
// ALERT_CRON_SCHEDULE (por defecto, un chequeo diario).
//
// El margen cubre el desfase de segundos del cron y los días de cambio de
// horario, que duran 23 o 25 horas. A cambio, un pozo puede aparecer como nuevo
// dos días seguidos. El día de 25 horas el margen queda justo, y un desfase de
// segundos del cron podría dejar sin aviso a un pozo que cayó en ese instante.
//
// Una caída que empieza y termina entre dos chequeos no se avisa: el chequeo
// solo ve el estado del momento.
const ALERT_WINDOW_MINUTES = 24 * 60;
const ALERT_MARGIN_MINUTES = 60;

const parseReportDate = (wellDataRow) => {
  if (!wellDataRow) return null;
  if (wellDataRow.createdAt) return new Date(wellDataRow.createdAt);
  const [day, month, year] = (wellDataRow.date || '').split('/');
  const hour = wellDataRow.hour || '00:00:00';
  if (!day || !month || !year) return null;
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour}`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildStatus = (minutesSinceLast) => {
  if (minutesSinceLast === null) return 'red';
  if (minutesSinceLast <= GREEN_THRESHOLD_MINUTES) return 'green';
  if (minutesSinceLast <= RED_THRESHOLD_MINUTES) return 'yellow';
  return 'red';
};

const getWellsStatus = async (req, res) => {
  try {
    const wells = await Well.findAll({
      where: { isActived: true },
      include: [
        {
          model: Client,
          include: [{ model: User, attributes: ['id', 'name', 'email'] }],
        },
      ],
      order: [['name', 'ASC']],
    });

    const now = new Date();
    const summary = { total: wells.length, green: 0, yellow: 0, red: 0 };

    const results = await Promise.all(
      wells.map(async (well) => {
        const lastReport = await WellData.findOne({
          where: { code: well.code },
          order: [
            ['createdAt', 'DESC'],
            ['id', 'DESC'],
          ],
        });

        const lastReportDate = parseReportDate(lastReport);
        const minutesSinceLast = lastReportDate
          ? Math.floor((now.getTime() - lastReportDate.getTime()) / 60000)
          : null;
        const status = buildStatus(minutesSinceLast);
        summary[status] += 1;

        const clientUser = well.client && well.client.user ? well.client.user : null;

        return {
          wellId: well.id,
          code: well.code,
          name: well.name || well.code,
          location: well.location,
          clientId: well.clientId,
          clientName: clientUser ? clientUser.name : null,
          clientEmail: clientUser ? clientUser.email : null,
          lastCommunication: lastReportDate ? lastReportDate.toISOString() : null,
          minutesSinceLast,
          status,
        };
      })
    );

    const statusOrder = { red: 0, yellow: 1, green: 2 };
    results.sort((a, b) => {
      const diff = statusOrder[a.status] - statusOrder[b.status];
      if (diff !== 0) return diff;
      const aMin = a.minutesSinceLast === null ? Infinity : a.minutesSinceLast;
      const bMin = b.minutesSinceLast === null ? Infinity : b.minutesSinceLast;
      return bMin - aMin;
    });

    const redWells = results.filter((w) => w.status === 'red');

    return res.status(200).json({
      summary,
      wells: results,
      alert: {
        hasCriticalWells: redWells.length > 0,
        criticalCount: redWells.length,
        criticalWells: redWells,
      },
      thresholds: {
        greenMaxMinutes: GREEN_THRESHOLD_MINUTES,
        redMinMinutes: RED_THRESHOLD_MINUTES,
      },
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching wells status:', error);
    return res.status(500).json({
      message: 'Error al obtener el estado de los pozos',
    });
  }
};

const computeStatus = async () => {
  const wells = await Well.findAll({
    where: { isActived: true },
    include: [
      {
        model: Client,
        include: [{ model: User, attributes: ['id', 'name', 'email'] }],
      },
    ],
  });
  const now = new Date();
  const red = [];
  for (const well of wells) {
    const lastReport = await WellData.findOne({
      where: { code: well.code },
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
    });
    const lastReportDate = parseReportDate(lastReport);
    const minutesSinceLast = lastReportDate
      ? Math.floor((now.getTime() - lastReportDate.getTime()) / 60000)
      : null;
    const status = buildStatus(minutesSinceLast);
    if (status === 'red') {
      red.push({
        code: well.code,
        name: well.name || well.code,
        location: well.location,
        lastCommunication: lastReportDate ? lastReportDate.toISOString() : null,
        minutesSinceLast,
        activatedAt: well.editStatusDate ? new Date(well.editStatusDate).toISOString() : null,
      });
    }
  }
  return { red, now };
};

// Un pozo en rojo es nuevo si cruzó el umbral dentro de la ventana del último
// chequeo. El tiempo se mide desde lo más reciente entre su último reporte y su
// activación: así, un pozo que se reactiva después de una reparación y sigue
// sin reportar se avisa 6 horas después de reactivarse, en vez de quedar como
// una caída antigua. Si no hay ninguna de las dos fechas, no hay forma de saber
// cuándo pasó a rojo y se trata como conocido para no repetirlo todos los días.
const esRojoNuevo = (pozo, now) => {
  const limite = RED_THRESHOLD_MINUTES + ALERT_WINDOW_MINUTES + ALERT_MARGIN_MINUTES;
  const referencias = [pozo.lastCommunication, pozo.activatedAt]
    .filter(Boolean)
    .map((fecha) => new Date(fecha).getTime())
    .filter((ms) => !Number.isNaN(ms));
  if (referencias.length === 0) {
    return false;
  }
  const minutos = Math.floor((now.getTime() - Math.max(...referencias)) / 60000);
  return minutos > RED_THRESHOLD_MINUTES && minutos <= limite;
};

const formatDateForEmail = (isoString) => {
  if (!isoString) return 'Sin datos registrados';
  const date = new Date(isoString);
  return date.toLocaleString('es-CL', {
    timeZone: 'America/Santiago',
    dateStyle: 'short',
    timeStyle: 'medium',
  });
};

const seccionSinComunicacion = (redWells, now, { conocidos = [], diario = false } = {}) => {
  const rows = redWells
    .map(
      (w) => `
        <tr>
          <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(w.name)}</td>
          <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(w.code)}</td>
          <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(w.location || '-')}</td>
          <td style="padding:8px;border:1px solid #ddd;">${formatDateForEmail(w.lastCommunication)}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right;">${
            w.minutesSinceLast !== null ? `${Math.floor(w.minutesSinceLast / 60)}h ${w.minutesSinceLast % 60}m` : 'Sin datos'
          }</td>
        </tr>`
    )
    .join('');

  return `
      <h2 style="color:#b91c1c;">Alerta - Pozos sin comunicación hace más de 6 horas</h2>
      <p>${diario
        ? `En las últimas 24 horas, <strong>${redWells.length}</strong> pozo(s) pasaron a estado crítico`
        : `<strong>${redWells.length}</strong> pozo(s) están en estado crítico`} (revisión del ${formatDateForEmail(now.toISOString())}).</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px;">
        <thead>
          <tr style="background:#fee2e2;">
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">Pozo</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">Código</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">Ubicación</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">Última comunicación</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:right;">Tiempo sin reportar</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${conocidos.length > 0 ? `
      <p style="margin-top:16px;">Otros pozos que siguen sin comunicación:</p>
      <ul style="font-size:14px;">${conocidos
        .map((w) => `<li>${escapeHtml(w.name)} (${escapeHtml(w.code)}), última comunicación: ${formatDateForEmail(w.lastCommunication)}</li>`)
        .join('')}</ul>` : ''}`;
};

// Pozos que sí reportan, pero con mediciones que la DGA no aceptó (#70). Sin
// esta sección, un pozo cuyos envíos fallan aparecía en verde: los datos
// llegaban al portal y nadie se enteraba de que a la DGA no llegaba nada.
// Qué pasó con el reintento de hoy, para no afirmar que una medición falló en
// él si la corrida no existió, sigue en curso o llegó al máximo de envíos.
const estadoDelReintento = (now) => {
  const corrida = leerUltimaCorrida();
  const inicioDeHoy = moment(now).tz('America/Santiago').startOf('day').toDate();
  if (!corrida || corrida.inicio < inicioDeHoy) {
    return 'No hay registro del reintento de hoy: no corrió o la API se reinició después. Las mediciones de ayer podrían no haberse reintentado todavía.';
  }
  if (corrida.error) {
    return `El reintento de hoy falló antes de terminar: ${escapeHtml(corrida.error)}.`;
  }
  const hechas = corrida.aceptados + corrida.fallidos + corrida.omitidos;
  if (!corrida.terminada) {
    return `El reintento de hoy sigue en curso: lleva ${hechas} de ${corrida.pendientes} mediciones.`;
  }
  const maximo = corrida.alcanzoElMaximo ? ' Llegó al máximo de envíos por corrida, así que el resto queda para mañana.' : '';
  return `El reintento de hoy terminó: ${corrida.aceptados} aceptadas, ${corrida.fallidos} fallidas y ${corrida.omitidos} omitidas de ${corrida.pendientes}.${maximo}`;
};

const seccionSinEntrega = (pozos, now, errorDeConsulta) => {
  if (errorDeConsulta) {
    return `
      <h2 style="color:#b45309;margin-top:24px;">Mediciones que no llegaron a la DGA</h2>
      <p>No se pudo revisar la entrega a la DGA en este chequeo. El detalle está en el log de la API.</p>`;
  }
  const rows = pozos
    .map(
      (p) => `
        <tr>
          <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(p.name || p.code)}</td>
          <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(p.code)}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right;">${p.deAyer}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right;">${p.total}</td>
          <td style="padding:8px;border:1px solid #ddd;">${formatDateForEmail(p.masAntigua.toISOString())}</td>
        </tr>`
    )
    .join('');

  return `
      <h2 style="color:#b45309;margin-top:24px;">Mediciones que no llegaron a la DGA</h2>
      <p>La DGA no aceptó estas mediciones, que a la hora de este correo siguen pendientes. ${estadoDelReintento(now)} El reintento las vuelve a enviar cada día, hasta ${DIAS_DE_VENTANA} días hacia atrás. Una fila con 0 horas de ayer solo tiene pendientes de días anteriores. El motivo de cada rechazo queda en el log de la API, en las líneas <code>[reintento-dga]</code>.</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px;">
        <thead>
          <tr style="background:#fef3c7;">
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">Pozo</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">Código</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:right;">Horas de ayer sin aceptar</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:right;">Total pendiente</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">Medición pendiente más antigua</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="font-size:13px;">Según el documento de transmisión de la DGA (§6.3), si una medición no se logra transmitir dentro del plazo de desfase de la resolución DGA N° 1238/2019, se considera falla de transmisión y el titular debe informarla con un ticket.</p>`;
};

const buildAlertEmailHtml = (redWells, now, { conocidos = [], diario = false, sinEntrega = [], errorDeEntrega = null } = {}) => `
    <div style="font-family:Arial,sans-serif;color:#111;">
      ${redWells.length > 0 ? seccionSinComunicacion(redWells, now, { conocidos, diario }) : ''}
      ${sinEntrega.length > 0 || errorDeEntrega ? seccionSinEntrega(sinEntrega, now, errorDeEntrega) : ''}
      <p style="margin-top:16px;font-size:12px;color:#555;">
        ${diario
          ? 'Este correo se envía una vez al día y solo cuando algún pozo pasó a estado crítico en las últimas 24 horas o alguna medición de ayer no llegó a la DGA.'
          : 'Este correo se envió a pedido y lista todos los pozos en estado crítico.'}
      </p>
    </div>`;

// Lógica reutilizable por el cron y por el endpoint HTTP.
//
// El cron la llama con `soloNuevos: true`: escribe solo si algún pozo pasó a
// rojo desde el chequeo anterior o si alguna medición de ayer no llegó a la DGA.
// El endpoint manual (`POST /monitoring/send-alert-email`, solo admin) la llama
// sin opciones y conserva el comportamiento de siempre: lista todos los pozos
// en rojo, sin revisar la entrega.
const runAlertCheck = async ({ soloNuevos = false } = {}) => {
  const { red, now } = await computeStatus();

  const nuevos = soloNuevos ? red.filter((pozo) => esRojoNuevo(pozo, now)) : red;
  const conocidos = soloNuevos ? red.filter((pozo) => !esRojoNuevo(pozo, now)) : [];

  // Solo el chequeo diario revisa la entrega a la DGA. Avisa si alguna medición
  // de ayer sigue sin aceptarse después del reintento de las 03:00; las más
  // antiguas aparecen como recordatorio, pero no disparan el correo por sí
  // solas, igual que los pozos que ya estaban caídos.
  // Si la consulta falla, la alerta de pozos en rojo sale igual, con un aviso
  // de que no se pudo revisar la entrega.
  let sinEntrega = [];
  let errorDeEntrega = null;
  if (soloNuevos) {
    try {
      sinEntrega = await resumenSinAceptar({ ahora: now });
    } catch (error) {
      errorDeEntrega = error.message;
      console.error('[alerta] no se pudo revisar la entrega a la DGA:', error.message);
    }
  }
  const horasDeAyer = sinEntrega.reduce((suma, pozo) => suma + pozo.deAyer, 0);
  const entrega = { undeliveredWells: sinEntrega.length, undeliveredYesterday: horasDeAyer };

  if (nuevos.length === 0 && horasDeAyer === 0) {
    return {
      sent: false,
      criticalCount: red.length,
      newCount: 0,
      ...(soloNuevos ? entrega : {}),
      message: red.length === 0
        ? 'No hay pozos en estado crítico.'
        : 'Ningún pozo pasó a estado crítico desde el chequeo anterior.',
    };
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });

  const recipient = process.env.ALERT_EMAIL_TO || process.env.EMAIL_USER;

  const conEntregaNueva = sinEntrega.filter((pozo) => pozo.deAyer > 0).length;
  let subject;
  if (!soloNuevos) {
    subject = `[Promedición] ${red.length} pozo(s) sin comunicación hace más de 6 horas`;
  } else if (horasDeAyer === 0) {
    subject = `[Promedición] ${nuevos.length} pozo(s) nuevo(s) sin comunicación hace más de 6 horas`;
  } else if (nuevos.length === 0) {
    subject = `[Promedición] ${conEntregaNueva} pozo(s) con mediciones que no llegaron a la DGA`;
  } else {
    subject = `[Promedición] ${nuevos.length} pozo(s) nuevo(s) sin comunicación y ${conEntregaNueva} con mediciones que no llegaron a la DGA`;
  }

  await transporter.sendMail({
    from: `"Promedición" <${process.env.EMAIL_USER}>`,
    to: recipient,
    subject,
    // Los pozos que ya estaban caídos se dibujan dentro de la sección de pozos
    // en rojo, que solo aparece si hay alguno nuevo, como antes.
    html: buildAlertEmailHtml(nuevos, now, { conocidos, diario: soloNuevos, sinEntrega, errorDeEntrega }),
  });

  return {
    sent: true,
    criticalCount: red.length,
    newCount: nuevos.length,
    ...(soloNuevos ? entrega : {}),
  };
};

const sendAlertEmail = async (req, res) => {
  try {
    const result = await runAlertCheck();
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error sending alert email:', error);
    return res.status(500).json({
      message: 'Error al enviar correo de alerta',
    });
  }
};

module.exports = {
  getWellsStatus,
  sendAlertEmail,
  runAlertCheck,
  _internal: {
    parseReportDate,
    buildStatus,
    esRojoNuevo,
    GREEN_THRESHOLD_MINUTES,
    RED_THRESHOLD_MINUTES,
    ALERT_WINDOW_MINUTES,
    ALERT_MARGIN_MINUTES,
  },
};
