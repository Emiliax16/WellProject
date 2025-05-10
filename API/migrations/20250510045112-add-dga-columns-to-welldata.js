"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("wellData", "rutEmpresa", {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.addColumn("wellData", "rutUsuario", {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.addColumn("wellData", "password", {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("wellData", "rutEmpresa");
    await queryInterface.removeColumn("wellData", "rutUsuario");
    await queryInterface.removeColumn("wellData", "password");
  },
};
