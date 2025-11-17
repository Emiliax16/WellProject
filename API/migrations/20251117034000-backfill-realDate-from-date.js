'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Rellenar realDate según el formato de la columna "date"
    await queryInterface.sequelize.query(`
      UPDATE "wellData"
      SET "realDate" = CASE
        -- Formato DGA: DD/MM/YYYY
        WHEN "date" ~ '^[0-3][0-9]/[0-1][0-9]/[0-9]{4}$'
          THEN TO_DATE("date", 'DD/MM/YYYY')
        -- Formato ISO: YYYY-MM-DD
        WHEN "date" ~ '^[0-9]{4}-[0-1][0-9]-[0-3][0-9]$'
          THEN TO_DATE("date", 'YYYY-MM-DD')
        -- Otros formatos raros: los dejamos en NULL para revisarlos aparte
        ELSE NULL
      END
      WHERE "date" IS NOT NULL
        AND "realDate" IS NULL;
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE "wellData"
      SET "realDate" = NULL;
    `);
  }
};
