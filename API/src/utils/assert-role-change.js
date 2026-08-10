const ErrorHandler = require('./error.util');
const { unauthorized } = require('./errorcodes.util');

// Sólo un admin puede cambiar el rol de una cuenta.
//
// Los formularios de edición del portal mandan `roleId` siempre, con el valor
// actual precargado en el selector. Por eso no se puede prohibir el campo a
// secas: hay que dejar pasar el que no cambia nada y rechazar sólo el cambio
// real. Si no, se rompe que una empresa edite a sus clientes.
//
// Sin esta comprobación, cualquier usuario que pueda editar una cuenta puede
// convertirla en admin, empezando por la suya: `updateDetails` aplica el body
// tal cual sobre el modelo `user`, y `validate-params` declara `roleId` como
// opcional en vez de prohibido.
const assertCanChangeRole = (requester, targetUser, body) => {
  if (body.roleId === undefined || body.roleId === null || body.roleId === '') {
    return;
  }

  // El body llega como JSON y el selector del portal manda strings.
  //
  // Se usa Number y no parseInt: parseInt lee un prefijo y descarta el resto,
  // así que `parseInt('2_0')` da 2 y la comprobación creería que el rol no
  // cambia. Postgres, en cambio, castea `'2_0'::integer` a 20 —admite el guion
  // bajo como separador de dígitos desde la versión 16—, así que se escribiría
  // un rol distinto del que se validó. Number rechaza esas cadenas enteras.
  const solicitado = Number(body.roleId);

  // Number('') es 0 y Number([1]) es 1, así que no basta con Number.isInteger:
  // se exige que el valor original sea un número o una cadena numérica.
  const esEntero =
    Number.isInteger(solicitado) &&
    (typeof body.roleId === 'number' || typeof body.roleId === 'string');

  if (!esEntero) {
    throw new ErrorHandler(unauthorized);
  }

  // Se normaliza el body para que lo que se persista sea exactamente el valor
  // que se acaba de validar, y no la cadena cruda que Postgres reinterpretaría.
  body.roleId = solicitado;

  if (solicitado === targetUser.roleId) {
    return;
  }

  if (requester.type !== 'admin') {
    throw new ErrorHandler(unauthorized);
  }
};

module.exports = assertCanChangeRole;
