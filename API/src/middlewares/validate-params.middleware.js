const ErrorHandler = require('../utils/error.util');

function validateParams(paramsSpec, registerUser = false) {
  return function(req, res, next) {
    const errors = [];
    const forbidden = [];
    const params = []

    // Si la validación proviene del registro de usuarios, es necesario
    // hacer una excepción, puesto que si el usuario es normal o admin, se
    // necesitan parámetros de Person, pero si es empresa, se necesitan parámetros
    // de Company
    if (registerUser) {
      if (req.body.roleType === 'admin' || req.body.roleType === 'normal') {
        // excluir campos específicos de Company
        delete paramsSpec.companyLogo;
        delete paramsSpec.companyRut;
        delete paramsSpec.recoveryEmail;
      } else if (req.body.roleType === 'company') {
        // excluir campos específicos de Person
        delete paramsSpec.fullName;
        delete paramsSpec.location;
        delete paramsSpec.phoneNumber;
        delete paramsSpec.personalEmail;
      }
    }

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