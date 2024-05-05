const userNotFound = {
  code: 404,
  message: 'El usuario no existe',
}

const passwordsDontMatch = {
  code: 400,
  message: 'Contraseña incorrecta.',
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

const clientNotFound = {
  code: 404,
  message: 'El cliente no existe',
}


const wellNotFound = {
  code: 404,
  message: 'El pozo no existe',
}

const passwordIsRequired = {
  code: 400,
  message: 'La contraseña es requerida para esta operacion',
}

const clientHasNoUserOrPersonAssociated = {
  code: 404,
  message: 'El cliente no tiene un usuario o persona asociada',
}

const trol = {
  code: 400,
  message: 'you are a trol',
}

const badPasswordValidation = {
  code: 400,
  message: 'La contraseña debe tener al menos 8 caracteres',
}

const newPasswordCantBeTheSame = {
  code: 400,
  message: 'La nueva contraseña no puede ser igual a la anterior',
}

module.exports = {
  userNotFound,
  missingParams,
  missingToken,
  passwordsDontMatch,
  unauthorized,
  userHasNoClientAssociated,
  wellNotFound,
  clientNotFound,
  passwordIsRequired,
  clientHasNoUserOrPersonAssociated,
  trol,
  badPasswordValidation,
  newPasswordCantBeTheSame,
}