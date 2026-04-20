const cron = require('node-cron');
const { runAlertCheck } = require('../controllers/monitoring.controller');

// Cron schedule por defecto: cada 6 horas en el minuto 0 (00:00, 06:00, 12:00, 18:00).
// Se puede sobreescribir con la env var ALERT_CRON_SCHEDULE (útil para testear, ej: "*/2 * * * *").
const ALERT_CRON_SCHEDULE = process.env.ALERT_CRON_SCHEDULE || '0 */6 * * *';
const TIMEZONE = process.env.CRON_TIMEZONE || 'America/Santiago';

const startSchedulers = () => {
  if (!cron.validate(ALERT_CRON_SCHEDULE)) {
    console.error(`[scheduler] Expresión cron inválida: "${ALERT_CRON_SCHEDULE}". No se inician jobs.`);
    return;
  }

  cron.schedule(
    ALERT_CRON_SCHEDULE,
    async () => {
      const startedAt = new Date().toISOString();
      console.log(`[scheduler] ejecutando monitoreo de pozos a ${startedAt}`);
      try {
        const result = await runAlertCheck();
        console.log('[scheduler] resultado:', result);
      } catch (error) {
        console.error('[scheduler] error al ejecutar monitoreo:', error.message);
      }
    },
    { timezone: TIMEZONE }
  );

  console.log(`[scheduler] monitoreo de pozos programado con "${ALERT_CRON_SCHEDULE}" (${TIMEZONE})`);
};

module.exports = { startSchedulers };
