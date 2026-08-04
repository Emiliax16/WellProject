const { decodeToken } = require('../utils/auth.util');
const { unauthorized, missingToken } = require('../utils/errorcodes.util');
const ErrorHandler = require('../utils/error.util');

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

      let userRoles = Array.isArray(role) ? role.flat() : [role];

      if (role.length > 0 && !userRoles.includes(decoded.type)) {
        throw new ErrorHandler(unauthorized);
      }
      req.user = decoded;
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = authMiddleware;

