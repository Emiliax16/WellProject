const { decodeToken } = require('../utils/auth.util');
const { unauthorized, missingToken } = require('../utils/errorcodes.util');
const ErrorHandler = require('../utils/error.util');

const extractToken = (req) => {
  const header = req.headers?.authorization;
  if (!header || typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
};

const authMiddleware = (...allowedRoles) => {
  const allowed = allowedRoles.flat();
  return (req, res, next) => {
    try {
      const token = extractToken(req);
      if (!token) throw new ErrorHandler(missingToken);

      const decoded = decodeToken(token);
      if (!decoded) throw new ErrorHandler(unauthorized);

      if (allowed.length > 0 && !allowed.includes(decoded.type)) {
        throw new ErrorHandler(unauthorized);
      }

      req.user = decoded;
      return next();
    } catch (err) {
      return next(err);
    }
  };
};

module.exports = authMiddleware;
