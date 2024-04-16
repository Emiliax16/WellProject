const express = require('express');
const app = express();

// Middleware para parsear JSON
app.use(express.json());

// Ruta root
app.get('/', (req, res) => {
  res.send('JIJI');
});

module.exports = app;
