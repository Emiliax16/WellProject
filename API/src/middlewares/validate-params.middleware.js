const ErrorHandler = require('../utils/error.util');

function validateParams(paramsSpec) {
  return function(req, res, next) {
    const errors = [];

    for (const [key, value] of Object.entries(paramsSpec)) {
      const paramValue = req.body[key];
      if (value.required && (paramValue === undefined || paramValue === null || paramValue === '')) {
        errors.push(`${key}`);
      }
    }

    if (errors.length > 0) {
      const message = `Faltan parametro(s) requerido(s): ${errors.join(', ')}`;
      throw new ErrorHandler({
        message: message,
        code: 400,
      });
    }
    next();
  };
}

module.exports =  validateParams;