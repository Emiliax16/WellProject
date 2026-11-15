// health.test.js
//
// `GET /health` es lo que consultan el healthcheck de docker-compose y, si se
// configura, un monitor externo. Responde 200 si la API está viva y la base
// responde, y 503 si no. Es pública, así que no puede devolver detalles
// internos. Sin base de datos: `sequelize.authenticate` va mockeado.

const mockAuthenticate = jest.fn();

jest.mock('../../models', () => ({
  sequelize: { authenticate: (...a) => mockAuthenticate(...a) },
}));

const router = require('../../src/routes/health.route');

const capa = router.stack.find((l) => l.route && l.route.path === '/health' && l.route.methods.get);
const handler = capa.route.stack[capa.route.stack.length - 1].handle;

const consultar = async () => {
  const res = {
    statusCode: 200,
    cuerpo: undefined,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.cuerpo = b; return this; },
  };
  await handler({ headers: {} }, res, jest.fn());
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('GET /health', () => {
  it('responde 200 cuando la base responde', async () => {
    mockAuthenticate.mockResolvedValue();

    const res = await consultar();

    expect(res.statusCode).toBe(200);
    expect(res.cuerpo).toEqual({ status: 'ok' });
  });

  it('responde 503 cuando la base rechaza la conexión, sin exponer el error', async () => {
    mockAuthenticate.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:5432'));

    const res = await consultar();

    expect(res.statusCode).toBe(503);
    expect(res.cuerpo).toEqual({ status: 'error' });
    expect(JSON.stringify(res.cuerpo)).not.toContain('ECONNREFUSED');
  });

  it('responde 503 si la base tarda más de 3 segundos', async () => {
    jest.useFakeTimers();
    mockAuthenticate.mockReturnValue(new Promise(() => {}));

    const pendiente = consultar();
    jest.advanceTimersByTime(3000);
    const res = await pendiente;

    expect(res.statusCode).toBe(503);
  });

  it('no exige autenticación', () => {
    expect(capa.route.stack).toHaveLength(1);
  });

  it('queda registrada antes del logger de peticiones', () => {
    // Si quedara después, el healthcheck de Docker escribiría una línea en el
    // log cada minuto.
    const fuente = require('fs').readFileSync(require.resolve('../../src/app.js'), 'utf8');

    expect(fuente.indexOf('app.use(healthRoute)')).toBeGreaterThan(-1);
    expect(fuente.indexOf('app.use(healthRoute)')).toBeLessThan(fuente.indexOf('app.use(requestLogger)'));
  });
});
