const cron = require('node-cron');
const { runAlertCheck } = require('../controllers/monitoring.controller');

// Por defecto, un chequeo diario a las 08:00 (hora de CRON_TIMEZONE). Se puede
// sobreescribir con ALERT_CRON_SCHEDULE, pero la alerta solo avisa de los pozos
// que pasaron a rojo en las últimas 24 horas (ALERT_WINDOW_MINUTES en
// monitoring.controller.js): con chequeos más frecuentes, un mismo pozo se
// repetiría en cada uno durante ese día.
const ALERT_CRON_SCHEDULE = process.env.ALERT_CRON_SCHEDULE || '0 8 * * *';
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
        const result = await runAlertCheck({ soloNuevos: true });
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
