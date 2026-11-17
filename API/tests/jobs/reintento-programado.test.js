// reintento-programado.test.js
//
// El reintento a la DGA corre una vez al día, a las 03:00 de Santiago, como
// pide el documento de transmisión de la DGA (§6.2). Va junto a la alerta de
// las 08:00 en el mismo scheduler, y cada job se programa por separado: una
// expresión inválida en uno no apaga el otro.
//
// Sin base ni red: node-cron, la alerta y el job van mockeados.

const cargarScheduler = ({ alerta, reintento } = {}) => {
  jest.resetModules();
  if (alerta === undefined) delete process.env.ALERT_CRON_SCHEDULE;
  else process.env.ALERT_CRON_SCHEDULE = alerta;
  if (reintento === undefined) delete process.env.DGA_RETRY_CRON_SCHEDULE;
  else process.env.DGA_RETRY_CRON_SCHEDULE = reintento;

  const cron = { validate: jest.fn((expresion) => expresion !== 'no es cron'), schedule: jest.fn() };
  const job = { reintentarPendientes: jest.fn().mockResolvedValue({ pendientes: 0 }) };
  const monitoreo = { runAlertCheck: jest.fn().mockResolvedValue({ sent: false }) };
  jest.doMock('node-cron', () => cron);
  jest.doMock('../../src/controllers/monitoring.controller', () => monitoreo);
  jest.doMock('../../src/jobs/dga-retry', () => job);
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});

  require('../../src/jobs/scheduler').startSchedulers();

  const programacion = (expresion) => cron.schedule.mock.calls.find(([e]) => e === expresion);
  return { cron, job, monitoreo, log, warn, error, programacion };
};

afterEach(() => {
  jest.useRealTimers();
  delete process.env.ALERT_CRON_SCHEDULE;
  delete process.env.DGA_RETRY_CRON_SCHEDULE;
  jest.dontMock('node-cron');
  jest.dontMock('../../src/controllers/monitoring.controller');
  jest.dontMock('../../src/jobs/dga-retry');
  jest.restoreAllMocks();
});

describe('programación del reintento a la DGA', () => {
  test('correr una vez al día a las 03:00 de Santiago si no se configura otra hora', () => {
    const { programacion, log } = cargarScheduler();

    expect(programacion('0 3 * * *')[2]).toEqual({ timezone: 'America/Santiago', recoverMissedExecutions: true });
    expect(log).toHaveBeenCalledWith('[scheduler] reintento a la DGA programado con "0 3 * * *" (America/Santiago)');
  });

  test('respetar DGA_RETRY_CRON_SCHEDULE cuando está configurada', () => {
    const { programacion } = cargarScheduler({ reintento: '30 4 * * *' });

    expect(programacion('30 4 * * *')).toBeDefined();
    expect(programacion('0 3 * * *')).toBeUndefined();
  });

  test('avisar en el log si el reintento corre más de una vez al día', () => {
    const { warn } = cargarScheduler({ reintento: '0 */6 * * *' });

    expect(warn).toHaveBeenCalledWith(
      '[scheduler] DGA_RETRY_CRON_SCHEDULE="0 */6 * * *" corre más de una vez al día, pero la DGA pide reenviar cada medición fallida una vez al día. Usar una sola hora, por ejemplo "0 3 * * *".'
    );
  });

  test('ejecutar el reintento de los pendientes al llegar la hora', async () => {
    const { programacion, job } = cargarScheduler();

    await programacion('0 3 * * *')[1]();

    expect(job.reintentarPendientes).toHaveBeenCalledTimes(1);
  });

  test('registrar el error sin botar el proceso si el reintento falla', async () => {
    const { programacion, job, error } = cargarScheduler();
    job.reintentarPendientes.mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:5432'));

    await programacion('0 3 * * *')[1]();

    expect(error).toHaveBeenCalledWith(
      '[scheduler] error al ejecutar el reintento a la DGA:',
      'connect ECONNREFUSED 127.0.0.1:5432'
    );
  });

  test('programar el reintento aunque la expresión de la alerta sea inválida', () => {
    const { programacion, error } = cargarScheduler({ alerta: 'no es cron' });

    expect(programacion('0 3 * * *')).toBeDefined();
    expect(error).toHaveBeenCalledWith(
      '[scheduler] Expresión cron inválida en ALERT_CRON_SCHEDULE: "no es cron". No se programa el monitoreo de pozos.'
    );
  });

  test('programar la alerta aunque la expresión del reintento sea inválida', () => {
    const { programacion, error } = cargarScheduler({ reintento: 'no es cron' });

    expect(programacion('0 8 * * *')).toBeDefined();
    expect(error).toHaveBeenCalledWith(
      '[scheduler] Expresión cron inválida en DGA_RETRY_CRON_SCHEDULE: "no es cron". No se programa el reintento a la DGA.'
    );
  });
});

// node-cron 3.0.3 con `recoverMissedExecutions` dispara cada tarea dos veces,
// con un segundo de diferencia.
describe('doble disparo de node-cron', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-11-17T06:00:00.000Z'), doNotFake: ['nextTick', 'setImmediate'] });
  });

  test('ejecutar el reintento una sola vez si node-cron lo dispara dos veces en el mismo minuto', async () => {
    const { programacion, job } = cargarScheduler();
    const disparar = programacion('0 3 * * *')[1];

    await disparar();
    jest.setSystemTime(new Date('2026-11-17T06:00:01.000Z'));
    await disparar();

    expect(job.reintentarPendientes).toHaveBeenCalledTimes(1);
  });

  test('ejecutar la alerta una sola vez si node-cron la dispara dos veces en el mismo minuto', async () => {
    const { programacion, monitoreo } = cargarScheduler();
    const disparar = programacion('0 8 * * *')[1];

    await disparar();
    jest.setSystemTime(new Date('2026-11-17T06:00:01.000Z'));
    await disparar();

    expect(monitoreo.runAlertCheck).toHaveBeenCalledTimes(1);
  });

  test('volver a ejecutar el reintento en su siguiente programación', async () => {
    const { programacion, job } = cargarScheduler();
    const disparar = programacion('0 3 * * *')[1];

    await disparar();
    jest.setSystemTime(new Date('2026-11-18T06:00:00.000Z'));
    await disparar();

    expect(job.reintentarPendientes).toHaveBeenCalledTimes(2);
  });
});
