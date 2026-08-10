const { ValidationError, ConnectionError, DatabaseError } = require('sequelize');
const ErrorHandler = require('../utils/error.util');

const enProduccion = process.env.NODE_ENV === 'production';

const errorHandler = (err, req, res, next) => {
  // Si la respuesta ya salió, intentar responder de nuevo lanza
  // ERR_HTTP_HEADERS_SENT, que sin handler de proceso mata la aplicación. Es
  // el patrón que tumbó producción en agosto de 2026. Se delega en Express
  // para que cierre el socket sin un segundo envío.
  if (res.headersSent) {
    return next(err);
  }

  // No se loguea `req.body`: este middleware ve /users/login (contraseñas) y la
  // creación de pozos (credenciales DGA). El stack sólo fuera de producción.
  console.error(JSON.stringify({
    level: 'error',
    msg: err.message,
    name: err.name,
    method: req.method,
    url: req.originalUrl,
    stack: enProduccion ? undefined : err.stack,
    at: new Date().toISOString(),
  }));

  if (err instanceof ValidationError) {
    const messages = err.errors.map((error) => error.message);
    return res.status(400).json({ errors: messages });
  }

  // `ErrorHandler` son los errores que el propio código levanta a propósito, con
  // un mensaje pensado para la persona que usa el portal ("Contraseña
  // incorrecta.", "Recurso no autorizado."). El portal los muestra tal cual
  // (`userForm.js` lee `error.response.data.error`), así que se conservan.
  //
  // `statusCode` puede venir indefinido si se construye con un objeto sin
  // `code`; sin este respaldo, `res.status(undefined)` lanza.
  if (err instanceof ErrorHandler) {
    return res.status(err.statusCode || 500).json({ error: err.message });
  }

  // Los de Sequelize, en cambio, son internos: sus mensajes traen SQL, nombres
  // de columna y a veces valores. Se responde con un texto genérico.
  if (err instanceof ConnectionError) {
    return res.status(503).json({ error: 'Servicio no disponible. Intenta nuevamente en unos minutos.' });
  }

  if (err instanceof DatabaseError) {
    return res.status(400).json({ error: 'La solicitud no es válida.' });
  }

  return res.status(500).json({ error: 'Ocurrió un error inesperado.' });
};

module.exports = errorHandler;
