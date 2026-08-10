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
  const solicitado = parseInt(body.roleId, 10);

  if (Number.isNaN(solicitado)) {
    throw new ErrorHandler(unauthorized);
  }

  if (solicitado === targetUser.roleId) {
    return;
  }

  if (requester.type !== 'admin') {
    throw new ErrorHandler(unauthorized);
  }
};

module.exports = assertCanChangeRole;
