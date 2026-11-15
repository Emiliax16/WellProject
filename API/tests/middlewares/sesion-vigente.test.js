// sesion-vigente.test.js
//
// El token dura 24 h y trae el rol del momento del login. Antes, el middleware
// confiaba en él sin mirar la base: un usuario borrado, desactivado o con el rol
// cambiado seguía operando hasta que venciera, y una cuenta desactivada podía
// reactivarse editando su propio `isActived`. Ahora cada petición revalida al
// usuario y autoriza con su rol actual.
//
// También cubre `GET /users/role/:id`, que dejaba a cualquier sesión consultar
// el rol de cualquier usuario.

process.env.JWT_SECRET = 'secreto-solo-para-tests';

const mockFindByPk = jest.fn();

jest.mock('../../models', () => ({
  user: { findByPk: (...a) => mockFindByPk(...a) },
  role: {}, person: {}, client: {}, company: {}, distributor: {},
}));

const jwt = require('jsonwebtoken');
const authMiddleware = require('../../src/middlewares/auth.middleware');
const { getUserRoleById } = require('../../src/controllers/user.controller');

const tokenDe = (id, type) => jwt.sign({ id, type }, process.env.JWT_SECRET);
const usuarioEnBase = ({ id = 7, activo = true, rol = 'normal' } = {}) => ({
  id,
  isActived: activo,
  getRole: async () => (rol ? { type: rol } : null),
});

const pasar = async (roles, headers) => {
  const req = { headers, body: {} };
  const next = jest.fn();
  await authMiddleware(...roles)(req, {}, next);
  return { req, error: next.mock.calls[0][0] };
};

let silenciar;
beforeEach(() => {
  jest.clearAllMocks();
  silenciar = [jest.spyOn(console, 'log').mockImplementation(() => {}), jest.spyOn(console, 'error').mockImplementation(() => {})];
});
afterEach(() => silenciar.forEach((s) => s.mockRestore()));

describe('authMiddleware revalida la sesión', () => {
  it('deja pasar a un usuario vigente', async () => {
    mockFindByPk.mockResolvedValue(usuarioEnBase({ rol: 'company' }));

    const { req, error } = await pasar(['admin', 'company'], { authorization: `Bearer ${tokenDe(7, 'company')}` });

    expect(error).toBeUndefined();
    expect(req.user).toMatchObject({ id: 7, type: 'company' });
  });

  it('deja en req.user el rol de la base y no el del token', async () => {
    // Lo promovieron a empresa después de iniciar sesión como cliente.
    mockFindByPk.mockResolvedValue(usuarioEnBase({ rol: 'company' }));

    const { req, error } = await pasar(['company'], { authorization: `Bearer ${tokenDe(7, 'normal')}` });

    expect(error).toBeUndefined();
    expect(req.user.type).toBe('company');
  });

  it('no deja pasar la petición si falla la consulta a la base', async () => {
    // Falla cerrado: sin poder revalidar, no se confía en el token.
    mockFindByPk.mockRejectedValue(new Error('connect ECONNREFUSED'));

    const { req, error } = await pasar([], { authorization: `Bearer ${tokenDe(7, 'normal')}` });

    expect(error.message).toBe('connect ECONNREFUSED');
    expect(req.user).toBeUndefined();
  });

  it('rechaza el token de un usuario que ya no existe', async () => {
    mockFindByPk.mockResolvedValue(null);

    const { error } = await pasar([], { authorization: `Bearer ${tokenDe(7, 'normal')}` });

    expect(error.statusCode).toBe(401);
    expect(error.message).toBe('Recurso no autorizado.');
  });

  it('rechaza el token de un usuario desactivado', async () => {
    mockFindByPk.mockResolvedValue(usuarioEnBase({ activo: false }));

    const { error } = await pasar([], { authorization: `Bearer ${tokenDe(7, 'normal')}` });

    expect(error.statusCode).toBe(401);
  });

  it('deja pasar a un admin inactivo, igual que el login', async () => {
    mockFindByPk.mockResolvedValue(usuarioEnBase({ activo: false, rol: 'admin' }));

    const { error } = await pasar(['admin'], { authorization: `Bearer ${tokenDe(7, 'admin')}` });

    expect(error).toBeUndefined();
  });

  it('autoriza con el rol actual aunque el token diga otro', async () => {
    // Era admin al iniciar sesión y le quitaron el rol después.
    mockFindByPk.mockResolvedValue(usuarioEnBase({ rol: 'normal' }));

    const soloAdmin = await pasar(['admin'], { authorization: `Bearer ${tokenDe(7, 'admin')}` });
    const cualquiera = await pasar([], { authorization: `Bearer ${tokenDe(7, 'admin')}` });

    expect(soloAdmin.error.statusCode).toBe(401);
    expect(cualquiera.req.user.type).toBe('normal');
  });

  it('rechaza a un usuario sin rol asociado', async () => {
    mockFindByPk.mockResolvedValue(usuarioEnBase({ rol: null }));

    const { error } = await pasar([], { authorization: `Bearer ${tokenDe(7, 'normal')}` });

    expect(error.statusCode).toBe(401);
  });

  it('no consulta la base con un token inválido', async () => {
    const { error } = await pasar([], { authorization: 'Bearer token-falso' });

    expect(error.statusCode).toBe(401);
    expect(mockFindByPk).not.toHaveBeenCalled();
  });

  it('pide solo las columnas necesarias, sin la contraseña', async () => {
    mockFindByPk.mockResolvedValue(usuarioEnBase());

    await pasar([], { authorization: `Bearer ${tokenDe(7, 'normal')}` });

    expect(mockFindByPk).toHaveBeenCalledWith(7, { attributes: ['id', 'isActived', 'roleId'] });
  });
});

describe('GET /users/role/:id (getUserRoleById)', () => {
  const consultar = async (user, id) => {
    const res = { status(c) { this.statusCode = c; return this; }, json(b) { this.cuerpo = b; return this; } };
    const next = jest.fn();
    await getUserRoleById({ user, params: { id } }, res, next);
    return { res, error: next.mock.calls[0]?.[0] };
  };

  beforeEach(() => {
    mockFindByPk.mockResolvedValue({ getRole: async () => ({ id: 2, type: 'normal' }) });
  });

  it('entrega a un usuario su propio rol', async () => {
    const { res, error } = await consultar({ id: 7, type: 'normal' }, '7');

    expect(error).toBeUndefined();
    expect(res.cuerpo).toEqual({ id: 2, type: 'normal' });
  });

  it('rechaza consultar el rol de otro usuario', async () => {
    const { error } = await consultar({ id: 7, type: 'company' }, '8');

    expect(error.statusCode).toBe(401);
    expect(mockFindByPk).not.toHaveBeenCalled();
  });

  it('permite a un admin consultar el rol de cualquier usuario', async () => {
    const { error } = await consultar({ id: 1, type: 'admin' }, '8');

    expect(error).toBeUndefined();
  });
});
