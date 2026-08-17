// credenciales-dga-en-respuestas.test.js
//
// Las credenciales DGA de un pozo (`password`, `rutEmpresa`, `rutUsuario`) no
// pueden rotarse: el MOP las entrega una vez y no hay forma de cambiarlas desde
// acá. Por eso la regla es que dejen de aparecer en respuestas HTTP por
// cualquier vía, no sólo por las que no piden sesión.
//
// Estos tests cubren las dos rutas de `well.controller` que devolvían el modelo
// entero. `PUT /wells/:id/active` es la más relevante de las dos: es la única
// que el portal llama de verdad.
//
// Sin base de datos: se mockean los modelos. El bug es de forma de la respuesta,
// así que lo que hay que ejercitar es qué se serializa, no qué hay en la base.

const mockWellCreate = jest.fn();
const mockWellFindOne = jest.fn();
const mockClientFindByPk = jest.fn();

jest.mock('../../models', () => ({
  well: { create: (...a) => mockWellCreate(...a), findOne: (...a) => mockWellFindOne(...a) },
  wellData: {},
  client: { findByPk: (...a) => mockClientFindByPk(...a) },
  company: {},
  distributor: {},
  user: {},
  person: {},
}));

// El foco es la respuesta, no la autorización: esa tiene sus propios tests en
// tests/utils/check-permissions.test.js.
jest.mock('../../src/utils/check-permissions', () => jest.fn().mockResolvedValue(true));
jest.mock('../../src/services/activityLog.service', () => ({
  createActivityLog: jest.fn().mockResolvedValue(undefined),
}));

const { createWell, activeOrDesactiveWell } = require('../../src/controllers/well.controller');

const CREDENCIALES = ['password', 'rutEmpresa', 'rutUsuario'];

// Se construyen instancias REALES del modelo, no objetos literales.
//
// La primera versión de estos tests usaba un literal con las columnas como
// propiedades propias, y eso los volvía inútiles: una instancia de Sequelize
// guarda las columnas en `dataValues`, detrás de getters del prototipo, así que
// `Object.keys(instancia)` devuelve `['dataValues', '_previousDataValues', ...]`
// y ni una sola columna. Con el literal, una implementación que filtrara el
// objeto sin pasar por `toJSON` pasaba los 11 tests y en producción respondía
// `{}`.
//
// `new Sequelize({ dialect: 'postgres' })` no abre conexión: define el modelo y
// nada más. No hace falta base de datos para construir instancias.
const { Sequelize, DataTypes } = require('sequelize');
const Well = require('../../models/well')(new Sequelize({ dialect: 'postgres' }), DataTypes);

const hacerPozo = (asociaciones = {}) => {
  const pozo = Well.build({
    id: 7,
    code: 'ABC123',
    name: 'Pozo de prueba',
    location: 'Región de Coquimbo',
    clientId: 3,
    isActived: false,
    editStatusDate: null,
    password: 'secreto-dga',
    rutEmpresa: '76123456-7',
    rutUsuario: '12345678-9',
  });

  // Un `include` de Sequelize deja la asociación en dos lugares observables: en
  // `dataValues` —de ahí la recoge `toJSON`— y como acceso directo
  // (`well.client`), que es como la lee el controlador para el registro de
  // actividad. Se reproducen los dos, porque el test necesita ambos.
  for (const [nombre, valor] of Object.entries(asociaciones)) {
    pozo.setDataValue(nombre, valor);
    pozo[nombre] = valor;
  }

  // Lo único que se sustituye: guardar exige conexión.
  jest.spyOn(pozo, 'save').mockResolvedValue(pozo);
  return pozo;
};

const hacerRes = () => ({
  statusCode: undefined,
  cuerpo: undefined,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.cuerpo = b; return this; },
  send(b) { this.cuerpo = b; return this; },
});

// Lo que el cliente HTTP recibe de verdad, después de la serialización que hace
// Express.
const comoLoRecibeElCliente = (res) => JSON.parse(JSON.stringify(res.cuerpo));

const USUARIO = { id: 5, type: 'normal' };

beforeEach(() => {
  jest.clearAllMocks();
  mockClientFindByPk.mockResolvedValue({ id: 3 });
});

describe('las credenciales DGA no salen en las respuestas de well.controller', () => {
  describe('POST /well', () => {
    const correr = async () => {
      const res = hacerRes();
      const next = jest.fn();
      const body = {
        clientId: 3,
        code: 'ABC123',
        name: 'Pozo de prueba',
        location: 'Región de Coquimbo',
        password: 'secreto-dga',
        rutEmpresa: '76123456-7',
        rutUsuario: '12345678-9',
      };
      await createWell({ body, user: USUARIO }, res, next);
      return { res, next };
    };

    beforeEach(() => { mockWellCreate.mockImplementation(async () => hacerPozo()); });

    it.each(CREDENCIALES)('no devuelve %s', async (campo) => {
      const { res, next } = await correr();

      expect(next).not.toHaveBeenCalled();
      expect(comoLoRecibeElCliente(res).created).not.toHaveProperty(campo);
    });

    it('sigue devolviendo lo que el consumidor necesita para operar', async () => {
      const { res } = await correr();

      expect(comoLoRecibeElCliente(res).created).toMatchObject({ id: 7, code: 'ABC123' });
    });

    it('las guarda igual: filtrar la respuesta no cambia lo que se persiste', async () => {
      await correr();

      expect(mockWellCreate).toHaveBeenCalledWith(
        expect.objectContaining({ password: 'secreto-dga', rutEmpresa: '76123456-7' })
      );
    });
  });

  describe('PUT /wells/:id/active', () => {
    // Es la única ruta de este controlador que el portal llama. `wellServices.js`
    // ignora el cuerpo de la respuesta —hace `await activateWell(...)` y después
    // refresca la lista—, así que filtrarla no le quita nada.
    const correr = async () => {
      const res = hacerRes();
      const next = jest.fn();
      await activeOrDesactiveWell({ params: { id: 7 }, user: USUARIO }, res, next);
      return { res, next };
    };

    // El controlador carga el pozo con `include` de cliente, empresa,
    // distribuidora y sus usuarios, porque el registro de actividad necesita los
    // nombres. Ninguno de esos `include` excluye atributos.
    const CON_INCLUDES = {
      client: {
        id: 3,
        user: {
          id: 5,
          email: 'cliente.demo@promedicion.cl',
          encrypted_password: '$2a$10$hashdelcliente',
          person: { fullName: 'Cliente Demo' },
        },
        company: {
          id: 4,
          user: {
            id: 9,
            email: 'empresa@test.com',
            encrypted_password: '$2a$10$hashdelaempresa',
            person: { fullName: 'Empresa Demo' },
          },
          distributor: null,
        },
      },
    };

    beforeEach(() => {
      mockWellFindOne.mockResolvedValue(hacerPozo(CON_INCLUDES));
    });

    it.each(CREDENCIALES)('no devuelve %s', async (campo) => {
      const { res, next } = await correr();

      expect(next).not.toHaveBeenCalled();
      expect(comoLoRecibeElCliente(res)).not.toHaveProperty(campo);
    });

    it('devuelve el estado nuevo, que es para lo que se llama', async () => {
      const { res } = await correr();

      expect(comoLoRecibeElCliente(res)).toMatchObject({ id: 7, code: 'ABC123', isActived: true });
    });

    // Los `include` se cargan para el registro de actividad, no para el
    // consumidor. Devolverlos entrega el hash bcrypt del cliente, de su empresa
    // y de la distribuidora a cualquiera que active un pozo, incluido un rol
    // `normal`.
    it('no devuelve el árbol de cliente, empresa y distribuidora', async () => {
      const { res } = await correr();

      expect(comoLoRecibeElCliente(res)).not.toHaveProperty('client');
    });

    it('no filtra ningún hash de contraseña, venga de donde venga', async () => {
      const { res } = await correr();

      expect(JSON.stringify(comoLoRecibeElCliente(res))).not.toMatch(/\$2a\$10\$/);
    });
  });
});
