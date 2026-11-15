const express = require('express');
const db = require('../../models');

const router = express.Router();

// Tiempo máximo para que la base responda. El healthcheck de Docker espera 5 s
// por respuesta, así que esto tiene que quedar por debajo.
const LIMITE_MS = 3000;

// La ruta es pública. Para que una ráfaga de llamadas no compita con las
// peticiones reales por el pool de conexiones, las llamadas simultáneas
// comparten la misma consulta y el resultado se reutiliza durante unos
// segundos.
const VIGENCIA_MS = 5000;

const conLimite = (promesa, ms) => {
  let temporizador;
  const limite = new Promise((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new Error('timeout')), ms);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(temporizador));
};

let consultaEnCurso = null;
let ultimoResultado = null; // { ok: boolean, en: number }

const baseDisponible = () => {
  if (ultimoResultado && Date.now() - ultimoResultado.en < VIGENCIA_MS) {
    return Promise.resolve(ultimoResultado.ok);
  }
  if (!consultaEnCurso) {
    consultaEnCurso = conLimite(db.sequelize.authenticate(), LIMITE_MS)
      .then(() => true, () => false)
      .then((ok) => {
        ultimoResultado = { ok, en: Date.now() };
        consultaEnCurso = null;
        return ok;
      });
  }
  return consultaEnCurso;
};

// Responde 200 si la API está viva y la base responde, y 503 si no. Lo usan el
// healthcheck de docker-compose y, si se configura, un monitor externo.
//
// No devuelve ningún detalle (ni mensajes de error, ni versiones, ni nombres
// de host), porque cualquiera puede llamarla.
router.get('/health', async (req, res) => {
  const ok = await baseDisponible();
  res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'error' });
});

// Solo para tests: olvida el resultado guardado.
router._reiniciar = () => {
  consultaEnCurso = null;
  ultimoResultado = null;
};

module.exports = router;
