const express = require('express');
const cors = require('cors');
const requestLogger = require('./middlewares/placeholder.middleware');
const errorHandler = require('./middlewares/error.middleware');
const placeholderRoute = require('./routes/placeholder.route');
const wellRoute = require('./routes/well.route');
const wellDataRoute = require('./routes/wellData.route');
const userRoute = require('./routes/user.route');
const clientRoute = require('./routes/client.route');
const contactRoute = require('./routes/contact.route');
const companyRoute = require('./routes/company.route');

// App initialization
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Rutas
app.use(userRoute);
app.use(clientRoute);
app.use(placeholderRoute)
app.use(wellRoute);
app.use(wellDataRoute);
app.use(companyRoute);

// Ruta formulario de contacto
app.use(contactRoute);

// Middleware de manejo de errores
app.use(errorHandler);

module.exports = app;
