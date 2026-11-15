// Limitador en memoria por clave, con ventana fija.
//
// No se limita por IP: Nginx no reenvía la IP del cliente, así que para la API
// todas las peticiones llegan desde la misma dirección interna de Docker, y un
// límite por IP sería en la práctica un límite global. Cada uso elige su
// clave: el correo en el login, o una clave fija para un límite global.
//
// Vive en memoria del proceso: se reinicia con la API, lo que es aceptable para
// frenar abusos. La cantidad de claves está acotada para que nadie pueda
// agotar la memoria probando valores distintos.
const crearLimitador = ({ maximo, ventanaMs, maxClaves = 10_000 }) => {
  const registros = new Map(); // clave -> { cuenta, desde }

  const vigente = (clave, ahora) => {
    const registro = registros.get(clave);
    if (!registro) return null;
    if (ahora - registro.desde >= ventanaMs) {
      registros.delete(clave);
      return null;
    }
    return registro;
  };

  const hacerEspacio = (ahora) => {
    for (const [clave, registro] of registros) {
      if (ahora - registro.desde >= ventanaMs) registros.delete(clave);
    }
    // Si sigue lleno, se descarta la más antigua (el Map conserva el orden de
    // inserción).
    while (registros.size >= maxClaves) {
      registros.delete(registros.keys().next().value);
    }
  };

  return {
    bloqueado(clave) {
      const registro = vigente(clave, Date.now());
      return Boolean(registro && registro.cuenta >= maximo);
    },
    registrar(clave) {
      const ahora = Date.now();
      const registro = vigente(clave, ahora);
      if (registro) {
        registro.cuenta += 1;
        return;
      }
      if (registros.size >= maxClaves) hacerEspacio(ahora);
      registros.set(clave, { cuenta: 1, desde: ahora });
    },
    reiniciar(clave) {
      registros.delete(clave);
    },
    cantidadDeClaves: () => registros.size,
  };
};

module.exports = crearLimitador;
