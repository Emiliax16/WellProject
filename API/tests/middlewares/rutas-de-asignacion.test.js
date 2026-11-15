// rutas-de-asignacion.test.js
//
// Asignar clientes a empresas, o empresas a distribuidoras, decide quién puede
// leer las credenciales DGA de un cliente o cambiarle la contraseña. Por eso
// esas cuatro rutas son sólo para admin. Los handlers repiten la validación
// (ver tests/controllers/permisos-entre-cuentas.test.js), y este archivo prueba
// la primera barrera: el authMiddleware configurado en cada ruta.
//
// Se ejercita el middleware real de cada ruta con tokens firmados, tomándolo de
// la pila del router de Express. No hace falta levantar el servidor ni base de
// datos: los modelos van mockeados y el handler nunca llega a ejecutarse.

process.env.JWT_SECRET = 'secreto-solo-para-tests';

// El middleware revalida al usuario en la base. Cada rol tiene un id fijo y el
// usuario mockeado devuelve ese mismo rol, igual que en una sesión vigente.
const ROL_POR_ID = { 1: 'admin', 2: 'company', 3: 'distributor', 4: 'normal' };
jest.mock('../../models', () => ({
  company: {}, distributor: {}, client: {}, well: {}, wellData: {}, person: {},
  user: {
    findByPk: async (id) => ({ id, isActived: true, getRole: async () => ({ type: ROL_POR_ID[id] }) }),
  },
}));
jest.mock('../../src/services/activityLog.service', () => ({
  createActivityLog: jest.fn(),
}));

const jwt = require('jsonwebtoken');
const companyRouter = require('../../src/routes/company.route');
const distributorRouter = require('../../src/routes/distributor.route');

const ID_POR_ROL = { admin: 1, company: 2, distributor: 3, normal: 4 };
const tokenDe = (type) => jwt.sign({ id: ID_POR_ROL[type], type }, process.env.JWT_SECRET);

// Devuelve el primer middleware (el authMiddleware) de la ruta indicada.
const authDeRuta = (router, metodo, ruta) => {
  const capa = router.stack.find(
    (l) => l.route && l.route.path === ruta && l.route.methods[metodo]
  );
  if (!capa) {
    throw new Error(`No existe la ruta ${metodo.toUpperCase()} ${ruta}`);
  }
  return capa.route.stack[0].handle;
};

const pasarPor = async (middleware, type) => {
  const next = jest.fn();
  const req = { headers: { authorization: `Bearer ${tokenDe(type)}` }, body: {} };
  await middleware(req, {}, next);
  return next.mock.calls[0][0];
};

const RUTAS = [
  [companyRouter, 'post', '/companies/:id/clients/:clientId'],
  [companyRouter, 'delete', '/companies/:id/clients/:clientId'],
  [distributorRouter, 'post', '/distributors/:id/companies/:companyId'],
  [distributorRouter, 'delete', '/distributors/:id/companies/:companyId'],
];

let silenciarConsola;

beforeAll(() => {
  // `decodeToken` escribe en consola en cada llamada.
  silenciarConsola = jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  silenciarConsola.mockRestore();
});

describe.each(RUTAS)('%#: %s %s', (router, metodo, ruta) => {
  const middleware = authDeRuta(router, metodo, ruta);

  it('deja pasar a un admin', async () => {
    const resultado = await pasarPor(middleware, 'admin');

    expect(resultado).toBeUndefined();
  });

  it.each(['company', 'distributor', 'normal'])('rechaza el rol %s', async (rol) => {
    const error = await pasarPor(middleware, rol);

    expect(error.statusCode).toBe(401);
    expect(error.message).toBe('Recurso no autorizado.');
  });
});
