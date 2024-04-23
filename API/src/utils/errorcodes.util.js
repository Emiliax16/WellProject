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

module.exports = {
  userNotFound,
  missingParams,
  passwordsDontMatch,
}