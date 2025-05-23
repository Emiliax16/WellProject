const well = require("../../models/well");

const userNotFound = {
  code: 404,
  message: "El usuario no existe",
};

const passwordsDontMatch = {
  code: 400,
  message: "Contraseña incorrecta.",
};

const missingParams = {
  code: 400,
  message: "Faltan parametros.",
};

const unauthorized = {
  code: 401,
  message: "Recurso no autorizado.",
};

const missingToken = {
  code: 401,
  message: "Token no encontrado.",
};

const userHasNoClientAssociated = {
  code: 404,
  message: "El usuario no tiene un cliente asociado",
};

const clientNotFound = {
  code: 404,
  message: "El cliente no existe",
};

const wellNotFound = {
  code: 404,
  message: "El pozo no existe",
};

const wellDataDatesAreInvalid = {
  code: 400,
  message: "Las fechas para filtrar el reporte son inválidas",
};

const wellHasDataAssociated = {
  code: 400,
  message: "No se puede eliminar o editar un pozo con reportes asociados",
};

const passwordIsRequired = {
  code: 400,
  message: "La contraseña es requerida para esta operacion",
};

const clientHasNoUserOrPersonAssociated = {
  code: 404,
  message: "El cliente no tiene un usuario o persona asociada",
};

const trol = {
  code: 400,
  message: "you are a trol",
};

const badPasswordValidation = {
  code: 400,
  message: "La contraseña debe tener al menos 8 caracteres",
};

const newPasswordCantBeTheSame = {
  code: 400,
  message: "La nueva contraseña no puede ser igual a la anterior",
};

const wellDataHasInvalidData = {
  code: 400,
  message: "Los datos del pozo son inválidos",
};

const companyNotFound = {
  code: 404,
  message: "La empresa no existe",
};

const clientDoesntBelongToCompany = {
  code: 400,
  message: "El cliente no pertenece a esta compañia",
};

const bulkCreateWellDataIsNotArray = {
  code: 400,
  message: "Se esperaba un arreglo de reportes",
};

const couldntPostToDga = {
  code: 400,
  message:
    "No se pudo enviar los datos a la DGA. Por favor revisa bien los parámetros que estás enviando",
};

const distributorNotFound = {
  code: 404,
  message: "Distribuidora no encontrada",
};

const companyDoesntBelongToDistributor = {
  code: 400,
  message: "La compañia no pertenece a esta distribuidora",
};

const distributorHasNoUserOrPersonAssociated = {
  code: 404,
  message: "La distribuidora no tiene un usuario o persona asociada",
};

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
  wellHasDataAssociated,
  wellDataHasInvalidData,
  companyNotFound,
  clientDoesntBelongToCompany,
  wellDataDatesAreInvalid,
  bulkCreateWellDataIsNotArray,
  couldntPostToDga,
  distributorNotFound,
  companyDoesntBelongToDistributor,
  distributorHasNoUserOrPersonAssociated,
};
