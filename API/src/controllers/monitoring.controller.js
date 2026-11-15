require('dotenv').config();
const nodemailer = require('nodemailer');
const db = require('../../models');

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
// horario, que duran 23 o 25 horas: con él nunca se pierde un aviso, y a lo
// sumo un pozo aparece como nuevo dos días seguidos.
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
      error: error.message,
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
// chequeo. Si nunca reportó, se mide desde que se activó; si tampoco hay fecha
// de activación, no hay forma de saber cuándo pasó a rojo y se trata como
// conocido para no repetirlo todos los días.
const esRojoNuevo = (pozo, now) => {
  const limite = RED_THRESHOLD_MINUTES + ALERT_WINDOW_MINUTES + ALERT_MARGIN_MINUTES;
  if (pozo.minutesSinceLast !== null && pozo.minutesSinceLast !== undefined) {
    return pozo.minutesSinceLast <= limite;
  }
  if (!pozo.activatedAt) {
    return false;
  }
  const minutosDesdeActivacion = Math.floor((now.getTime() - new Date(pozo.activatedAt).getTime()) / 60000);
  return minutosDesdeActivacion > RED_THRESHOLD_MINUTES && minutosDesdeActivacion <= limite;
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

const buildAlertEmailHtml = (redWells, now, { conocidos = [], diario = false } = {}) => {
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
    <div style="font-family:Arial,sans-serif;color:#111;">
      <h2 style="color:#b91c1c;">Alerta - Pozos sin comunicación hace más de 6 horas</h2>
      <p>${diario ? 'Desde el chequeo anterior, ' : ''}<strong>${redWells.length}</strong> pozo(s) ${diario ? 'pasaron a' : 'están en'} estado crítico al
      ${formatDateForEmail(now.toISOString())}.</p>
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
      <p style="margin-top:16px;">Siguen sin comunicación desde antes (ya avisados):</p>
      <ul style="font-size:14px;">${conocidos
        .map((w) => `<li>${escapeHtml(w.name)} (${escapeHtml(w.code)}), última comunicación: ${formatDateForEmail(w.lastCommunication)}</li>`)
        .join('')}</ul>` : ''}
      <p style="margin-top:16px;font-size:12px;color:#555;">
        ${diario
          ? 'Este correo se envía una vez al día y solo cuando algún pozo pasó a estado crítico desde el chequeo anterior.'
          : 'Este correo se envió a pedido y lista todos los pozos en estado crítico.'}
      </p>
    </div>`;
};

// Lógica reutilizable por el cron y por el endpoint HTTP.
//
// El cron la llama con `soloNuevos: true`: escribe solo si algún pozo pasó a
// rojo desde el chequeo anterior. El endpoint manual (`POST
// /monitoring/send-alert-email`, solo admin) la llama sin opciones y conserva
// el comportamiento de siempre: lista todos los pozos en rojo.
const runAlertCheck = async ({ soloNuevos = false } = {}) => {
  const { red, now } = await computeStatus();

  if (red.length === 0) {
    return { sent: false, criticalCount: 0, message: 'No hay pozos en estado crítico.' };
  }

  const nuevos = soloNuevos ? red.filter((pozo) => esRojoNuevo(pozo, now)) : red;
  const conocidos = soloNuevos ? red.filter((pozo) => !esRojoNuevo(pozo, now)) : [];

  if (nuevos.length === 0) {
    return {
      sent: false,
      criticalCount: red.length,
      newCount: 0,
      message: 'Ningún pozo pasó a estado crítico desde el chequeo anterior.',
    };
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });

  const recipient = process.env.ALERT_EMAIL_TO || process.env.EMAIL_USER;

  await transporter.sendMail({
    from: `"Promedición" <${process.env.EMAIL_USER}>`,
    to: recipient,
    subject: soloNuevos
      ? `[Promedición] ${nuevos.length} pozo(s) nuevo(s) sin comunicación hace más de 6 horas`
      : `[Promedición] ${red.length} pozo(s) sin comunicación hace más de 6 horas`,
    html: buildAlertEmailHtml(nuevos, now, { conocidos, diario: soloNuevos }),
  });

  return { sent: true, criticalCount: red.length, newCount: nuevos.length };
};

const sendAlertEmail = async (req, res) => {
  try {
    const result = await runAlertCheck();
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error sending alert email:', error);
    return res.status(500).json({
      message: 'Error al enviar correo de alerta',
      error: error.message,
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
