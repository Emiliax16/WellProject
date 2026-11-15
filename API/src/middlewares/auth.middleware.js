const { decodeToken } = require('../utils/auth.util');
const { unauthorized, missingToken } = require('../utils/errorcodes.util');
const ErrorHandler = require('../utils/error.util');
const db = require('../../models');

// El token dura 24 h y trae el id y el rol del momento del login. Sin revisar
// la base, un usuario borrado, desactivado o con el rol cambiado seguía
// operando hasta que el token venciera, y una cuenta desactivada podía incluso
// reactivarse a sí misma editando su `isActived`. Por eso, en cada petición se
// comprueba que el usuario exista, que esté activo y cuál es su rol actual, y
// es ese rol, no el del token, el que se usa para autorizar.
//
// La regla de activo es la misma del login: un admin inactivo puede entrar.
const usuarioVigente = async (id) => {
  const usuario = await db.user.findByPk(id, { attributes: ['id', 'isActived', 'roleId'] });
  if (!usuario) return null;
  const rol = await usuario.getRole();
  if (!rol) return null;
  if (rol.type !== 'admin' && !usuario.isActived) return null;
  return { id: usuario.id, type: rol.type };
};

const authMiddleware = (...role) => {
  return async (req, res, next) => {
    try {
      // TODO: eliminar el fallback al body sólo cuando estos services del portal
      // dejen de mandar el token ahí. Ninguno está migrado todavía:
      //   wellServices.activateWell, companyServices (crear y editar),
      //   clientServices (crear y editar), distributorService (crear y editar).
      // El PR WellProjectFront#38 los cubre; #40 no, ese resuelve otra cosa.
      const base = req.headers.authorization || req.body?.headers?.Authorization;
      if (!base) {
        throw new ErrorHandler(missingToken);
      }
      const token = base.split(' ')[1];
      if (!token) {
        throw new ErrorHandler(missingToken);
      }
      const decoded = decodeToken(token);
      if (!decoded) {
        throw new ErrorHandler(unauthorized);
      }

      const usuario = await usuarioVigente(decoded.id);
      if (!usuario) {
        throw new ErrorHandler(unauthorized);
      }

      let userRoles = Array.isArray(role) ? role.flat() : [role];

      if (role.length > 0 && !userRoles.includes(usuario.type)) {
        throw new ErrorHandler(unauthorized);
      }
      req.user = { ...decoded, ...usuario };
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = authMiddleware;

