// higiene.test.js
//
// Issues #72 y #89: restos de depuración que ensuciaban el log en cada petición,
// respuestas que exponían el mensaje interno de un error, rutas inexistentes que
// respondían el HTML de Express, y `POST /well` respondiendo 500 cuando
// `clientId` no es un entero. Sin base de datos: los modelos van mockeados.

process.env.JWT_SECRET = 'secreto-solo-para-tests';

const mockClientFindByPk = jest.fn();
const mockWellFindAll = jest.fn();

jest.mock('../../models', () => ({
  client: { findByPk: (...a) => mockClientFindByPk(...a) },
  well: { findAll: (...a) => mockWellFindAll(...a), create: jest.fn() },
  wellData: {}, company: {}, distributor: {}, user: {}, person: {}, role: {},
  sequelize: { authenticate: jest.fn() },
}));
jest.mock('../../src/services/activityLog.service', () => ({ createActivityLog: jest.fn() }));

const jwt = require('jsonwebtoken');

const hacerRes = () => ({
  statusCode: 200,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.cuerpo = b; return this; },
  send(b) { this.cuerpo = b; return this; },
});

let espias;
beforeEach(() => {
  jest.clearAllMocks();
  espias = ['log', 'warn', 'error'].map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
});
afterEach(() => espias.forEach((e) => e.mockRestore()));

describe('POST /well con un clientId inválido (#89)', () => {
  const { createWell } = require('../../src/controllers/well.controller');
  const crear = async (clientId) => {
    const next = jest.fn();
    await createWell({ user: { id: 1, type: 'admin' }, body: { clientId, code: 'OB-1', name: 'Pozo', location: 'X' } }, hacerRes(), next);
    return next.mock.calls[0]?.[0];
  };

  it.each([
    ['un array', []],
    ['un objeto', { id: 3 }],
    ['un booleano', true],
    ['texto con letras', '12abc'],
    ['texto vacío', ''],
    ['un decimal', 1.5],
    ['ausente', undefined],
    ['hexadecimal', '0x10'],
    ['notación científica', '1e3'],
    ['negativo', -1],
    ['cero', 0],
    ['mayor que el máximo seguro', 2 ** 53],
  ])('responde 400 sin consultar la base si clientId es %s', async (_caso, clientId) => {
    const error = await crear(clientId);

    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('El cliente indicado no es válido.');
    expect(mockClientFindByPk).not.toHaveBeenCalled();
  });

  it.each([[3], ['3'], [' 3 ']])('busca el cliente si clientId es un entero (%p)', async (clientId) => {
    mockClientFindByPk.mockResolvedValue(null);

    const error = await crear(clientId);

    expect(mockClientFindByPk).toHaveBeenCalledWith(3);
    expect(error.message).toBe('El cliente no existe');
  });
});

describe('logs de depuración (#72)', () => {
  it('no imprime nada al validar un token correcto', () => {
    const { decodeToken } = require('../../src/utils/auth.util');

    expect(decodeToken(jwt.sign({ id: 1 }, process.env.JWT_SECRET))).toMatchObject({ id: 1 });
    expect(console.log).not.toHaveBeenCalled();
  });

  it('registra un token inválido en una línea con su motivo, sin el stack', () => {
    const { decodeToken } = require('../../src/utils/auth.util');

    expect(decodeToken('no-es-un-token')).toBeNull();
    expect(console.warn).toHaveBeenCalledWith('[auth] token rechazado: JsonWebTokenError: jwt malformed');
    expect(console.error).not.toHaveBeenCalled();
  });

  it('no imprime los roles al cargar las rutas de usuario', () => {
    jest.isolateModules(() => require('../../src/routes/user.route'));

    expect(console.log).not.toHaveBeenCalledWith('admin', 'company');
  });
});

describe('errores internos sin detalle en la respuesta (#72)', () => {
  it('el estado de los pozos no devuelve el mensaje del error', async () => {
    const { getWellsStatus } = require('../../src/controllers/monitoring.controller');
    mockWellFindAll.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:5432'));
    const res = hacerRes();

    await getWellsStatus({}, res);

    expect(res.statusCode).toBe(500);
    expect(res.cuerpo).toEqual({ message: 'Error al obtener el estado de los pozos' });
  });

  it('el envío manual de la alerta no devuelve el mensaje del error', async () => {
    const { sendAlertEmail } = require('../../src/controllers/monitoring.controller');
    mockWellFindAll.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:5432'));
    const res = hacerRes();

    await sendAlertEmail({}, res);

    expect(res.statusCode).toBe(500);
    expect(res.cuerpo).toEqual({ message: 'Error al enviar correo de alerta' });
  });
});

describe('estadísticas globales sin detalle del error (#72)', () => {
  it('no devuelve el mensaje del error', async () => {
    jest.resetModules();
    jest.doMock('../../models', () => ({
      user: { count: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:5432')) },
      client: { count: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED')) },
      company: { count: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED')) },
      well: { count: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED')) },
      wellData: {}, distributor: {}, person: {}, role: {},
    }));
    const { getGlobalStats } = require('../../src/controllers/stats.controller');
    const res = hacerRes();

    await getGlobalStats({}, res);

    expect(res.statusCode).toBe(500);
    expect(res.cuerpo).toEqual({ message: 'Error al obtener estadísticas globales' });
    jest.dontMock('../../models');
  });
});

describe('rutas inexistentes (#72)', () => {
  it('responden 404 en JSON y no el HTML de Express', async () => {
    const app = require('../../src/app');
    const servidor = app.listen(0);
    try {
      const { port } = servidor.address();
      const respuesta = await fetch(`http://127.0.0.1:${port}/ruta-que-no-existe`);
      const texto = await respuesta.text();

      expect(respuesta.status).toBe(404);
      expect(respuesta.headers.get('content-type')).toMatch(/application\/json/);
      expect(JSON.parse(texto)).toEqual({ error: 'Ruta no encontrada.' });
    } finally {
      await new Promise((cerrar) => servidor.close(cerrar));
    }
  });
});

describe('body que no es JSON válido', () => {
  it('responde 400 y no 500', async () => {
    const app = require('../../src/app');
    const servidor = app.listen(0);
    try {
      const { port } = servidor.address();
      const respuesta = await fetch(`http://127.0.0.1:${port}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"email": "a@b.cl", ',
      });

      expect(respuesta.status).toBe(400);
      expect(await respuesta.json()).toEqual({ error: 'El cuerpo de la petición no es JSON válido.' });
    } finally {
      await new Promise((cerrar) => servidor.close(cerrar));
    }
  });
});
