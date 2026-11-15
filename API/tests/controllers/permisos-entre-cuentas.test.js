// permisos-entre-cuentas.test.js
//
// Cada cuenta sólo puede operar sobre lo que cuelga de ella, siguiendo la
// jerarquía distribuidora → empresa → cliente → pozo. Antes de este cambio,
// varias rutas validaban el rol pero no la pertenencia: una empresa podía
// asignarse un cliente ajeno, una distribuidora podía asignarse una empresa
// ajena, y varios listados y detalles devolvían datos de otras cuentas.
//
// Cada handler se prueba en tres escenarios: admin puede, la cuenta dueña puede
// (que es lo que usa el portal hoy, y no debe cambiar) y una cuenta ajena
// recibe 401 sin que se escriba nada.
//
// Se usa la `checkPermissionsForClientResources` real, no un mock: lo que se
// quiere comprobar es que cada handler la llame con la entidad correcta. Los
// modelos sí van mockeados, así que no hace falta base de datos ni red.

const mockCompanyFindAll = jest.fn();
const mockCompanyFindByPk = jest.fn();
const mockCompanyFindOne = jest.fn();
const mockDistributorFindByPk = jest.fn();
const mockDistributorFindOne = jest.fn();
const mockClientFindAll = jest.fn();
const mockClientFindByPk = jest.fn();
const mockWellFindOne = jest.fn();
const mockWellDataCreate = jest.fn();

jest.mock('../../models', () => ({
  company: {
    findAll: (...a) => mockCompanyFindAll(...a),
    findByPk: (...a) => mockCompanyFindByPk(...a),
    findOne: (...a) => mockCompanyFindOne(...a),
  },
  distributor: {
    findByPk: (...a) => mockDistributorFindByPk(...a),
    findOne: (...a) => mockDistributorFindOne(...a),
  },
  client: {
    findAll: (...a) => mockClientFindAll(...a),
    findByPk: (...a) => mockClientFindByPk(...a),
  },
  well: { findOne: (...a) => mockWellFindOne(...a) },
  wellData: { create: (...a) => mockWellDataCreate(...a) },
  user: {},
  person: {},
}));

jest.mock('../../src/services/activityLog.service', () => ({
  createActivityLog: jest.fn().mockResolvedValue(undefined),
}));

const companyController = require('../../src/controllers/company.controller');
const distributorController = require('../../src/controllers/distributor.controller');
const clientController = require('../../src/controllers/client.controller');
const wellController = require('../../src/controllers/well.controller');

// Usuarios, tal como quedan en `req.user` después del authMiddleware.
const ADMIN = { id: 1, type: 'admin' };
const USUARIO_EMPRESA_A = { id: 4, type: 'company' };
const USUARIO_EMPRESA_B = { id: 77, type: 'company' };
const USUARIO_DISTRIBUIDORA_X = { id: 30, type: 'distributor' };
const USUARIO_DISTRIBUIDORA_Y = { id: 31, type: 'distributor' };
const USUARIO_CLIENTE_A = { id: 5, type: 'normal' };
const USUARIO_CLIENTE_B = { id: 99, type: 'normal' };
const USUARIO_DISTRIBUIDORA_SIN_FILA = { id: 50, type: 'distributor' };

// Datos. La distribuidora X tiene a la empresa A, que tiene al cliente A, que
// tiene el pozo 7. Lo mismo con Y, B, el cliente B y el pozo 8.
let empresas;
let distribuidoras;
let clientes;
let pozos;

const crearDatos = () => {
  const hacerEmpresa = (id, userId, distributorId) => ({
    id,
    userId,
    distributorId,
    getUser: jest.fn().mockResolvedValue({ id: userId, roleId: 3 }),
    getClients: jest.fn().mockResolvedValue([{ id: id * 100 }]),
    updateDetails: jest.fn().mockResolvedValue(undefined),
  });
  empresas = {
    1: hacerEmpresa(1, USUARIO_EMPRESA_A.id, 10),
    2: hacerEmpresa(2, USUARIO_EMPRESA_B.id, 20),
  };

  const hacerDistribuidora = (id, userId) => ({
    id,
    userId,
    getCompanies: jest.fn().mockResolvedValue([{ id: id / 10 }]),
  });
  distribuidoras = {
    10: hacerDistribuidora(10, USUARIO_DISTRIBUIDORA_X.id),
    20: hacerDistribuidora(20, USUARIO_DISTRIBUIDORA_Y.id),
  };

  const hacerCliente = (id, userId, companyId) => ({
    id,
    userId,
    companyId,
    update: jest.fn().mockResolvedValue(undefined),
  });
  clientes = {
    100: hacerCliente(100, USUARIO_CLIENTE_A.id, 1),
    200: hacerCliente(200, USUARIO_CLIENTE_B.id, 2),
  };

  const hacerPozo = (id, clientId, code) => ({
    id,
    clientId,
    code,
    getWellData: jest.fn().mockResolvedValue([{ id: 1, code }]),
  });
  pozos = {
    7: hacerPozo(7, 100, 'OB-A'),
    8: hacerPozo(8, 200, 'OB-B'),
  };
};

const porUserId = (coleccion, where) =>
  Object.values(coleccion).find((e) => e.userId === where.userId) || null;

beforeEach(() => {
  jest.clearAllMocks();
  crearDatos();
  mockCompanyFindByPk.mockImplementation(async (id) => empresas[id] || null);
  mockCompanyFindOne.mockImplementation(async ({ where }) => porUserId(empresas, where));
  mockCompanyFindAll.mockResolvedValue([{ id: 1 }]);
  mockDistributorFindByPk.mockImplementation(async (id) => distribuidoras[id] || null);
  mockDistributorFindOne.mockImplementation(async ({ where }) => porUserId(distribuidoras, where));
  mockClientFindByPk.mockImplementation(async (id) => clientes[id] || null);
  mockClientFindAll.mockResolvedValue([{ id: 100 }]);
  mockWellFindOne.mockImplementation(async ({ where }) => {
    if (where.id !== undefined) return pozos[where.id] || null;
    return Object.values(pozos).find(
      (p) => p.code === where.code && p.clientId === where.clientId
    ) || null;
  });
  mockWellDataCreate.mockImplementation(async (datos) => ({ id: 1, ...datos }));
});

// Ejecuta un handler de Express y devuelve lo que respondió o el error que
// delegó en `next`.
const correr = async (handler, { user, params = {}, body = {} }) => {
  const res = {
    statusCode: 200,
    cuerpo: undefined,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.cuerpo = b; return this; },
    send(b) { this.cuerpo = b; return this; },
  };
  const next = jest.fn();
  await handler({ user, params, body, query: {} }, res, next);
  return { res, error: next.mock.calls[0]?.[0] };
};

const esperarRechazo = (error) => {
  expect(error).toBeDefined();
  expect(error.statusCode).toBe(401);
  expect(error.message).toBe('Recurso no autorizado.');
};

describe('POST /companies/:id/clients/:clientId (addClientToCompany)', () => {
  const asignar = (user) =>
    correr(companyController.addClientToCompany, {
      user,
      params: { id: '1', clientId: '200' },
    });

  it('permite que un admin asigne un cliente a una empresa', async () => {
    const { res, error } = await asignar(ADMIN);

    expect(error).toBeUndefined();
    expect(clientes[200].update).toHaveBeenCalledWith({ companyId: '1' });
    expect(res.cuerpo).toEqual({ message: 'Cliente 200 fue agregado a la compañia 1' });
  });

  it('rechaza que una empresa se asigne un cliente de otra', async () => {
    const { error } = await asignar(USUARIO_EMPRESA_A);

    esperarRechazo(error);
    expect(clientes[200].update).not.toHaveBeenCalled();
  });

  it('rechaza que una distribuidora asigne clientes', async () => {
    const { error } = await asignar(USUARIO_DISTRIBUIDORA_X);

    esperarRechazo(error);
    expect(clientes[200].update).not.toHaveBeenCalled();
  });
});

describe('DELETE /companies/:id/clients/:clientId (removeClientFromCompany)', () => {
  const quitar = (user) =>
    correr(companyController.removeClientFromCompany, {
      user,
      params: { id: '1', clientId: '100' },
    });

  it('permite que un admin quite un cliente de su empresa', async () => {
    const { error } = await quitar(ADMIN);

    expect(error).toBeUndefined();
    expect(clientes[100].update).toHaveBeenCalledWith({ companyId: null });
  });

  it('rechaza que una empresa suelte clientes, aunque sean suyos', async () => {
    const { error } = await quitar(USUARIO_EMPRESA_A);

    esperarRechazo(error);
    expect(clientes[100].update).not.toHaveBeenCalled();
  });
});

describe('GET /companies (getAllCompanies)', () => {
  const listar = (user) => correr(companyController.getAllCompanies, { user });
  const filtroUsado = () => mockCompanyFindAll.mock.calls[0][0].where;

  it('entrega todas las empresas a un admin', async () => {
    await listar(ADMIN);

    expect(filtroUsado()).toEqual({});
  });

  it('entrega a una distribuidora solo sus empresas', async () => {
    await listar(USUARIO_DISTRIBUIDORA_X);

    expect(filtroUsado()).toEqual({ distributorId: 10 });
  });

  it('entrega a una empresa solo la propia', async () => {
    await listar(USUARIO_EMPRESA_A);

    expect(filtroUsado()).toEqual({ userId: USUARIO_EMPRESA_A.id });
  });

  it('responde una lista vacía a una distribuidora sin registro, sin consultar empresas', async () => {
    // Un filtro `{ distributorId: null }` traería justamente todas las empresas
    // sin distribuidora.
    const { res } = await listar(USUARIO_DISTRIBUIDORA_SIN_FILA);

    expect(res.cuerpo).toEqual([]);
    expect(mockCompanyFindAll).not.toHaveBeenCalled();
  });
});

describe('GET /companies/:id (getCompanyInfo)', () => {
  const ver = (user, id = '1') =>
    correr(companyController.getCompanyInfo, { user, params: { id } });

  it('muestra cualquier empresa a un admin', async () => {
    const { res, error } = await ver(ADMIN);

    expect(error).toBeUndefined();
    expect(res.cuerpo).toBe(empresas[1]);
  });

  it('muestra a una empresa sus propios datos', async () => {
    const { res, error } = await ver(USUARIO_EMPRESA_A);

    expect(error).toBeUndefined();
    expect(res.cuerpo).toBe(empresas[1]);
  });

  it('muestra a una distribuidora una empresa que gestiona', async () => {
    const { error } = await ver(USUARIO_DISTRIBUIDORA_X);

    expect(error).toBeUndefined();
  });

  it('rechaza mostrar a una empresa los datos de otra', async () => {
    const { res, error } = await ver(USUARIO_EMPRESA_B);

    esperarRechazo(error);
    expect(res.cuerpo).toBeUndefined();
  });

  it('rechaza mostrar a una distribuidora una empresa que no gestiona', async () => {
    const { error } = await ver(USUARIO_DISTRIBUIDORA_Y);

    esperarRechazo(error);
  });
});

describe('GET /companies/:id/clients (getAllCompanyClients)', () => {
  const listar = (user) =>
    correr(companyController.getAllCompanyClients, { user, params: { id: '1' } });

  it('lista a una empresa sus propios clientes', async () => {
    const { res, error } = await listar(USUARIO_EMPRESA_A);

    expect(error).toBeUndefined();
    expect(res.cuerpo).toEqual([{ id: 100 }]);
  });

  it('lista los clientes de cualquier empresa a un admin', async () => {
    const { error } = await listar(ADMIN);

    expect(error).toBeUndefined();
  });

  it('rechaza listar a una empresa los clientes de otra', async () => {
    const { error } = await listar(USUARIO_EMPRESA_B);

    esperarRechazo(error);
    expect(empresas[1].getClients).not.toHaveBeenCalled();
  });
});

describe('PUT /companies/:id/edit (editCompany)', () => {
  const editar = (user, body) =>
    correr(companyController.editCompany, { user, params: { id: '1' }, body });

  it('ignora el distributorId cuando una distribuidora edita su empresa', async () => {
    const { error } = await editar(USUARIO_DISTRIBUIDORA_X, { location: 'Ovalle', distributorId: 20 });

    expect(error).toBeUndefined();
    expect(empresas[1].updateDetails).toHaveBeenCalledWith(
      expect.anything(),
      { location: 'Ovalle' }
    );
  });

  it('ignora el distributorId cuando la empresa se edita a sí misma', async () => {
    await editar(USUARIO_EMPRESA_A, { distributorId: 20 });

    expect(empresas[1].updateDetails).toHaveBeenCalledWith(expect.anything(), {});
  });

  it('permite que un admin cambie el distributorId', async () => {
    await editar(ADMIN, { distributorId: 20 });

    expect(empresas[1].updateDetails).toHaveBeenCalledWith(
      expect.anything(),
      { distributorId: 20 }
    );
  });

  it('rechaza que una empresa edite a otra', async () => {
    const { error } = await editar(USUARIO_EMPRESA_B, { location: 'Ovalle' });

    esperarRechazo(error);
    expect(empresas[1].updateDetails).not.toHaveBeenCalled();
  });
});

describe('POST /distributors/:id/companies/:companyId (addCompanyToDistributor)', () => {
  const asignar = (user) =>
    correr(distributorController.addCompanyToDistributor, {
      user,
      params: { id: '10', companyId: '2' },
    });

  it('permite que un admin asigne una empresa a una distribuidora', async () => {
    empresas[2].update = jest.fn().mockResolvedValue(undefined);

    const { error } = await asignar(ADMIN);

    expect(error).toBeUndefined();
    expect(empresas[2].update).toHaveBeenCalledWith({ distributorId: '10' });
  });

  it('rechaza que una distribuidora se asigne una empresa de otra', async () => {
    empresas[2].update = jest.fn();

    const { error } = await asignar(USUARIO_DISTRIBUIDORA_X);

    esperarRechazo(error);
    expect(empresas[2].update).not.toHaveBeenCalled();
  });
});

describe('DELETE /distributors/:id/companies/:companyId (removeCompanyFromDistributor)', () => {
  it('rechaza que una distribuidora suelte empresas', async () => {
    empresas[1].update = jest.fn();

    const { error } = await correr(distributorController.removeCompanyFromDistributor, {
      user: USUARIO_DISTRIBUIDORA_X,
      params: { id: '10', companyId: '1' },
    });

    esperarRechazo(error);
    expect(empresas[1].update).not.toHaveBeenCalled();
  });

  it('permite que un admin quite una empresa de su distribuidora', async () => {
    empresas[1].update = jest.fn().mockResolvedValue(undefined);

    const { error } = await correr(distributorController.removeCompanyFromDistributor, {
      user: ADMIN,
      params: { id: '10', companyId: '1' },
    });

    expect(error).toBeUndefined();
    expect(empresas[1].update).toHaveBeenCalledWith({ distributorId: null });
  });
});

describe('GET /distributors/:id (getDistributorInfo)', () => {
  const ver = (user) =>
    correr(distributorController.getDistributorInfo, { user, params: { id: '10' } });

  it('muestra a una distribuidora sus propios datos', async () => {
    const { res, error } = await ver(USUARIO_DISTRIBUIDORA_X);

    expect(error).toBeUndefined();
    expect(res.cuerpo).toBe(distribuidoras[10]);
  });

  it('muestra cualquier distribuidora a un admin', async () => {
    const { error } = await ver(ADMIN);

    expect(error).toBeUndefined();
  });

  it('rechaza mostrar a una distribuidora los datos de otra', async () => {
    const { error } = await ver(USUARIO_DISTRIBUIDORA_Y);

    esperarRechazo(error);
  });
});

describe('GET /distributors/:id/companies (getAllDistributorCompanies)', () => {
  const listar = (user) =>
    correr(distributorController.getAllDistributorCompanies, { user, params: { id: '10' } });

  it('lista a una distribuidora sus propias empresas', async () => {
    const { res, error } = await listar(USUARIO_DISTRIBUIDORA_X);

    expect(error).toBeUndefined();
    expect(res.cuerpo).toEqual([{ id: 1 }]);
  });

  it('rechaza listar a una distribuidora las empresas de otra', async () => {
    const { error } = await listar(USUARIO_DISTRIBUIDORA_Y);

    esperarRechazo(error);
    expect(distribuidoras[10].getCompanies).not.toHaveBeenCalled();
  });
});

describe('GET /clients (getAllClients)', () => {
  const listar = (user) => correr(clientController.getAllClients, { user });
  const filtroUsado = () => mockClientFindAll.mock.calls[0][0].where;

  it('entrega todos los clientes a un admin', async () => {
    await listar(ADMIN);

    expect(filtroUsado()).toEqual({});
  });

  it('entrega a una empresa solo sus clientes', async () => {
    await listar(USUARIO_EMPRESA_A);

    expect(filtroUsado()).toEqual({ companyId: 1 });
  });

  it('entrega a un cliente solo su propio registro', async () => {
    await listar(USUARIO_CLIENTE_A);

    expect(filtroUsado()).toEqual({ userId: USUARIO_CLIENTE_A.id });
  });

  it('responde una lista vacía a una empresa sin registro, sin consultar clientes', async () => {
    // Un filtro `{ companyId: null }` traería justamente todos los clientes sin
    // empresa.
    const { res } = await listar({ id: 404, type: 'company' });

    expect(res.cuerpo).toEqual([]);
    expect(mockClientFindAll).not.toHaveBeenCalled();
  });
});

describe('POST /clients/:id/wells/:code/add (addDataToClientWell)', () => {
  const MEDICION = {
    code: 'OB-A',
    date: '14/11/2026',
    hour: '22:00:00',
    totalizador: 1200,
    caudal: 3.5,
    nivel_freatico: 12.4,
  };
  const agregar = (user, body = MEDICION) =>
    correr(clientController.addDataToClientWell, {
      user,
      params: { id: '100', code: 'OB-A' },
      body,
    });

  it('permite que el dueño del pozo agregue una medición', async () => {
    const { error } = await agregar(USUARIO_CLIENTE_A);

    expect(error).toBeUndefined();
    expect(mockWellDataCreate).toHaveBeenCalledWith({
      date: '14/11/2026',
      hour: '22:00:00',
      totalizador: 1200,
      caudal: 3.5,
      nivel_freatico: 12.4,
      code: 'OB-A',
    });
  });

  it('permite que la empresa del cliente agregue una medición', async () => {
    const { error } = await agregar(USUARIO_EMPRESA_A);

    expect(error).toBeUndefined();
    expect(mockWellDataCreate).toHaveBeenCalled();
  });

  it('rechaza que otro cliente agregue mediciones al pozo', async () => {
    // Si el pozo está activo, el hook afterCreate envía la medición a la DGA
    // con las credenciales del pozo, así que el rechazo debe ocurrir antes de
    // crear el registro.
    const { error } = await agregar(USUARIO_CLIENTE_B);

    esperarRechazo(error);
    expect(mockWellDataCreate).not.toHaveBeenCalled();
  });

  it('rechaza que una empresa agregue mediciones a pozos de otra', async () => {
    const { error } = await agregar(USUARIO_EMPRESA_B);

    esperarRechazo(error);
    expect(mockWellDataCreate).not.toHaveBeenCalled();
  });

  it('descarta sent, sentDate e id del body', async () => {
    await agregar(USUARIO_CLIENTE_A, { ...MEDICION, sent: true, sentDate: '14/11/2026', id: 999 });

    const creado = mockWellDataCreate.mock.calls[0][0];
    expect(creado).not.toHaveProperty('sent');
    expect(creado).not.toHaveProperty('sentDate');
    expect(creado).not.toHaveProperty('id');
  });
});

describe('GET /well/:id (getWellDataByWell)', () => {
  const ver = (user, id = '7') =>
    correr(wellController.getWellDataByWell, { user, params: { id } });

  it('muestra al dueño la telemetría de su pozo', async () => {
    const { res, error } = await ver(USUARIO_CLIENTE_A);

    expect(error).toBeUndefined();
    expect(res.cuerpo).toEqual([{ id: 1, code: 'OB-A' }]);
  });

  it('muestra a la empresa la telemetría de los pozos de sus clientes', async () => {
    const { error } = await ver(USUARIO_EMPRESA_A);

    expect(error).toBeUndefined();
  });

  it('muestra a un admin la telemetría de cualquier pozo', async () => {
    const { error } = await ver(ADMIN, '8');

    expect(error).toBeUndefined();
  });

  it('rechaza mostrar la telemetría de un pozo ajeno', async () => {
    const { error } = await ver(USUARIO_CLIENTE_B);

    esperarRechazo(error);
    expect(pozos[7].getWellData).not.toHaveBeenCalled();
  });

  it('responde 404 si el pozo no existe', async () => {
    const { res } = await ver(USUARIO_CLIENTE_A, '404');

    expect(res.statusCode).toBe(404);
  });
});
