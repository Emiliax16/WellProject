const cron = require('node-cron');
const { runAlertCheck } = require('../controllers/monitoring.controller');
const { reintentarPendientes } = require('./dga-retry');

// Por defecto, un chequeo diario a las 08:00 (hora de CRON_TIMEZONE). Se puede
// sobreescribir con ALERT_CRON_SCHEDULE, pero la alerta solo avisa de los pozos
// que pasaron a rojo en las últimas 24 horas (ALERT_WINDOW_MINUTES en
// monitoring.controller.js): con chequeos más frecuentes, un mismo pozo se
// repetiría en cada uno durante ese día.
const ALERT_CRON_SCHEDULE = process.env.ALERT_CRON_SCHEDULE || '0 8 * * *';

// El reintento a la DGA corre una vez al día, como pide su documento de
// transmisión (§6.2), a las 03:00: de madrugada y lejos de la alerta de las
// 08:00. Es la hora que tenía el SENDER (06:00 UTC).
const DGA_RETRY_CRON_SCHEDULE = process.env.DGA_RETRY_CRON_SCHEDULE || '0 3 * * *';

const TIMEZONE = process.env.CRON_TIMEZONE || 'America/Santiago';

// El campo de hora de una expresión cron es el segundo. Si tiene más de un
// valor (lista, rango, paso o `*`), el chequeo corre más de una vez al día.
const correMasDeUnaVezAlDia = (expresion) => {
  const hora = String(expresion).trim().split(/\s+/)[1] ?? '';
  return /[,*/-]/.test(hora);
};

// Sin `recoverMissedExecutions`, node-cron se salta la ejecución si su tick de
// un segundo se atrasa justo a esa hora. Ninguno de los dos jobs guarda estado,
// así que la ejecución de ese día se perdería en vez de atrasarse.
const OPCIONES = { timezone: TIMEZONE, recoverMissedExecutions: true };

// Con `recoverMissedExecutions`, node-cron 3.0.3 dispara cada tarea dos veces,
// con un segundo de diferencia: en cada tick revisa también el segundo anterior,
// y su registro de la última ejecución no guarda los milisegundos, así que ese
// segundo le parece pendiente. Sin este guard, la alerta podía mandar dos
// correos y el reintento podía transmitir dos veces seguidas una medición que
// la DGA rechaza rápido. Ninguna programación válida corre dos veces en el
// mismo minuto, así que basta con ignorar la segunda llamada de ese minuto.
const unaVezPorMinuto = (tarea) => {
  let ultimoMinuto = null;
  return async () => {
    const minuto = Math.floor(Date.now() / 60000);
    if (minuto === ultimoMinuto) {
      return;
    }
    ultimoMinuto = minuto;
    await tarea();
  };
};

const programarAlerta = () => {
  if (!cron.validate(ALERT_CRON_SCHEDULE)) {
    console.error(`[scheduler] Expresión cron inválida en ALERT_CRON_SCHEDULE: "${ALERT_CRON_SCHEDULE}". No se programa el monitoreo de pozos.`);
    return;
  }

  if (correMasDeUnaVezAlDia(ALERT_CRON_SCHEDULE)) {
    console.warn(
      `[scheduler] ALERT_CRON_SCHEDULE="${ALERT_CRON_SCHEDULE}" corre más de una vez al día, pero la alerta avisa de los pozos que pasaron a rojo en las últimas 24 horas: cada pozo se repetiría en varios correos. Usar una sola hora, por ejemplo "0 8 * * *".`
    );
  }

  cron.schedule(
    ALERT_CRON_SCHEDULE,
    unaVezPorMinuto(async () => {
      const startedAt = new Date().toISOString();
      console.log(`[scheduler] ejecutando monitoreo de pozos a ${startedAt}`);
      try {
        const result = await runAlertCheck({ soloNuevos: true });
        console.log('[scheduler] resultado:', result);
      } catch (error) {
        console.error('[scheduler] error al ejecutar monitoreo:', error.message);
      }
    }),
    OPCIONES
  );

  console.log(`[scheduler] monitoreo de pozos programado con "${ALERT_CRON_SCHEDULE}" (${TIMEZONE})`);
};

const programarReintento = () => {
  if (!cron.validate(DGA_RETRY_CRON_SCHEDULE)) {
    console.error(`[scheduler] Expresión cron inválida en DGA_RETRY_CRON_SCHEDULE: "${DGA_RETRY_CRON_SCHEDULE}". No se programa el reintento a la DGA.`);
    return;
  }

  // Más de una corrida al día no rompe nada, porque cada una vuelve a buscar lo
  // pendiente, pero reenviaría cada medición fallida varias veces al día, y la
  // DGA pide una vez al día.
  if (correMasDeUnaVezAlDia(DGA_RETRY_CRON_SCHEDULE)) {
    console.warn(
      `[scheduler] DGA_RETRY_CRON_SCHEDULE="${DGA_RETRY_CRON_SCHEDULE}" corre más de una vez al día, pero la DGA pide reenviar cada medición fallida una vez al día. Usar una sola hora, por ejemplo "0 3 * * *".`
    );
  }

  cron.schedule(
    DGA_RETRY_CRON_SCHEDULE,
    unaVezPorMinuto(async () => {
      console.log(`[scheduler] ejecutando reintento a la DGA a ${new Date().toISOString()}`);
      try {
        await reintentarPendientes();
      } catch (error) {
        console.error('[scheduler] error al ejecutar el reintento a la DGA:', error.message);
      }
    }),
    OPCIONES
  );

  console.log(`[scheduler] reintento a la DGA programado con "${DGA_RETRY_CRON_SCHEDULE}" (${TIMEZONE})`);
};

const startSchedulers = () => {
  programarAlerta();
  programarReintento();
};

module.exports = { startSchedulers, _internal: { correMasDeUnaVezAlDia, unaVezPorMinuto } };
