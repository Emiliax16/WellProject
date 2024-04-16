const express = require('express');
const app = express();

// Middleware para parsear JSON
app.use(express.json());

// Ruta root
app.get('/', (req, res) => {
  res.send('Ruta raíz, holi que tal');
});

module.exports = app;
