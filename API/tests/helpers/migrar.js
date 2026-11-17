// Reconstruye la base de pruebas con las migraciones, como en producción.
//
// El resto de la suite arma la base con `sequelize.sync`, que crea las tablas
// a partir de los modelos. Para probar una migración eso no sirve: los modelos
// declaran restricciones que producción no tiene, y justamente esa diferencia
// es lo que una migración corrige. Por eso aquí se borra todo el esquema y se
// ejecutan las migraciones en orden, igual que `sequelize-cli db:migrate`
// sobre una base vacía.

const fs = require('fs');
const path = require('path');
const { sequelize, Sequelize } = require('../../models');
const { assertSafeToWipe } = require('./safe-database');

const DIRECTORIO = path.join(__dirname, '..', '..', 'migrations');

const migraciones = () => fs.readdirSync(DIRECTORIO).filter((f) => f.endsWith('.js')).sort();

const cargar = (archivo) => require(path.join(DIRECTORIO, archivo));

const migrar = async (debeCorrer) => {
  assertSafeToWipe();
  await sequelize.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');

  const queryInterface = sequelize.getQueryInterface();
  for (const archivo of migraciones().filter(debeCorrer)) {
    await cargar(archivo).up(queryInterface, Sequelize);
  }
};

// Deja la base con todas las migraciones anteriores a `hasta`, sin incluirla.
const migrarHastaAntesDe = async (hasta) => {
  if (!migraciones().includes(hasta)) {
    throw new Error(`No existe la migración ${hasta}`);
  }
  await migrar((archivo) => archivo < hasta);
};

// Deja la base como la de producción, con todas las migraciones.
const migrarTodo = () => migrar(() => true);

module.exports = { migrarHastaAntesDe, migrarTodo, cargar };
