// login.test.js
//
// El login respondía 404 si el correo no existía y 400 si la contraseña era
// incorrecta, así que servía para averiguar qué correos están registrados, y no
// tenía ningún límite de intentos. Ahora responde lo mismo en ambos casos y
// bloquea una cuenta tras 5 intentos fallidos en 15 minutos.
//
// Sin base: el modelo de usuario va mockeado.

const mockFindOne = jest.fn();
const mockComparePassword = jest.fn();

jest.mock('../../models', () => ({
  user: { findOne: (...a) => mockFindOne(...a) },
  role: {}, person: {}, client: {}, company: {}, distributor: {},
}));
jest.mock('../../src/utils/auth.util', () => ({
  ...jest.requireActual('../../src/utils/auth.util'),
  comparePassword: (...a) => mockComparePassword(...a),
}));

const { loginUser, _intentosFallidosLogin } = require('../../src/controllers/user.controller');

const CORREO = 'cliente@ejemplo.cl';

const hacerUsuario = ({ claveCorrecta = 'clave-correcta', activo = true, rol = 'normal' } = {}) => ({
  isActived: activo,
  dataValues: { encrypted_password: 'hash' },
  checkPassword: jest.fn(async (p) => p === claveCorrecta),
  getRole: jest.fn().mockResolvedValue({ type: rol }),
  generateToken: jest.fn().mockResolvedValue('token-firmado'),
});

const intentar = async (password, email = CORREO) => {
  const res = {
    statusCode: 200,
    cuerpo: undefined,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.cuerpo = b; return this; },
  };
  const next = jest.fn();
  await loginUser({ body: { email, password } }, res, next);
  return { res, error: next.mock.calls[0]?.[0] };
};

beforeEach(() => {
  jest.clearAllMocks();
  _intentosFallidosLogin?.reiniciar(CORREO);
  _intentosFallidosLogin?.reiniciar('otra@ejemplo.cl');
  mockComparePassword.mockResolvedValue(false);
  jest.useFakeTimers({ now: new Date('2026-11-15T12:00:00Z'), doNotFake: ['nextTick', 'setImmediate'] });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('loginUser', () => {
  it('entrega el token con credenciales correctas', async () => {
    mockFindOne.mockResolvedValue(hacerUsuario());

    const { res, error } = await intentar('clave-correcta');

    expect(error).toBeUndefined();
    expect(res.statusCode).toBe(201);
    expect(res.cuerpo.token).toBe('token-firmado');
  });

  it('responde lo mismo si el correo no existe o si la contraseña es incorrecta', async () => {
    mockFindOne.mockResolvedValue(null);
    const { error: sinCuenta } = await intentar('lo-que-sea');

    mockFindOne.mockResolvedValue(hacerUsuario());
    const { error: claveMala } = await intentar('clave-incorrecta');

    for (const error of [sinCuenta, claveMala]) {
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Correo o contraseña incorrectos.');
    }
  });

  it('compara contra un hash de relleno cuando el correo no existe', async () => {
    // Sin esto, la respuesta sin cuenta sería más rápida que la de una
    // contraseña incorrecta, y el tiempo delataría qué correos existen.
    mockFindOne.mockResolvedValue(null);

    await intentar('lo-que-sea');

    expect(mockComparePassword).toHaveBeenCalledWith('lo-que-sea', expect.stringMatching(/^\$2a\$10\$/));
  });

  it('bloquea la cuenta al sexto intento tras 5 fallos, aunque la contraseña sea la correcta', async () => {
    mockFindOne.mockResolvedValue(hacerUsuario());
    for (let i = 0; i < 5; i += 1) await intentar('clave-incorrecta');

    const { error } = await intentar('clave-correcta');

    expect(error.statusCode).toBe(429);
    expect(error.message).toBe('Demasiados intentos fallidos. Intenta de nuevo en 15 minutos.');
  });

  it('cuenta los intentos sin importar mayúsculas ni espacios en el correo', async () => {
    mockFindOne.mockResolvedValue(null);
    for (let i = 0; i < 5; i += 1) await intentar('x', i % 2 ? ' CLIENTE@ejemplo.cl ' : CORREO);

    const { error } = await intentar('x');

    expect(error.statusCode).toBe(429);
  });

  it('no bloquea a otras cuentas', async () => {
    mockFindOne.mockResolvedValue(hacerUsuario());
    for (let i = 0; i < 5; i += 1) await intentar('clave-incorrecta');

    const { res, error } = await intentar('clave-correcta', 'otra@ejemplo.cl');

    expect(error).toBeUndefined();
    expect(res.statusCode).toBe(201);
  });

  it('desbloquea la cuenta después de 15 minutos', async () => {
    mockFindOne.mockResolvedValue(hacerUsuario());
    for (let i = 0; i < 5; i += 1) await intentar('clave-incorrecta');

    jest.advanceTimersByTime(15 * 60 * 1000);
    const { res, error } = await intentar('clave-correcta');

    expect(error).toBeUndefined();
    expect(res.statusCode).toBe(201);
  });

  it('reinicia el conteo tras un login correcto', async () => {
    mockFindOne.mockResolvedValue(hacerUsuario());
    for (let i = 0; i < 4; i += 1) await intentar('clave-incorrecta');
    await intentar('clave-correcta');
    for (let i = 0; i < 4; i += 1) await intentar('clave-incorrecta');

    const { res, error } = await intentar('clave-correcta');

    expect(error).toBeUndefined();
    expect(res.statusCode).toBe(201);
  });

  it('no permite evitar el límite enviando el correo dentro de un array', async () => {
    // Sequelize convertiría el array en `IN (...)` y encontraría a la víctima,
    // mientras la clave del límite cambiaría en cada intento.
    mockFindOne.mockResolvedValue(hacerUsuario());
    for (let i = 0; i < 5; i += 1) await intentar('clave-incorrecta');

    const { error } = await intentar('clave-correcta', [CORREO, `variante-${Math.random()}`]);

    expect(error.statusCode).toBe(401);
    expect(mockFindOne).toHaveBeenCalledTimes(5);
  });

  it.each([
    ['un correo en array', [CORREO, 'otro'], 'clave-correcta'],
    ['una contraseña numérica', CORREO, 123],
    ['una contraseña booleana', CORREO, true],
    ['una contraseña en array', CORREO, ['clave-correcta']],
    ['un correo de más de 254 caracteres', `${'a'.repeat(250)}@x.cl`, 'clave-correcta'],
    ['una contraseña de más de 1024 caracteres', CORREO, 'a'.repeat(1025)],
  ])('rechaza %s sin consultar la base ni registrar el intento', async (_caso, email, password) => {
    mockFindOne.mockResolvedValue(hacerUsuario());

    const { error } = await intentar(password, email);

    expect(error.statusCode).toBe(401);
    expect(error.message).toBe('Correo o contraseña incorrectos.');
    expect(mockFindOne).not.toHaveBeenCalled();
    expect(mockComparePassword).not.toHaveBeenCalled();
    expect(_intentosFallidosLogin?.cantidadDeClaves?.() ?? 0).toBe(0);
  });

  it('sigue rechazando a un usuario inactivo con la contraseña correcta', async () => {
    mockFindOne.mockResolvedValue(hacerUsuario({ activo: false }));

    const { error } = await intentar('clave-correcta');

    expect(error.statusCode).toBe(401);
    expect(error.message).toBe('Recurso no autorizado.');
  });
});
