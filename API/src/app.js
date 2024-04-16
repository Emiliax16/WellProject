const express = require('express');
const {
  requestLogger
} = require('./middlewares/placeholder.middleware');
const placeholderRoute = require('./routes/placeholder.route');

// App initialization
const app = express();

// Middlewares
app.use(express.json());
app.use(requestLogger);

// Rutas
app.use(placeholderRoute)

module.exports = app;
