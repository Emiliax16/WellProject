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
const distributorRoute = require('./routes/distributor.route');
const statsRoute = require('./routes/stats.route');
const activityLogRoute = require('./routes/activityLog.route');
const monitoringRoute = require('./routes/monitoring.route');
const healthRoute = require('./routes/health.route');

// App initialization
const app = express();

// Va antes del logger de peticiones: el healthcheck de Docker la llama cada
// minuto y llenaría el log de líneas iguales.
app.use(healthRoute);

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(requestLogger);

// Rutas
app.use(userRoute);
app.use(clientRoute);
app.use(placeholderRoute)
app.use(wellRoute);
app.use(wellDataRoute);
app.use(companyRoute);
app.use(distributorRoute);
app.use(statsRoute);
app.use(activityLogRoute);
app.use(monitoringRoute);


// Ruta formulario de contacto
app.use(contactRoute);

// Cualquier ruta no registrada responde JSON, igual que el resto de la API, en
// vez del HTML por defecto de Express. Va después de todas las rutas y antes
// del middleware de errores.
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' });
});

// Middleware de manejo de errores
app.use(errorHandler);

module.exports = app;
