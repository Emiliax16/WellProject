// check-permissions.test.js
//
// Test unitario, sin base de datos: los modelos van mockeados. Es deliberado.
// El resto de la suite hace `sequelize.sync({ force: true })` y, como
// `NODE_ENV` es `development`, apunta a la base de desarrollo. Este archivo no
// depende de esa configuración y se puede correr en cualquier parte.

const mockCompanyFindOne = jest.fn();
const mockCompanyFindByPk = jest.fn();
const mockDistributorFindOne = jest.fn();

jest.mock('../../models', () => ({
  company: { findOne: (...a) => mockCompanyFindOne(...a), findByPk: (...a) => mockCompanyFindByPk(...a) },
  distributor: { findOne: (...a) => mockDistributorFindOne(...a) },
}));

const checkPermissions = require('../../src/utils/check-permissions');

const ADMIN = { id: 1, type: 'admin' };
const EMPRESA = { id: 4, type: 'company' };
const DISTRIBUIDORA = { id: 10, type: 'distributor' };
const NORMAL = { id: 5, type: 'normal' };

// Entidades: sólo importan los campos que la función lee.
const clientePropio = { userId: 5, companyId: 1 };
const clienteDeOtraEmpresa = { userId: 99, companyId: 2 };
const empresaPropia = { userId: 4, distributorId: 10 };
const empresaAjena = { userId: 77, distributorId: 20 };

beforeEach(() => {
  jest.clearAllMocks();
  mockCompanyFindOne.mockResolvedValue({ id: 1 });
  mockDistributorFindOne.mockResolvedValue({ id: 10 });
  mockCompanyFindByPk.mockResolvedValue({ id: 1, distributorId: 10 });
});

describe('checkPermissionsForClientResources', () => {
  it('es async: sin await el resultado es una Promise siempre truthy', () => {
    // Guarda contra la regresión del #60. Si alguien la vuelve síncrona o
    // alguien la llama sin await, `!resultado` nunca se cumple.
    const resultado = checkPermissions(NORMAL, clienteDeOtraEmpresa);
    expect(resultado).toBeInstanceOf(Promise);
    expect(!resultado).toBe(false);
  });

  describe('admin', () => {
    it('accede a cualquier entidad', async () => {
      await expect(checkPermissions(ADMIN, clienteDeOtraEmpresa)).resolves.toBe(true);
      await expect(checkPermissions(ADMIN, empresaAjena)).resolves.toBe(true);
    });
  });

  describe('normal', () => {
    it('accede a su propio registro', async () => {
      await expect(checkPermissions(NORMAL, clientePropio)).resolves.toBe(true);
    });

    it('no accede al registro de otro cliente', async () => {
      await expect(checkPermissions(NORMAL, clienteDeOtraEmpresa)).resolves.toBe(false);
    });

    it('no accede a una empresa', async () => {
      await expect(checkPermissions(NORMAL, empresaPropia)).resolves.toBe(false);
    });
  });

  describe('company', () => {
    it('accede a los clientes de su empresa', async () => {
      await expect(checkPermissions(EMPRESA, clientePropio)).resolves.toBe(true);
    });

    it('no accede a clientes de otra empresa', async () => {
      await expect(checkPermissions(EMPRESA, clienteDeOtraEmpresa)).resolves.toBe(false);
    });

    it('accede a sus propios datos de empresa', async () => {
      await expect(checkPermissions(EMPRESA, empresaPropia)).resolves.toBe(true);
    });

    it('devuelve false, sin reventar, si no tiene fila en companies', async () => {
      // Antes leía `company.id` sobre null y lanzaba TypeError, que el
      // middleware de errores convertía en 500 en vez de 401.
      mockCompanyFindOne.mockResolvedValue(null);
      await expect(checkPermissions(EMPRESA, clientePropio)).resolves.toBe(false);
    });
  });

  describe('distributor', () => {
    it('accede a las empresas que cuelgan de ella', async () => {
      await expect(checkPermissions(DISTRIBUIDORA, empresaPropia)).resolves.toBe(true);
    });

    it('no accede a empresas de otra distribuidora', async () => {
      await expect(checkPermissions(DISTRIBUIDORA, empresaAjena)).resolves.toBe(false);
    });

    it('accede a los clientes de sus empresas', async () => {
      await expect(checkPermissions(DISTRIBUIDORA, clientePropio)).resolves.toBe(true);
      expect(mockCompanyFindByPk).toHaveBeenCalledWith(1);
    });

    it('no accede a clientes de empresas ajenas', async () => {
      mockCompanyFindByPk.mockResolvedValue({ id: 2, distributorId: 20 });
      await expect(checkPermissions(DISTRIBUIDORA, clienteDeOtraEmpresa)).resolves.toBe(false);
    });

    it('devuelve false, sin reventar, si no tiene fila en distributors', async () => {
      mockDistributorFindOne.mockResolvedValue(null);
      await expect(checkPermissions(DISTRIBUIDORA, empresaPropia)).resolves.toBe(false);
    });
  });

  describe('creaciones y entidades ausentes', () => {
    it('deja pasar una creación: el authMiddleware de la ruta ya filtró por rol', async () => {
      await expect(checkPermissions(EMPRESA, undefined, true)).resolves.toBe(true);
    });

    it('niega si no hay entidad y no es una creación', async () => {
      // Es el caso que antes se colaba: `undefined` con la llamada sin await.
      await expect(checkPermissions(EMPRESA, undefined)).resolves.toBe(false);
      await expect(checkPermissions(EMPRESA, null)).resolves.toBe(false);
    });
  });
});
