const { decodeToken } = require('../utils/auth.util');
const { unauthorized, missingToken } = require('../utils/errorcodes.util');
const ErrorHandler = require('../utils/error.util');

const authMiddleware = (...role) => {
  return async (req, res, next) => {
    try {
      if (!req.headers.authorization) {
        throw new ErrorHandler(missingToken);
      }
      const token = req.headers.authorization.split(' ')[1];
      const decoded = decodeToken(token);
      if (!decoded) {
        throw new ErrorHandler(unauthorized);
      }
      console.log(decoded.type);
      if (role.length > 0 && !role.includes(decoded.type)) {
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

