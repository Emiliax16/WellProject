const soloCampos = require('./only-fields.util');

// Los campos de un pozo que sí pueden salir en una respuesta HTTP.
//
// Es un allowlist y no una lista de exclusiones a propósito. Excluir
// `password`, `rutEmpresa` y `rutUsuario` funciona hoy, pero la siguiente
// columna sensible que alguien agregue al modelo sale publicada sin que nadie
// toque este archivo. Con un allowlist, lo que se agrega queda fuera hasta que
// se decida lo contrario.
//
// Deja fuera dos cosas distintas:
//
// - Las credenciales DGA. No se pueden rotar —el MOP las entrega una vez— así
//   que la regla es que no aparezcan en respuestas por ninguna vía, ni siquiera
//   por las que exigen sesión.
// - Las asociaciones (`client`, y debajo `company` y `distributor`). En
//   `activeOrDesactiveWell` se cargan para armar el registro de actividad, no
//   para el consumidor, y arrastran el `encrypted_password` de cada usuario
//   porque el `include` no excluye atributos.
//
// Ojo con el alcance: los listados por cliente (`/clients/:id/wells`) y el
// detalle de un pozo siguen devolviendo `rutEmpresa` y `rutUsuario` a propósito,
// porque `wellForm.js` los rellena con `defaultValue` desde esa respuesta.
//
// `password` no sale nunca en claro. En esas rutas va enmascarado con
// `conClaveDgaOculta`, porque el portal solo necesita saber si existe: habilita
// el botón de activar con `Boolean(rutEmpresa && rutUsuario && password)`
// (`ClientWells.js` y `WellRow.js`).
const CAMPOS_PUBLICOS_WELL = [
  'id', 'code', 'name', 'location', 'clientId', 'isActived', 'editStatusDate',
  'createdAt', 'updatedAt',
];

// Recibe una instancia de Sequelize o un objeto plano.
//
// El paso por `toJSON` no es cosmético: una instancia guarda las columnas en
// `dataValues`, detrás de getters del prototipo, así que filtrar el objeto
// directamente devuelve `{}`. `toJSON` es además lo que aplicaría Express al
// serializar, o sea que el filtro opera exactamente sobre lo que vería el
// cliente.
const respuestaDePozo = (well) => {
  // Un array entraría por el camino del objeto plano y saldría como `{}`, sin
  // error: un listado se vaciaría en silencio. Mejor que falle acá.
  if (Array.isArray(well)) {
    throw new TypeError('respuestaDePozo recibe un pozo, no un listado');
  }
  return soloCampos(typeof well?.toJSON === 'function' ? well.toJSON() : well, CAMPOS_PUBLICOS_WELL);
};

// Lo que reemplaza a la contraseña DGA en las respuestas cuando el pozo tiene
// una guardada. El controlador de edición la ignora si vuelve en un body, para
// que nunca termine guardada como contraseña.
const MASCARA_CLAVE_DGA = '********';

// Devuelve el pozo como objeto plano con `password` enmascarado. Si el pozo no
// tiene contraseña, conserva el valor vacío tal cual, para que el portal siga
// distinguiendo un pozo sin credencial.
const conClaveDgaOculta = (well) => {
  if (Array.isArray(well)) {
    throw new TypeError('conClaveDgaOculta recibe un pozo, no un listado');
  }
  const plano = typeof well?.toJSON === 'function' ? well.toJSON() : { ...well };
  if (plano.password) {
    plano.password = MASCARA_CLAVE_DGA;
  }
  return plano;
};

module.exports = { respuestaDePozo, conClaveDgaOculta, MASCARA_CLAVE_DGA, CAMPOS_PUBLICOS_WELL };
