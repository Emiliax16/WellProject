const express = require('express');
const {
  requestLogger
} = require('./middlewares/placeholder.middleware');
const placeholderRoute = require('./routes/placeholder.route');
const wellRoute = require('./routes/well.route');
const wellDataRoute = require('./routes/wellData.route');

// App initialization
const app = express();

// Middlewares
app.use(express.json());
app.use(requestLogger);

// Rutas
app.use(placeholderRoute)
app.use(wellRoute);
app.use(wellDataRoute);

module.exports = app;
