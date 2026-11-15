const crypto = require('crypto');
const ErrorHandler = require('../utils/error.util');
const { invalidInternalKey } = require('../utils/errorcodes.util');

// Protege las rutas que solo debe llamar otro servicio del sistema, como el
// SENDER: exige el header `X-Internal-Api-Key` igual a `INTERNAL_API_KEY`.
//
// No se usa el JWT porque esos servicios no tienen usuario. Tampoco sirve
// distinguir por red: Nginx no reenvía la IP de origen, y desde la API una
// llamada externa y una del SENDER se ven iguales.
//
// Falla cerrado. Si la variable no está definida o es demasiado corta para ser
// una clave real, rechaza todo: un servidor mal configurado queda cerrado, no
// abierto. Se genera con `openssl rand -hex 32`.
const LARGO_MINIMO = 32;

let avisoDeConfiguracion = false;

// Se comparan los hash y no las claves: `timingSafeEqual` exige buffers del
// mismo largo, y comparar los hash evita además que el tiempo de respuesta
// delate el largo de la clave.
const sonIguales = (recibida, esperada) => {
  const a = crypto.createHash('sha256').update(recibida).digest();
  const b = crypto.createHash('sha256').update(esperada).digest();
  return crypto.timingSafeEqual(a, b);
};

const internalKeyMiddleware = (req, res, next) => {
  const esperada = process.env.INTERNAL_API_KEY;

  if (!esperada || esperada.length < LARGO_MINIMO) {
    if (!avisoDeConfiguracion) {
      console.error(
        `[internal-key] INTERNAL_API_KEY no está definida o tiene menos de ${LARGO_MINIMO} caracteres: se rechazan todas las llamadas internas`
      );
      avisoDeConfiguracion = true;
    }
    return next(new ErrorHandler(invalidInternalKey));
  }

  const recibida = req.get('X-Internal-Api-Key');
  if (typeof recibida !== 'string' || !sonIguales(recibida, esperada)) {
    return next(new ErrorHandler(invalidInternalKey));
  }

  return next();
};

module.exports = internalKeyMiddleware;
