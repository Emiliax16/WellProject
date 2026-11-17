"use strict";

// Agrega las tres foreign keys que faltaban en la base (#83).
//
// Los modelos declaran estas asociaciones, pero ninguna migración creó la
// restricción, así que Postgres aceptaba una empresa o una distribuidora cuyo
// usuario ya no existe, y un usuario con un `roleId` inventado. El `onDelete`
// de un modelo solo tiene efecto si la restricción existe en la base.
//
// Qué hace cada una al borrar la fila referenciada:
//
// - `companies.userId` y `distributors.userId`: CASCADE, como declaran los
//   modelos y como ya funcionan `clients.userId` y `people.userId`. Los
//   controladores borran la empresa o la distribuidora antes que su usuario,
//   así que por esa vía nada cambia; lo que cambia es que borrar el usuario por
//   cualquier otro camino ya no deja la cuenta huérfana.
// - `users.roleId`: RESTRICT. Un rol en uso no se puede borrar. Con CASCADE,
//   borrar un rol se llevaría a todos sus usuarios y, en cadena, a sus
//   empresas, clientes, pozos y reportes.
//
// Si hay filas huérfanas, la migración se detiene y las lista sin tocar nada.
// No las borra por su cuenta: una empresa huérfana puede tener clientes y
// pozos colgando, y borrarla los arrastraría en cascada. Hay que revisarlas una
// por una antes de volver a correrla.

const FOREIGN_KEYS = [
  {
    tabla: "companies",
    columna: "userId",
    nombre: "companies_userId_fkey",
    referencia: { table: "users", field: "id" },
    onDelete: "CASCADE",
  },
  {
    tabla: "distributors",
    columna: "userId",
    nombre: "distributors_userId_fkey",
    referencia: { table: "users", field: "id" },
    onDelete: "CASCADE",
  },
  {
    tabla: "users",
    columna: "roleId",
    nombre: "users_roleId_fkey",
    referencia: { table: "roles", field: "id" },
    onDelete: "RESTRICT",
  },
];

const buscarHuerfanos = async (queryInterface, transaction) => {
  const encontrados = [];
  for (const fk of FOREIGN_KEYS) {
    const [filas] = await queryInterface.sequelize.query(
      `SELECT h.id, h."${fk.columna}" AS ref
         FROM "${fk.tabla}" h
         LEFT JOIN "${fk.referencia.table}" r ON r."${fk.referencia.field}" = h."${fk.columna}"
        WHERE h."${fk.columna}" IS NOT NULL AND r."${fk.referencia.field}" IS NULL
        ORDER BY h.id`,
      { transaction }
    );
    for (const fila of filas) {
      encontrados.push(`${fk.tabla}.id=${fila.id} (${fk.columna}=${fila.ref})`);
    }
  }
  return encontrados;
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  FOREIGN_KEYS,

  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const huerfanos = await buscarHuerfanos(queryInterface, transaction);
      if (huerfanos.length > 0) {
        throw new Error(
          `No se agregaron las foreign keys: hay filas que apuntan a un registro inexistente. ` +
            `Revisarlas una por una antes de volver a migrar: ${huerfanos.join(", ")}`
        );
      }

      for (const fk of FOREIGN_KEYS) {
        await queryInterface.addConstraint(fk.tabla, {
          fields: [fk.columna],
          type: "foreign key",
          name: fk.nombre,
          references: fk.referencia,
          onDelete: fk.onDelete,
          onUpdate: "CASCADE",
          transaction,
        });
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const fk of FOREIGN_KEYS) {
        await queryInterface.removeConstraint(fk.tabla, fk.nombre, { transaction });
      }
    });
  },
};
