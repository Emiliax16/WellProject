const { ValidationError, ConnectionError, DatabaseError } = require('sequelize');
const ErrorHandler = require('../utils/error.util');


const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    // Si los headers ya se enviaron, delegamos al default de Express
    // para que cierre el socket sin intentar un segundo res.send.
    return next(err);
  }

  console.error(JSON.stringify({
    level: 'error',
    method: req.method,
    url: req.originalUrl,
    name: err.name,
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  }));

  if (err instanceof ErrorHandler) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  if (err instanceof ValidationError) {
    const messages = err.errors.map((error) => error.message);
    return res.status(400).json({ errors: messages });
  }

  if (err instanceof DatabaseError) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  if (err instanceof ConnectionError) {
    return res.status(503).json({ error: 'Service unavailable' });
  }

  const isProd = process.env.NODE_ENV === 'production';
  return res.status(500).json({
    error: isProd ? 'Internal server error' : err.message,
  });
};

module.exports = errorHandler
