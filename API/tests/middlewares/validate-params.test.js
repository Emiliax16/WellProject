// validate-params.test.js
//
// Los modelos van mockeados: este archivo no toca la base. Ver la nota en
// `tests/utils/check-permissions.test.js`.

const mockRoleFindByPk = jest.fn();
jest.mock('../../models', () => ({
  role: { findByPk: (...a) => mockRoleFindByPk(...a) },
}));

const validateParams = require('../../src/middlewares/validate-params.middleware');

// Ejecuta el middleware y devuelve todas las llamadas a `next`, para poder
// afirmar que se llama exactamente una vez.
const correr = async (mw, body) => {
  const llamadas = [];
  await mw({ body }, {}, (e) => llamadas.push(e || null));
  return llamadas;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRoleFindByPk.mockResolvedValue({ type: 'normal' });
});

describe('validateParams', () => {
  describe('un roleId mal formado no puede tumbar el proceso', () => {
    // Este bloque corre en POST /users/login, que es público. Antes,
    // `Role.findByPk('2abc')` dejaba que Postgres rechazara la consulta y la
    // rejection sin capturar mataba el proceso: una petición anónima bastaba
    // para dejar la API caída, y con nodemon no se reinicia sola.
    const spec = { email: { type: 'string', required: true } };

    it.each(['2abc', 'x', '2.9', '2_0', [], {}, true])(
      'rechaza roleId=%p con 400 en vez de consultar la base',
      async (roleId) => {
        const llamadas = await correr(validateParams(spec), { email: 'a@b.cl', roleId });
        expect(llamadas).toHaveLength(1);
        expect(llamadas[0]).toBeInstanceOf(Error);
        expect(llamadas[0].statusCode).toBe(400);
        expect(mockRoleFindByPk).not.toHaveBeenCalled();
      }
    );

    it('acepta un roleId entero y lo consulta normalizado', async () => {
      const body = { email: 'a@b.cl', roleId: '3' };
      await correr(validateParams(spec), body);
      expect(mockRoleFindByPk).toHaveBeenCalledWith(3);
      // El controlador debe recibir el entero, no la cadena.
      expect(body.roleId).toBe(3);
    });

    it('si la consulta a la base falla, delega el error en vez de reventar', async () => {
      // Es el escenario de base caída, y es justo la forma del defecto que
      // este PR cierra: un rechazo sin recoger dentro de un middleware async
      // mata el proceso.
      mockRoleFindByPk.mockRejectedValue(new Error('connect ECONNREFUSED'));
      const llamadas = await correr(validateParams(spec), { email: 'a@b.cl', roleId: 3 });
      expect(llamadas).toHaveLength(1);
      expect(llamadas[0]).toBeInstanceOf(Error);
    });

    it('deja pasar enteros fuera del rango de int4 sin romper', async () => {
      // Postgres resuelve `int4 = int8` sin error, así que estos llegan a la
      // consulta y simplemente no encuentran fila. Se fija el comportamiento
      // para que un cambio futuro no los convierta en un error de casteo.
      for (const roleId of ['2147483648', '1e30']) {
        mockRoleFindByPk.mockResolvedValue(null);
        const llamadas = await correr(validateParams(spec), { email: 'a@b.cl', roleId });
        expect(llamadas).toEqual([null]);
      }
    });

    it('un roleType que no es string no salta la validación', async () => {
      // `roleType` lo controla quien llama y cortocircuita la consulta a la
      // base, así que conviene fijar que un objeto no se cuela como tipo.
      const llamadas = await correr(validateParams(spec), { email: 'a@b.cl', roleType: { a: 1 } });
      expect(llamadas).toEqual([null]);
      expect(mockRoleFindByPk).not.toHaveBeenCalled();
    });

    it('no consulta la base cuando no viene roleId', async () => {
      const llamadas = await correr(validateParams(spec), { email: 'a@b.cl' });
      expect(llamadas).toEqual([null]);
      expect(mockRoleFindByPk).not.toHaveBeenCalled();
    });

    it('trata un roleId vacío como ausente', async () => {
      const llamadas = await correr(validateParams(spec), { email: 'a@b.cl', roleId: '' });
      expect(llamadas).toEqual([null]);
      expect(mockRoleFindByPk).not.toHaveBeenCalled();
    });
  });

  describe('next() se llama exactamente una vez', () => {
    // Antes el catch llamaba a next(error) y la ejecución seguía hasta un
    // next() final, así que una petición inválida respondía 400 y además
    // continuaba al controlador, que intentaba responder sobre una respuesta
    // ya cerrada. Es el ERR_HTTP_HEADERS_SENT del incidente de agosto.
    const spec = {
      email: { type: 'string', required: true },
      id: { type: 'integer', forbidden: true },
    };

    it('con un parámetro requerido ausente, sólo el error', async () => {
      const llamadas = await correr(validateParams(spec), { otro: 'x' });
      expect(llamadas).toHaveLength(1);
      expect(llamadas[0]).toBeInstanceOf(Error);
    });

    it('con un parámetro prohibido, sólo el error', async () => {
      const llamadas = await correr(validateParams(spec), { email: 'a@b.cl', id: 9 });
      expect(llamadas).toHaveLength(1);
      expect(llamadas[0].message).toMatch(/prohibido/);
    });

    it('sin parámetros válidos, sólo el error', async () => {
      const llamadas = await correr(validateParams(spec), {});
      expect(llamadas).toHaveLength(1);
      expect(llamadas[0]).toBeInstanceOf(Error);
    });

    it('con el body correcto, un solo next() sin error', async () => {
      const llamadas = await correr(validateParams(spec), { email: 'a@b.cl' });
      expect(llamadas).toEqual([null]);
    });
  });

  describe('el spec no se muta entre peticiones', () => {
    // `paramsSpec` es un objeto de módulo que se pasa una sola vez al definir
    // la ruta. Los `delete` del bloque de registro lo mutaban de forma
    // permanente: tras la primera alta de una empresa, el spec perdía los
    // campos de Person y registrar un cliente dejaba de exigirlos.
    const specDeRegistro = () => ({
      name: { type: 'string', required: true },
      fullName: { type: 'string', required: true },
      location: { type: 'string', required: true },
      phoneNumber: { type: 'string', required: true },
      personalEmail: { type: 'string', required: false },
      companyLogo: { type: 'string', required: false },
      companyRut: { type: 'string', required: false },
      recoveryEmail: { type: 'string', required: false },
    });

    it('un alta de empresa no borra los campos de Person del spec', async () => {
      const spec = specDeRegistro();
      const original = Object.keys(spec).sort();
      const mw = validateParams(spec, true);

      await correr(mw, { roleType: 'company', name: 'Empresa', companyRut: '1-9' });

      expect(Object.keys(spec).sort()).toEqual(original);
    });

    it('tras un alta de empresa, un cliente sin fullName sigue rechazado', async () => {
      const spec = specDeRegistro();
      const mw = validateParams(spec, true);

      await correr(mw, { roleType: 'company', name: 'Empresa', companyRut: '1-9' });
      const llamadas = await correr(mw, { roleType: 'normal', name: 'Cliente' });

      expect(llamadas).toHaveLength(1);
      expect(llamadas[0].message).toMatch(/fullName/);
    });
  });
});
