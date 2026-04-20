require('dotenv').config();
const nodemailer = require('nodemailer');
const db = require('../../models');

const Well = db.well;
const WellData = db.wellData;
const Client = db.client;
const User = db.user;

const GREEN_THRESHOLD_MINUTES = 60;
const RED_THRESHOLD_MINUTES = 360;

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
      });
    }
  }
  return { red, now };
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

const buildAlertEmailHtml = (redWells, now) => {
  const rows = redWells
    .map(
      (w) => `
        <tr>
          <td style="padding:8px;border:1px solid #ddd;">${w.name}</td>
          <td style="padding:8px;border:1px solid #ddd;">${w.code}</td>
          <td style="padding:8px;border:1px solid #ddd;">${w.location || '-'}</td>
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
      <p>Se detectaron <strong>${redWells.length}</strong> pozo(s) con comunicación crítica al
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
      <p style="margin-top:16px;font-size:12px;color:#555;">
        Este correo se envía automáticamente cada 6 horas sólo si existe al menos un pozo en estado crítico.
      </p>
    </div>`;
};

// Lógica reutilizable por el cron y por el endpoint HTTP
const runAlertCheck = async () => {
  const { red, now } = await computeStatus();

  if (red.length === 0) {
    return { sent: false, criticalCount: 0, message: 'No hay pozos en estado crítico.' };
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });

  const recipient = process.env.ALERT_EMAIL_TO || process.env.EMAIL_USER;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: recipient,
    subject: `[Promedición] ${red.length} pozo(s) sin comunicación hace más de 6 horas`,
    html: buildAlertEmailHtml(red, now),
  });

  return { sent: true, criticalCount: red.length, recipient };
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
  _internal: { parseReportDate, buildStatus, GREEN_THRESHOLD_MINUTES, RED_THRESHOLD_MINUTES },
};
