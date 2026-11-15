require('dotenv').config()

// Sequelize imprime cada consulta SQL por defecto. En producción eso era la
// mayor parte del log de la API, que llegó a pesar 3 GB. Se puede volver a
// activar para diagnosticar con `DB_LOGGING=true`.
const logging = process.env.DB_LOGGING === 'true' ? console.log : false;

// Ojo: producción corre con NODE_ENV=development, y acá solo existen
// `development` y `test`. Si alguna vez se cambia NODE_ENV a `production`, hay
// que agregar antes esa configuración o la API no podrá conectarse a la base.
module.exports = {
    development: {
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
        host: process.env.DB_HOST,
        dialect: 'postgres',
        logging,
    },
    test: {
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: `${process.env.DB_NAME}_test`,
      port: process.env.DB_PORT,
      host: process.env.DB_HOST,
      dialect: 'postgres',
      logging,
    }
}
