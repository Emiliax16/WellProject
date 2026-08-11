// Se queda sólo con los campos permitidos de un objeto.
//
// Existe porque `validate-params` no es un whitelist: comprueba los campos que
// declara y deja pasar intactos los que no. Así que cualquier `update(req.body)`
// o `create(req.body)` escribe cualquier columna del modelo, esté declarada o
// no. La lista de permitidos es lo que convierte eso en un filtro real.
//
// Se define en un solo lugar a propósito: había tres copias literales de esta
// función en los modelos, y una cuarta a punto de nacer en los pozos.
const soloCampos = (data, permitidos) =>
  Object.fromEntries(
    Object.entries(data || {}).filter(([campo]) => permitidos.includes(campo))
  );

module.exports = soloCampos;
