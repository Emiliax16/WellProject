// Guard para los tests que destruyen datos.
//
// `sequelize.sync({ force: true })` elimina y recrea todas las tablas de la
// base a la que esté apuntando la conexión. Qué base es eso lo decide
// `models/index.js` con `process.env.NODE_ENV || 'development'`, y el `.env`
// del proyecto fija `NODE_ENV=development`. Sin este guard, un `npx jest` sin
// filtro vacía la base de desarrollo, y dentro de la instancia vaciaría la de
// producción.
//
// La regla es que borrar sólo se permite cuando las dos condiciones se cumplen:
// el entorno es `test`, y el nombre de la base termina en `_test`. Se exigen
// las dos a propósito: la primera se puede sobreescribir por accidente desde el
// shell, y la segunda es la que de verdad protege la base equivocada.

const { sequelize } = require('../../models');

const assertSafeToWipe = () => {
  const base = sequelize.config.database;
  const host = sequelize.config.host;
  const entorno = process.env.NODE_ENV;

  const problemas = [];
  if (entorno !== 'test') {
    problemas.push(`NODE_ENV es "${entorno}" y tiene que ser "test"`);
  }
  if (!/_test$/.test(base || '')) {
    problemas.push(`la base es "${base}" y su nombre tiene que terminar en "_test"`);
  }

  if (problemas.length > 0) {
    throw new Error(
      [
        '',
        '⛔ Test destructivo detenido: iba a borrar todas las tablas de una base que no es de pruebas.',
        '',
        `   destino:  ${base}@${host}`,
        ...problemas.map((p) => `   problema: ${p}`),
        '',
        '   Para correr los tests que tocan la base:',
        '     createdb wellproject_dev_test',
        '     npm test',
        '',
        '   `npm test` ya fija NODE_ENV=test. Si lo sobreescribiste a mano, quítalo.',
        '',
      ].join('\n')
    );
  }

  return { base, host };
};

module.exports = { assertSafeToWipe };
