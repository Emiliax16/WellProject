const ErrorHandler = require('../utils/error.util');
const {
  userNotFound
} = require("../utils/errorcodes.util");
const db = require("../../models");
const Role = db.role;

// Resuelve el tipo de rol a partir del body, sin dejar que un valor mal formado
// tumbe el proceso.
//
// `Role.findByPk(req.body.roleId)` con un valor no entero hace que Postgres
// rechace la consulta, y el error quedaba como rejection sin capturar dentro de
// un middleware async: Node mataba el proceso. Como este bloque corre en todas
// las rutas que usan el middleware —incluida `POST /users/login`, que es
// pública—, bastaba una petición anónima para dejar la API caída.
//
// Se usa `Number` y no `parseInt` porque `parseInt('2_0')` da 2 mientras
// Postgres castea `'2_0'::integer` a 20. Mismo criterio que en
// `assert-role-change.js`.
const resolverTipoDeRol = async (body) => {
  if (body.roleType) {
    return body.roleType;
  }

  const { roleId } = body;
  if (roleId === undefined || roleId === null || roleId === '') {
    return undefined;
  }

  const id = Number(roleId);
  const esEntero =
    Number.isInteger(id) && (typeof roleId === 'number' || typeof roleId === 'string');

  if (!esEntero) {
    throw new ErrorHandler({ message: 'El parámetro roleId no es válido', code: 400 });
  }

  // Se normaliza en el body para que el controlador reciba el entero validado
  // y no la cadena cruda, igual que hace `assert-role-change.js`.
  body.roleId = id;

  const role = await Role.findByPk(id);
  return role?.type;
};

function validateParams(paramsSpec, registerUser = false) {
  return async function (req, res, next) {
    try {
      const errors = [];
      const forbidden = [];
      const params = []

      // No loguear `req.body`: este middleware corre en /users/login y
      // /users/register (contraseña del usuario en texto plano) y en la
      // creación y edición de pozos (credenciales DGA).

      const type = await resolverTipoDeRol(req.body);

      // Se trabaja sobre una copia. `paramsSpec` es un objeto de módulo que se
      // pasa una sola vez al definir la ruta, así que los `delete` de abajo lo
      // mutaban de forma permanente: tras la primera alta de una empresa, el
      // spec perdía `fullName`, `location`, `phoneNumber` y `personalEmail`, y
      // a partir de ahí registrar un cliente ya no los exigía. La validación se
      // debilitaba sola y dependía del orden de las peticiones.
      const spec = { ...paramsSpec };

      // Si la validación proviene del registro de usuarios, es necesario
      // hacer una excepción, puesto que si el usuario es normal o admin, se
      // necesitan parámetros de Person, pero si es empresa, se necesitan parámetros
      // de Company
      if (registerUser) {
        if (type == 'admin' || type == 'normal') {
          // excluir campos específicos de Company
          delete spec.companyLogo;
          delete spec.companyRut;
          delete spec.recoveryEmail;
        } else if (type === 'company') {
          // excluir campos específicos de Person
          delete spec.fullName;
          delete spec.location;
          delete spec.phoneNumber;
          delete spec.personalEmail;
        } else if (type === 'distributor') {
          // excluir campos específicos de Person
          delete spec.fullName;
          delete spec.location;
          delete spec.phoneNumber;
          delete spec.personalEmail;
        }
      }

      for (const [key, value] of Object.entries(spec)) {
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
        const forbiddenParametersMessage = `Parámetro(s) prohibido(s) enviado(s): ${forbidden.join(', ')}`;
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

      // Un solo `next()`, y sólo si la validación pasó. Antes el `catch`
      // llamaba a `next(error)` y la ejecución seguía hasta un `next()` final,
      // así que una petición inválida respondía 400 y ADEMÁS continuaba al
      // controlador. El controlador intentaba responder sobre una respuesta ya
      // cerrada, que es el `ERR_HTTP_HEADERS_SENT` que mató el proceso en el
      // incidente de agosto.
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = validateParams;
