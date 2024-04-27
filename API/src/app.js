const express = require('express');
const cors = require('cors');
const requestLogger = require('./middlewares/placeholder.middleware');
const errorHandler = require('./middlewares/error.middleware');
const placeholderRoute = require('./routes/placeholder.route');
const wellRoute = require('./routes/well.route');
const wellDataRoute = require('./routes/wellData.route');
const userRoute = require('./routes/user.route');

// App initialization
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Rutas
app.use(userRoute);
app.use(placeholderRoute)
app.use(wellRoute);
app.use(wellDataRoute);

// Middleware de manejo de errores
app.use(errorHandler);

module.exports = app;
