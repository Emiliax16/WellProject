// clave-dga-al-editar-pozo.test.js
//
// Issue #91. La contraseña DGA de un pozo no se puede recuperar: el MOP la
// entrega una sola vez. El formulario de edición del portal la registra sin
// `defaultValue` y manda `password: ""` en cada guardado, y el backend la
// persistía. Bastaba con cambiarle el nombre a un pozo para dejarlo sin
// credencial, y un pozo sin credencial no transmite a la DGA ni se puede volver
// a activar desde el portal.
//
// Además, el listado y el detalle de pozos devolvían la contraseña en claro. El
// portal solo la usa para saber si existe: habilita el botón de activar con
// `Boolean(rutEmpresa && rutUsuario && password)`. Por eso ahora sale
// enmascarada, y esa condición tiene que seguir dando el mismo resultado.
//
// Sin base de datos: los modelos van mockeados, pero los pozos son instancias
// reales de Sequelize, porque la serialización depende de `toJSON`.

const mockClientFindByPk = jest.fn();
const mockWellFindOne = jest.fn();
const mockWellFindAndCountAll = jest.fn();
const mockWellDataFindAndCountAll = jest.fn();

jest.mock('../../models', () => ({
  client: { findByPk: (...a) => mockClientFindByPk(...a) },
  well: {
    findOne: (...a) => mockWellFindOne(...a),
    findAndCountAll: (...a) => mockWellFindAndCountAll(...a),
  },
  wellData: { findAndCountAll: (...a) => mockWellDataFindAndCountAll(...a) },
  company: {},
  distributor: {},
  user: {},
  person: {},
}));

// El foco es qué se guarda y qué se responde; la autorización tiene sus propios
// tests en permisos-entre-cuentas.test.js.
jest.mock('../../src/utils/check-permissions', () => jest.fn().mockResolvedValue(true));
jest.mock('../../src/services/activityLog.service', () => ({
  createActivityLog: jest.fn().mockResolvedValue(undefined),
}));

const { Sequelize, DataTypes } = require('sequelize');
const Well = require('../../models/well')(new Sequelize({ dialect: 'postgres' }), DataTypes);
const { editClientWell, getOneWell, getClientWells } = require('../../src/controllers/client.controller');

const USUARIO = { id: 5, type: 'normal' };

const hacerPozo = (credenciales = {}) => {
  const pozo = Well.build({
    id: 7,
    code: 'OB-0902-1553',
    name: 'Pozo 1',
    location: 'Región de Valparaíso',
    clientId: 3,
    isActived: true,
    rutEmpresa: '76123456-7',
    rutUsuario: '12345678-9',
    password: 'clave-del-mop',
    ...credenciales,
  });
  jest.spyOn(pozo, 'update').mockResolvedValue(pozo);
  return pozo;
};

const correr = async (handler, { params = {}, body = {}, query = {} } = {}) => {
  const res = {
    statusCode: 200,
    cuerpo: undefined,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.cuerpo = b; return this; },
  };
  const next = jest.fn();
  await handler({ user: USUARIO, params, body, query }, res, next);
  return { res, error: next.mock.calls[0]?.[0] };
};

// Lo que el cliente HTTP recibe de verdad, después de la serialización de Express.
const comoLoRecibeElCliente = (cuerpo) => JSON.parse(JSON.stringify(cuerpo));

// La misma condición que usan `ClientWells.js` y `WellRow.js` en el portal.
const portalPermiteActivar = (well) => Boolean(well?.rutEmpresa && well?.rutUsuario && well?.password);

beforeEach(() => {
  jest.clearAllMocks();
  mockClientFindByPk.mockResolvedValue({ id: 3, userId: 5 });
  mockWellDataFindAndCountAll.mockResolvedValue({ count: 0, rows: [] });
});

describe('PUT /clients/:id/wells/:code/edit (editClientWell)', () => {
  let pozo;

  const editar = (body) =>
    correr(editClientWell, { params: { id: '3', code: 'OB-0902-1553' }, body });
  const loGuardado = () => pozo.update.mock.calls[0][0];

  beforeEach(() => {
    pozo = hacerPozo();
    mockWellFindOne.mockResolvedValue(pozo);
  });

  it('conserva la contraseña cuando el formulario la manda vacía', async () => {
    // Es exactamente lo que manda el portal al cambiar solo el nombre.
    const { error } = await editar({
      name: 'Pozo 1 renombrado',
      rutEmpresa: '76123456-7',
      rutUsuario: '12345678-9',
      password: '',
    });

    expect(error).toBeUndefined();
    expect(loGuardado()).toEqual({
      name: 'Pozo 1 renombrado',
      rutEmpresa: '76123456-7',
      rutUsuario: '12345678-9',
    });
  });

  it('conserva la contraseña cuando llega con solo espacios', async () => {
    await editar({ name: 'Pozo 1', password: '   ' });

    expect(loGuardado()).not.toHaveProperty('password');
  });

  it('conserva la contraseña cuando llega null', async () => {
    await editar({ name: 'Pozo 1', password: null });

    expect(loGuardado()).not.toHaveProperty('password');
  });

  it('conserva la contraseña cuando vuelve la máscara de la respuesta', async () => {
    await editar({ name: 'Pozo 1', password: '********' });

    expect(loGuardado()).not.toHaveProperty('password');
  });

  it('guarda una contraseña nueva cuando se escribe una', async () => {
    await editar({ password: 'clave-nueva-del-mop' });

    expect(loGuardado()).toEqual({ password: 'clave-nueva-del-mop' });
  });

  it('conserva los RUT cuando llegan vacíos', async () => {
    await editar({ name: 'Pozo 1', rutEmpresa: '', rutUsuario: ' ' });

    expect(loGuardado()).toEqual({ name: 'Pozo 1' });
  });

  it('guarda RUT nuevos cuando se escriben', async () => {
    await editar({ rutEmpresa: '77000000-1', rutUsuario: '11111111-1' });

    expect(loGuardado()).toEqual({ rutEmpresa: '77000000-1', rutUsuario: '11111111-1' });
  });

  it('sigue guardando los demás campos editables', async () => {
    await editar({ name: 'Pozo 1', location: 'Quillota', isActived: false, password: '' });

    expect(loGuardado()).toEqual({ name: 'Pozo 1', location: 'Quillota', isActived: false });
  });

  it('sigue descartando los campos que no son editables', async () => {
    await editar({ name: 'Pozo 1', clientId: 99, editStatusDate: '2030-01-01' });

    expect(loGuardado()).toEqual({ name: 'Pozo 1' });
  });
});

describe('GET /clients/:id/wells/:code (getOneWell)', () => {
  const ver = () => correr(getOneWell, { params: { id: '3', code: 'OB-0902-1553' } });

  it('enmascara la contraseña cuando el pozo tiene una', async () => {
    mockWellFindOne.mockResolvedValue(hacerPozo());

    const { res } = await ver();
    const cuerpo = comoLoRecibeElCliente(res.cuerpo);

    expect(cuerpo.password).toBe('********');
    expect(JSON.stringify(res.cuerpo)).not.toContain('clave-del-mop');
  });

  it('conserva los RUT, que el formulario usa como valor inicial', async () => {
    mockWellFindOne.mockResolvedValue(hacerPozo());

    const { res } = await ver();
    const cuerpo = comoLoRecibeElCliente(res.cuerpo);

    expect(cuerpo.rutEmpresa).toBe('76123456-7');
    expect(cuerpo.rutUsuario).toBe('12345678-9');
    expect(cuerpo).toMatchObject({ code: 'OB-0902-1553', name: 'Pozo 1', isActived: true });
  });

  it('deja la contraseña vacía cuando el pozo no tiene una', async () => {
    mockWellFindOne.mockResolvedValue(hacerPozo({ password: null }));

    const { res } = await ver();

    expect(comoLoRecibeElCliente(res.cuerpo).password).toBeNull();
  });
});

describe('GET /clients/:id/wells (getClientWells)', () => {
  const listar = () => correr(getClientWells, { params: { id: '3' }, query: { page: 0, size: 10 } });

  beforeEach(() => {
    mockWellFindAndCountAll.mockResolvedValue({
      count: 2,
      rows: [
        hacerPozo(),
        hacerPozo({ id: 8, code: 'OB-0902-1151', password: '' }),
      ],
    });
  });

  it('enmascara la contraseña de cada pozo del listado', async () => {
    const { res } = await listar();
    const cuerpo = comoLoRecibeElCliente(res.cuerpo);

    expect(cuerpo.rows[0].password).toBe('********');
    expect(cuerpo.rows[1].password).toBe('');
    expect(JSON.stringify(res.cuerpo)).not.toContain('clave-del-mop');
  });

  it('conserva el total y los demás campos del listado', async () => {
    const { res } = await listar();
    const cuerpo = comoLoRecibeElCliente(res.cuerpo);

    expect(cuerpo.count).toBe(2);
    expect(cuerpo.rows.map((w) => w.code)).toEqual(['OB-0902-1553', 'OB-0902-1151']);
    expect(cuerpo.rows[0].rutEmpresa).toBe('76123456-7');
  });

  it('mantiene la regla del portal para habilitar la activación', async () => {
    // El pozo con contraseña se puede activar y el que no tiene, no, igual que
    // cuando la contraseña viajaba en claro.
    const { res } = await listar();
    const cuerpo = comoLoRecibeElCliente(res.cuerpo);

    expect(portalPermiteActivar(cuerpo.rows[0])).toBe(true);
    expect(portalPermiteActivar(cuerpo.rows[1])).toBe(false);
  });
});
