const ErrorHandler = require('../utils/error.util');

function validateParams(paramsSpec) {
  return function(req, res, next) {
    const errors = [];
    const forbidden = [];
    const params = []

    for (const [key, value] of Object.entries(paramsSpec)) {
      const paramValue = req.body[key];
      if (value.required && (paramValue == undefined || paramValue == null || paramValue == '')) {
        errors.push(`${key}`);
      }
      if (value.forbidden && (paramValue != undefined && paramValue != null && paramValue != '')) {
        forbidden.push(`${key}`);
      }
      if (paramValue != undefined && paramValue != null && paramValue != '') {
        params.push({ key, value: paramValue });
      }
    }

    if (errors.length > 0) {
      const missingParametersMessage = `Faltan parámetro(s) requerido(s): ${errors.join(', ')}`;
      throw new ErrorHandler({
        message: missingParametersMessage,
        code: 400,
      });
    }
    if (forbidden.length > 0) {
      const forbiddenParametersMessage = `Parámetro(s) prohibido(s) enviado(s): ${forbidden.join(', ')  }`;
      throw new ErrorHandler({
        message: forbiddenParametersMessage,
        code: 400,
      });
    }
    if (params.length === 0) {
      throw new ErrorHandler({
        message: 'No se enviaron parámetros validos. Porfavor envie al menos uno',
        code: 400,
      });
    }

    next();

  };
}

module.exports =  validateParams;