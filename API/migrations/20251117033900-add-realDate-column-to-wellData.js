'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('wellData', 'realDate', {
      type: Sequelize.DATEONLY,
      allowNull: true,
      comment: 'Fecha en formato DATE para filtros y consultas. Se rellena automáticamente desde el campo date (string)'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('wellData', 'realDate');
  }
};
