const userNotFound = {
  code: 404,
  message: 'El usuario no existe',
}

const passwordsDontMatch = {
  code: 400,
  message: 'Las contraseñas no coinciden',
}

const missingParams = {
  code: 400,
  message: 'Faltan parametros.',
}

const unauthorized = {
  code: 401,
  message: 'Recurso no autorizado.',
}

const missingToken = {
  code: 401,
  message: 'Token no encontrado.',
}

const userHasNoClientAssociated = {
  code: 404,
  message: 'El usuario no tiene un cliente asociado',
}

const wellNotFound = {
  code: 404,
  message: 'El pozo no existe',
}

module.exports = {
  userNotFound,
  missingParams,
  missingToken,
  passwordsDontMatch,
  unauthorized,
  userHasNoClientAssociated,
  wellNotFound,
}