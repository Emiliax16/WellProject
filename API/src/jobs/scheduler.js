const cron = require('node-cron');
const { runAlertCheck } = require('../controllers/monitoring.controller');

// Por defecto, un chequeo diario a las 08:00 (hora de CRON_TIMEZONE). Se puede
// sobreescribir con ALERT_CRON_SCHEDULE, pero la alerta solo avisa de los pozos
// que pasaron a rojo en las últimas 24 horas (ALERT_WINDOW_MINUTES en
// monitoring.controller.js): con chequeos más frecuentes, un mismo pozo se
// repetiría en cada uno durante ese día.
const ALERT_CRON_SCHEDULE = process.env.ALERT_CRON_SCHEDULE || '0 8 * * *';
const TIMEZONE = process.env.CRON_TIMEZONE || 'America/Santiago';

// El campo de hora de una expresión cron es el segundo. Si tiene más de un
// valor (lista, rango, paso o `*`), el chequeo corre más de una vez al día.
const correMasDeUnaVezAlDia = (expresion) => {
  const hora = String(expresion).trim().split(/\s+/)[1] ?? '';
  return /[,*/-]/.test(hora);
};

const startSchedulers = () => {
  if (!cron.validate(ALERT_CRON_SCHEDULE)) {
    console.error(`[scheduler] Expresión cron inválida: "${ALERT_CRON_SCHEDULE}". No se inician jobs.`);
    return;
  }

  if (correMasDeUnaVezAlDia(ALERT_CRON_SCHEDULE)) {
    console.warn(
      `[scheduler] ALERT_CRON_SCHEDULE="${ALERT_CRON_SCHEDULE}" corre más de una vez al día, pero la alerta avisa de los pozos que pasaron a rojo en las últimas 24 horas: cada pozo se repetiría en varios correos. Usar una sola hora, por ejemplo "0 8 * * *".`
    );
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
    // Sin esto, node-cron se salta la ejecución si su tick de un segundo se
    // atrasa justo a las 08:00:00, y como la alerta no guarda estado, los avisos
    // de ese día se perderían en vez de atrasarse.
    { timezone: TIMEZONE, recoverMissedExecutions: true }
  );

  console.log(`[scheduler] monitoreo de pozos programado con "${ALERT_CRON_SCHEDULE}" (${TIMEZONE})`);
};

module.exports = { startSchedulers, _internal: { correMasDeUnaVezAlDia } };
