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

    it('isCreation cortocircuita aunque se pase una entidad ajena', async () => {
      // Comportamiento deliberado y peligroso si se usa mal: `isCreation` va
      // antes que cualquier comprobación de pertenencia. Sólo debe pasarse en
      // altas reales, donde todavía no hay entidad.
      await expect(checkPermissions(EMPRESA, clienteDeOtraEmpresa, true)).resolves.toBe(true);
    });
  });

  describe('casos que rompen la cadena de la jerarquía', () => {
    it('distribuidora no accede a un cliente sin empresa', async () => {
      // Un cliente sin `companyId` no cuelga de ninguna distribuidora.
      await expect(checkPermissions(DISTRIBUIDORA, { userId: 99, companyId: null })).resolves.toBe(false);
    });

    it('distribuidora no accede si la empresa del cliente no existe', async () => {
      mockCompanyFindByPk.mockResolvedValue(null);
      await expect(checkPermissions(DISTRIBUIDORA, clientePropio)).resolves.toBe(false);
    });

    it('ser dueño tiene precedencia sobre las ramas de rol', async () => {
      // Aunque la empresa del solicitante no coincida, el registro es suyo.
      mockCompanyFindOne.mockResolvedValue({ id: 999 });
      await expect(checkPermissions(EMPRESA, { userId: 4, companyId: 1 })).resolves.toBe(true);
      expect(mockCompanyFindOne).not.toHaveBeenCalled();
    });
  });
});

describe('los llamadores no pueden olvidar el await', () => {
  // El test de arriba sólo comprueba que la función devuelve una Promise. Esto
  // es lo que de verdad guarda contra la regresión del #60: si alguien agrega
  // una llamada sin `await`, la validación vuelve a no bloquear nada y no hay
  // ningún síntoma visible.
  const fs = require('fs');
  const path = require('path');

  const archivosJs = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      return e.isDirectory() ? archivosJs(p) : p.endsWith('.js') ? [p] : [];
    });

  it('todas las invocaciones en src/ llevan await', () => {
    const raiz = path.join(__dirname, '..', '..', 'src');
    const sinAwait = [];

    for (const archivo of archivosJs(raiz)) {
      const lineas = fs.readFileSync(archivo, 'utf8').split('\n');
      lineas.forEach((linea, i) => {
        // Se ignoran el require y la definición de la propia función.
        if (!linea.includes('checkPermissionsForClientResources(')) return;
        if (linea.includes('require(') || linea.includes('=')) return;
        if (!linea.includes('await checkPermissionsForClientResources(')) {
          sinAwait.push(`${path.relative(raiz, archivo)}:${i + 1}`);
        }
      });
    }

    expect(sinAwait).toEqual([]);
  });
});
