// Estado de la última corrida del reintento a la DGA, en memoria.
//
// Lo escribe `dga-retry.js` y lo lee la alerta de las 08:00 para no afirmar
// algo que no pasó: si el reintento de hoy no corrió, sigue en curso o se
// quedó en el máximo de envíos, el correo lo dice. Se pierde al reiniciar la
// API, y en ese caso la alerta informa que no hay registro de la corrida.

let ultimaCorrida = null;

const iniciarCorrida = ({ inicio, pendientes, alcanzoElMaximo }) => {
  ultimaCorrida = {
    inicio,
    terminada: false,
    pendientes,
    alcanzoElMaximo,
    aceptados: 0,
    fallidos: 0,
    omitidos: 0,
    error: null,
  };
  return ultimaCorrida;
};

const terminarCorrida = ({ error = null } = {}) => {
  if (ultimaCorrida) {
    ultimaCorrida.terminada = true;
    ultimaCorrida.error = error;
  }
};

// Copia, para que quien lee no pueda modificar el estado.
const leerUltimaCorrida = () => (ultimaCorrida ? { ...ultimaCorrida } : null);

const reiniciar = () => {
  ultimaCorrida = null;
};

module.exports = { iniciarCorrida, terminarCorrida, leerUltimaCorrida, _internal: { reiniciar } };
