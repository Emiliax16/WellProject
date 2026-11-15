const express = require('express');
const db = require('../../models');

const router = express.Router();

// Tiempo máximo para que la base responda. El healthcheck de Docker espera 5 s
// por respuesta, así que esto tiene que quedar por debajo.
const LIMITE_MS = 3000;

const conLimite = (promesa, ms) => {
  let temporizador;
  const limite = new Promise((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new Error('timeout')), ms);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(temporizador));
};

// Responde 200 si la API está viva y la base responde, y 503 si no. Lo usan el
// healthcheck de docker-compose y, si se configura, un monitor externo.
//
// Es pública y no devuelve ningún detalle (ni mensajes de error, ni versiones,
// ni nombres de host), porque cualquiera puede llamarla.
router.get('/health', async (req, res) => {
  try {
    await conLimite(db.sequelize.authenticate(), LIMITE_MS);
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    res.status(503).json({ status: 'error' });
  }
});

module.exports = router;
