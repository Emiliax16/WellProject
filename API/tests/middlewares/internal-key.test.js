// internal-key.test.js
//
// `/fetchUnsentReports` y `/repostToDGA` las consume el SENDER, que no tiene
// usuario, así que no pueden exigir JWT. Eran anónimas: cualquiera podía leer
// todos los reportes pendientes o forzar reenvíos a la DGA (issue #62). Ahora
// exigen una clave compartida en el header `X-Internal-Api-Key`.
//
// Este archivo prueba el middleware y su conexión con las rutas reales, además
// del cierre de `GET /well`, que entregaba anónimamente el código de todos los
// pozos. Sin base de datos: los modelos van mockeados.

const CLAVE = 'a'.repeat(16) + 'clave-interna-de-prueba-0123456789';

// El middleware de sesión revalida al usuario en la base: cada rol tiene un id
// fijo y el usuario mockeado devuelve ese mismo rol.
jest.mock('../../models', () => {
  const rolPorId = { 1: 'admin', 2: 'company', 3: 'distributor', 4: 'normal' };
  return {
    company: {}, distributor: {}, client: {}, well: {}, wellData: {}, person: {},
    user: {
      findByPk: async (id) => ({ id, isActived: true, getRole: async () => ({ type: rolPorId[id] }) }),
    },
  };
});
jest.mock('../../src/services/activityLog.service', () => ({
  createActivityLog: jest.fn(),
}));

const pedido = (headers = {}) => {
  const minusculas = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
  );
  return { headers: minusculas, body: {}, get: (nombre) => minusculas[nombre.toLowerCase()] };
};

const pasarPor = (middleware, req) => {
  const next = jest.fn();
  middleware(req, {}, next);
  return next.mock.calls[0][0];
};

const esperarRechazo = (error) => {
  expect(error).toBeDefined();
  expect(error.statusCode).toBe(401);
  expect(error.message).toBe('Clave interna inválida.');
};

let silenciarError;
let middleware;

beforeEach(() => {
  jest.resetModules();
  process.env.INTERNAL_API_KEY = CLAVE;
  silenciarError = jest.spyOn(console, 'error').mockImplementation(() => {});
  middleware = require('../../src/middlewares/internal-key.middleware');
});

afterEach(() => {
  silenciarError.mockRestore();
  delete process.env.INTERNAL_API_KEY;
});

describe('internalKeyMiddleware', () => {
  it('deja pasar la llamada con la clave correcta', () => {
    expect(pasarPor(middleware, pedido({ 'X-Internal-Api-Key': CLAVE }))).toBeUndefined();
  });

  it('reconoce el header cuando Node entrega su nombre en minúsculas', () => {
    expect(pasarPor(middleware, pedido({ 'x-internal-api-key': CLAVE }))).toBeUndefined();
  });

  it('rechaza la llamada sin header', () => {
    esperarRechazo(pasarPor(middleware, pedido()));
  });

  it('rechaza una clave incorrecta del mismo largo', () => {
    const otra = CLAVE.slice(0, -1) + (CLAVE.endsWith('9') ? '8' : '9');

    esperarRechazo(pasarPor(middleware, pedido({ 'X-Internal-Api-Key': otra })));
  });

  it('rechaza un prefijo de la clave correcta', () => {
    esperarRechazo(pasarPor(middleware, pedido({ 'X-Internal-Api-Key': CLAVE.slice(0, 10) })));
  });

  it('rechaza la clave correcta con texto adicional', () => {
    esperarRechazo(pasarPor(middleware, pedido({ 'X-Internal-Api-Key': `${CLAVE}x` })));
  });

  it('rechaza un header vacío', () => {
    esperarRechazo(pasarPor(middleware, pedido({ 'X-Internal-Api-Key': '' })));
  });

  describe('cuando el servidor no tiene una clave válida configurada', () => {
    it('rechaza todo si INTERNAL_API_KEY no está definida', () => {
      delete process.env.INTERNAL_API_KEY;

      esperarRechazo(pasarPor(middleware, pedido({ 'X-Internal-Api-Key': 'cualquier-cosa' })));
    });

    it('rechaza todo si INTERNAL_API_KEY es vacía, aunque el header también lo sea', () => {
      process.env.INTERNAL_API_KEY = '';

      esperarRechazo(pasarPor(middleware, pedido({ 'X-Internal-Api-Key': '' })));
    });

    it('rechaza todo si INTERNAL_API_KEY tiene menos de 32 caracteres', () => {
      process.env.INTERNAL_API_KEY = 'corta';

      esperarRechazo(pasarPor(middleware, pedido({ 'X-Internal-Api-Key': 'corta' })));
    });

    it('avisa al arrancar el servidor, antes de cualquier llamada', () => {
      delete process.env.INTERNAL_API_KEY;

      middleware.avisarSiFaltaClave();

      expect(silenciarError).toHaveBeenCalledTimes(1);
    });

    it('no avisa al arrancar si la clave es válida', () => {
      middleware.avisarSiFaltaClave();

      expect(silenciarError).not.toHaveBeenCalled();
    });

    it('avisa en el log una sola vez', () => {
      delete process.env.INTERNAL_API_KEY;

      pasarPor(middleware, pedido());
      pasarPor(middleware, pedido());

      expect(silenciarError).toHaveBeenCalledTimes(1);
    });
  });
});

describe('rutas del SENDER', () => {
  const capasDe = (ruta, metodo) => {
    const router = require('../../src/routes/wellData.route');
    const capa = router.stack.find((l) => l.route && l.route.path === ruta && l.route.methods[metodo]);
    return capa.route.stack.map((s) => s.handle);
  };

  it.each([
    ['/fetchUnsentReports', 'get'],
    ['/repostToDGA', 'post'],
  ])('%s exige la clave interna antes de llegar al controlador', (ruta, metodo) => {
    const [primera, ...resto] = capasDe(ruta, metodo);

    esperarRechazo(pasarPor(primera, pedido()));
    expect(pasarPor(primera, pedido({ 'X-Internal-Api-Key': CLAVE }))).toBeUndefined();
    expect(resto).toHaveLength(1);
  });

  it.each([
    ['/wellData', 'post'],
    ['/massImportWellData', 'post'],
  ])('%s sigue sin clave, porque depende de coordinar con Layrz', (ruta, metodo) => {
    expect(capasDe(ruta, metodo)).toHaveLength(1);
  });
});

describe('GET /well', () => {
  const jwt = require('jsonwebtoken');
  let authDeGetWell;

  beforeEach(() => {
    process.env.JWT_SECRET = 'secreto-solo-para-tests';
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const router = require('../../src/routes/well.route');
    const capa = router.stack.find((l) => l.route && l.route.path === '/well' && l.route.methods.get);
    authDeGetWell = capa.route.stack[0].handle;
  });

  afterEach(() => {
    console.log.mockRestore();
  });

  const conToken = async (type) => {
    const next = jest.fn();
    const id = { admin: 1, company: 2, distributor: 3, normal: 4 }[type];
    const token = jwt.sign({ id, type }, process.env.JWT_SECRET);
    await authDeGetWell({ headers: { authorization: `Bearer ${token}` }, body: {} }, {}, next);
    return next.mock.calls[0][0];
  };

  it('rechaza una llamada anónima', async () => {
    const next = jest.fn();
    await authDeGetWell({ headers: {}, body: {} }, {}, next);

    expect(next.mock.calls[0][0].statusCode).toBe(401);
  });

  it('deja pasar a un admin', async () => {
    expect(await conToken('admin')).toBeUndefined();
  });

  it.each(['company', 'distributor', 'normal'])('rechaza el rol %s', async (rol) => {
    const error = await conToken(rol);

    expect(error.statusCode).toBe(401);
    expect(error.message).toBe('Recurso no autorizado.');
  });
});
