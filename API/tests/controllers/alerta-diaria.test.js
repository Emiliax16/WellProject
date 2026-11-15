// alerta-diaria.test.js
//
// La alerta de pozos sin comunicación corría tres veces al día y repetía siempre
// los mismos pozos, incluidos los que llevan semanas caídos por una falla de
// hardware conocida. Ahora el chequeo automático corre una vez al día y solo
// escribe si algún pozo pasó a rojo desde el chequeo anterior. Los que ya
// estaban en rojo aparecen como recordatorio dentro de ese correo, pero no lo
// disparan.
//
// El envío manual (`POST /monitoring/send-alert-email`) conserva el
// comportamiento de siempre: lista todos los pozos en rojo.
//
// Sin base ni red: los modelos, nodemailer y node-cron van mockeados.

const mockWellFindAll = jest.fn();
const mockWellDataFindOne = jest.fn();
const mockSendMail = jest.fn();

jest.mock('../../models', () => ({
  well: { findAll: (...a) => mockWellFindAll(...a) },
  wellData: { findOne: (...a) => mockWellDataFindOne(...a) },
  client: {},
  user: {},
}));
jest.mock('nodemailer', () => ({
  createTransport: () => ({ sendMail: (...a) => mockSendMail(...a) }),
}));

const { runAlertCheck, _internal } = require('../../src/controllers/monitoring.controller');
const { esRojoNuevo, RED_THRESHOLD_MINUTES, ALERT_WINDOW_MINUTES, ALERT_MARGIN_MINUTES } = _internal;

const AHORA = new Date('2026-11-16T11:00:00.000Z'); // 08:00 en Santiago
const haceMinutos = (m) => new Date(AHORA.getTime() - m * 60000);

// Pozos activos y la hora de su último reporte (`null` si nunca reportó).
let pozos;

const configurarPozos = (lista) => {
  pozos = lista;
  mockWellFindAll.mockResolvedValue(
    lista.map((p) => ({ code: p.code, name: p.name, location: 'Región de Valparaíso', editStatusDate: p.activado ?? null }))
  );
  mockWellDataFindOne.mockImplementation(async ({ where }) => {
    const pozo = pozos.find((p) => p.code === where.code);
    return pozo.ultimoReporte ? { createdAt: pozo.ultimoReporte } : null;
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: AHORA, doNotFake: ['nextTick', 'setImmediate'] });
  mockSendMail.mockResolvedValue({});
});

afterEach(() => {
  jest.useRealTimers();
});

describe('esRojoNuevo', () => {
  const limite = RED_THRESHOLD_MINUTES + ALERT_WINDOW_MINUTES + ALERT_MARGIN_MINUTES;
  const conMinutos = (minutesSinceLast) => ({ minutesSinceLast, activatedAt: null });

  it('considera nuevo un pozo que acaba de pasar a rojo', () => {
    expect(esRojoNuevo(conMinutos(RED_THRESHOLD_MINUTES + 1), AHORA)).toBe(true);
  });

  it('considera nuevo un pozo que pasó a rojo justo después del chequeo anterior', () => {
    expect(esRojoNuevo(conMinutos(limite), AHORA)).toBe(true);
  });

  it('considera conocido un pozo que ya estaba en rojo en el chequeo anterior', () => {
    expect(esRojoNuevo(conMinutos(limite + 1), AHORA)).toBe(false);
  });

  it('considera conocido un pozo caído hace semanas', () => {
    expect(esRojoNuevo(conMinutos(45 * 24 * 60), AHORA)).toBe(false);
  });

  it('mide desde la activación a un pozo que nunca reportó', () => {
    const activadoHace = (m) => ({ minutesSinceLast: null, activatedAt: haceMinutos(m).toISOString() });

    expect(esRojoNuevo(activadoHace(7 * 60), AHORA)).toBe(true);
    expect(esRojoNuevo(activadoHace(3 * 24 * 60), AHORA)).toBe(false);
    expect(esRojoNuevo(activadoHace(2 * 60), AHORA)).toBe(false);
  });

  it('considera conocido un pozo sin reportes ni fecha de activación', () => {
    expect(esRojoNuevo({ minutesSinceLast: null, activatedAt: null }, AHORA)).toBe(false);
  });
});

describe('runAlertCheck en el chequeo diario', () => {
  const chequeoDiario = () => runAlertCheck({ soloNuevos: true });

  it('no escribe si los únicos pozos en rojo ya estaban caídos', async () => {
    configurarPozos([
      { code: 'OB-0701-1496', name: 'Fuente de Agua N°1', ultimoReporte: haceMinutos(44 * 24 * 60) },
      { code: 'OB-0601-1611', name: 'Planta Los Lirios', ultimoReporte: haceMinutos(13 * 24 * 60) },
      { code: 'OB-0902-639', name: 'Parque Alviso', ultimoReporte: haceMinutos(20) },
    ]);

    const resultado = await chequeoDiario();

    expect(mockSendMail).not.toHaveBeenCalled();
    expect(resultado).toMatchObject({ sent: false, criticalCount: 2, newCount: 0 });
  });

  it('escribe cuando un pozo pasó a rojo y recuerda los que ya estaban caídos', async () => {
    configurarPozos([
      { code: 'OB-0902-1553', name: 'Pozo 1', ultimoReporte: haceMinutos(10 * 60) },
      { code: 'OB-0701-1496', name: 'Fuente de Agua N°1', ultimoReporte: haceMinutos(44 * 24 * 60) },
      { code: 'OB-0902-639', name: 'Parque Alviso', ultimoReporte: haceMinutos(20) },
    ]);

    const resultado = await chequeoDiario();

    expect(resultado).toMatchObject({ sent: true, criticalCount: 2, newCount: 1 });
    const correo = mockSendMail.mock.calls[0][0];
    expect(correo.subject).toBe('[Promedición] 1 pozo(s) nuevo(s) sin comunicación hace más de 6 horas');

    const [tabla, recordatorio] = correo.html.split('Siguen sin comunicación desde antes');
    expect(tabla).toContain('Pozo 1');
    expect(tabla).not.toContain('Fuente de Agua N°1');
    expect(recordatorio).toContain('Fuente de Agua N°1');
    expect(correo.html).not.toContain('Parque Alviso');
    expect(correo.html).toContain('Este correo se envía una vez al día');
  });

  it('no incluye la sección de recordatorio si no hay pozos caídos desde antes', async () => {
    configurarPozos([{ code: 'OB-0902-1553', name: 'Pozo 1', ultimoReporte: haceMinutos(10 * 60) }]);

    await chequeoDiario();

    expect(mockSendMail.mock.calls[0][0].html).not.toContain('Siguen sin comunicación desde antes');
  });

  it('no escribe si no hay pozos en rojo', async () => {
    configurarPozos([{ code: 'OB-0902-639', name: 'Parque Alviso', ultimoReporte: haceMinutos(20) }]);

    const resultado = await chequeoDiario();

    expect(mockSendMail).not.toHaveBeenCalled();
    expect(resultado).toMatchObject({ sent: false, criticalCount: 0 });
  });

  it('escapa el nombre de los pozos en el correo', async () => {
    configurarPozos([
      { code: 'OB-1', name: '<b>Pozo</b>', ultimoReporte: haceMinutos(10 * 60) },
      { code: 'OB-2', name: '<i>Viejo</i>', ultimoReporte: haceMinutos(44 * 24 * 60) },
    ]);

    await chequeoDiario();

    const { html } = mockSendMail.mock.calls[0][0];
    expect(html).toContain('&lt;b&gt;Pozo&lt;/b&gt;');
    expect(html).toContain('&lt;i&gt;Viejo&lt;/i&gt;');
    expect(html).not.toContain('<b>Pozo</b>');
  });
});

describe('runAlertCheck en el envío manual', () => {
  it('lista todos los pozos en rojo, nuevos y antiguos, como antes', async () => {
    configurarPozos([
      { code: 'OB-0902-1553', name: 'Pozo 1', ultimoReporte: haceMinutos(10 * 60) },
      { code: 'OB-0701-1496', name: 'Fuente de Agua N°1', ultimoReporte: haceMinutos(44 * 24 * 60) },
    ]);

    const resultado = await runAlertCheck();

    expect(resultado).toMatchObject({ sent: true, criticalCount: 2 });
    const correo = mockSendMail.mock.calls[0][0];
    expect(correo.subject).toBe('[Promedición] 2 pozo(s) sin comunicación hace más de 6 horas');
    expect(correo.html).toContain('Pozo 1');
    expect(correo.html).toContain('Fuente de Agua N°1');
    expect(correo.html).not.toContain('Siguen sin comunicación desde antes');
  });

  it('escribe aunque todos los pozos en rojo ya estuvieran caídos', async () => {
    configurarPozos([{ code: 'OB-0701-1496', name: 'Fuente de Agua N°1', ultimoReporte: haceMinutos(44 * 24 * 60) }]);

    await runAlertCheck();

    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });
});

describe('programación del chequeo', () => {
  const cargarScheduler = (schedule) => {
    jest.resetModules();
    if (schedule === undefined) delete process.env.ALERT_CRON_SCHEDULE;
    else process.env.ALERT_CRON_SCHEDULE = schedule;
    const cron = { validate: jest.fn(() => true), schedule: jest.fn() };
    const monitoreo = { runAlertCheck: jest.fn().mockResolvedValue({ sent: false }) };
    jest.doMock('node-cron', () => cron);
    jest.doMock('../../src/controllers/monitoring.controller', () => monitoreo);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    require('../../src/jobs/scheduler').startSchedulers();
    return { cron, monitoreo };
  };

  afterEach(() => {
    delete process.env.ALERT_CRON_SCHEDULE;
    jest.dontMock('node-cron');
    jest.dontMock('../../src/controllers/monitoring.controller');
    console.log.mockRestore?.();
  });

  it('corre una vez al día a las 08:00 si no se configura otra programación', () => {
    const { cron } = cargarScheduler(undefined);

    expect(cron.schedule).toHaveBeenCalledWith('0 8 * * *', expect.any(Function), expect.objectContaining({ timezone: expect.any(String) }));
  });

  it('respeta ALERT_CRON_SCHEDULE cuando está configurada', () => {
    const { cron } = cargarScheduler('0 9 * * *');

    expect(cron.schedule.mock.calls[0][0]).toBe('0 9 * * *');
  });

  it('pide solo los pozos nuevos en el chequeo automático', async () => {
    const { cron, monitoreo } = cargarScheduler(undefined);

    await cron.schedule.mock.calls[0][1]();

    expect(monitoreo.runAlertCheck).toHaveBeenCalledWith({ soloNuevos: true });
  });
});
