// fetch-unsent-reports.test.js
//
// Sin base de datos: se mockea el modelo y se comprueban las opciones con las
// que se consulta. Lo que importa acá es que la consulta no pueda volver a
// crecer sin techo, y eso se ve en las opciones, no en las filas.
//
// El 10 de agosto de 2026 esta consulta materializó los 57.977 reportes
// pendientes: Node pidió 11,5 GB en una instancia de 957 MB, el OOM killer lo
// mató y la máquina quedó inaccesible 14 horas.

const mockFindAndCountAll = jest.fn();

jest.mock('../../models', () => {
  const { Op, Sequelize } = jest.requireActual('sequelize');
  return {
    wellData: { findAndCountAll: (...a) => mockFindAndCountAll(...a) },
    well: {},
    client: {},
    Op,
    Sequelize,
  };
});
jest.mock('../../src/services/wellData/handleSendData.service', () => jest.fn());

const { fetchUnsentReports } = require('../../src/controllers/wellData.controller');

const hacerRes = () => ({
  statusCode: undefined,
  cuerpo: undefined,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.cuerpo = b; return this; },
  send(b) { this.cuerpo = b; return this; },
});

// Genera `n` reportes con la forma mínima que el controlador usa.
const filas = (n) =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, code: 'ABC123', createdAt: new Date() }));

const correr = async (query = {}) => {
  const res = hacerRes();
  const next = jest.fn();
  await fetchUnsentReports({ query }, res, next);
  return { res, next, opciones: mockFindAndCountAll.mock.calls[0]?.[0] };
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  mockFindAndCountAll.mockResolvedValue({ count: 250, rows: filas(100) });
});

afterEach(() => { console.log.mockRestore(); });

describe('fetchUnsentReports', () => {
  describe('la consulta no puede crecer sin techo', () => {
    it('siempre pide un límite', async () => {
      const { opciones } = await correr();
      expect(opciones.limit).toBe(100);
    });

    it('acota el tamaño aunque quien llama pida más', async () => {
      const { opciones } = await correr({ size: '100000' });
      expect(opciones.limit).toBe(500);
    });

    it('cae al valor por defecto con un tamaño inválido', async () => {
      for (const size of ['0', 'abc', '-5', '', '1.5', undefined]) {
        jest.clearAllMocks();
        mockFindAndCountAll.mockResolvedValue({ count: 1, rows: filas(1) });
        const { opciones } = await correr({ size });
        expect(opciones.limit).toBe(100);
      }
    });

    it('respeta un tamaño razonable', async () => {
      const { opciones } = await correr({ size: '250' });
      expect(opciones.limit).toBe(250);
    });
  });

  describe('la ventana de tres días', () => {
    it('acota por fecha de creación además de por `sent`', async () => {
      const { opciones } = await correr();

      // La ventana viaja en un `Op.and` propio porque `createdAt` ya lleva un
      // `gte` contra la columna del pozo y un mismo objeto no admite dos.
      const condiciones = opciones.where[Object.getOwnPropertySymbols(opciones.where)
        .find((s) => s.toString().includes('and'))];
      const desde = condiciones[0].createdAt[
        Object.getOwnPropertySymbols(condiciones[0].createdAt)[0]
      ];

      const diasAtras = (Date.now() - desde.getTime()) / (1000 * 60 * 60 * 24);
      expect(diasAtras).toBeGreaterThan(2.9);
      expect(diasAtras).toBeLessThan(3.1);
    });

    it('sigue pidiendo sólo los no enviados', async () => {
      const { opciones } = await correr();
      expect(opciones.where.sent).toBe(false);
    });
  });

  describe('el orden hace que paginar sea correcto', () => {
    it('ordena de forma estable y determinista', async () => {
      // Sin `ORDER BY`, el motor puede devolver las filas en distinto orden
      // entre una página y la siguiente: habría reportes repetidos y otros
      // que no se entregarían nunca. Se desempata por `id` porque `createdAt`
      // puede repetirse.
      const { opciones } = await correr();
      expect(opciones.order).toEqual([['createdAt', 'ASC'], ['id', 'ASC']]);
    });

    it('desplaza el offset según la página pedida', async () => {
      const { opciones } = await correr({ page: '2' });
      expect(opciones.offset).toBe(200);
    });

    it('nunca genera un LIMIT ni un OFFSET negativos', async () => {
      // Postgres rechaza ambos con un error de base, que el usuario vería como
      // un 400 sin explicación.
      for (const query of [{ page: '-3' }, { size: '-5' }, { page: '-1', size: '-1' }]) {
        jest.clearAllMocks();
        mockFindAndCountAll.mockResolvedValue({ count: 1, rows: filas(1) });
        const { opciones } = await correr(query);
        expect(opciones.limit).toBeGreaterThan(0);
        expect(opciones.offset).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('el contrato con el SENDER', () => {
    it('conserva la forma { reports: { id: reporte } }', async () => {
      // El SENDER hace `json_response['reports'].values`. Cambiar esta forma
      // lo rompe en silencio.
      const { res } = await correr();

      expect(res.statusCode).toBe(200);
      expect(res.cuerpo.reports['1']).toMatchObject({ id: 1, code: 'ABC123' });
    });

    it('agrega la paginación sin tocar `reports`', async () => {
      const { res } = await correr();

      expect(res.cuerpo.pagination).toMatchObject({
        totalItems: 250,
        totalPages: 3,
        currentPage: 0,
        pageSize: 100,
        windowDays: 3,
      });
    });

    it('sigue devolviendo 404 cuando no hay nada', async () => {
      // El SENDER trata cualquier respuesta no exitosa como "nada que hacer".
      mockFindAndCountAll.mockResolvedValue({ count: 0, rows: [] });
      const { res } = await correr();

      expect(res.statusCode).toBe(404);
      expect(res.cuerpo.message).toMatch(/No hay reportes/);
    });

    it('no expone las credenciales DGA del pozo', async () => {
      const { opciones } = await correr();
      const includeWell = opciones.include[0];

      expect(includeWell.attributes.exclude).toEqual(
        expect.arrayContaining(['password', 'rutEmpresa', 'rutUsuario'])
      );
    });
  });

  describe('errores', () => {
    it('delega en el middleware en vez de responder el detalle interno', async () => {
      mockFindAndCountAll.mockRejectedValue(new Error('connect ECONNREFUSED'));
      const { res, next } = await correr();

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBeUndefined();
    });
  });
});
