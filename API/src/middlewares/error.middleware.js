const { ValidationError, ConnectionError, DatabaseError } = require('sequelize');
const ErrorHandler = require('../utils/error.util');

const errorHandler = (err, req, res, next) => {
  console.log(err)
  console.log(`Error 🚨 | ${err.message} while sending a ${req.method} to ${req.originalUrl}`);
  if (err instanceof ValidationError) {
    const messages = err.errors.map((error) => error.message);
    return res.status(400).json({ errors: messages });
  }

  if (err instanceof ErrorHandler) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  if (err instanceof ConnectionError) {
    return res.status(500).json({ error: err.message });
  }

  if (err instanceof DatabaseError) {
    return res.status(400).json({ error: err.message });
  }

  return res.status(500).json({ error: err.message });
};

module.exports = errorHandler