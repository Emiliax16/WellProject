"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("wells", "rutEmpresa", {
      type: Sequelize.STRING,
    });
    await queryInterface.addColumn("wells", "rutUsuario", {
      type: Sequelize.STRING,
    });
    await queryInterface.addColumn("wells", "password", {
      type: Sequelize.STRING,
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("wells", "rutEmpresa");
    await queryInterface.removeColumn("wells", "rutUsuario");
    await queryInterface.removeColumn("wells", "password");
  },
};
