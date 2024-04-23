'use strict';

// Añadimos la columna "code" a la tabla wells para asociarla con wellData

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'wells',
      'code',
      {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      }
    );
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('Wells', 'code');
  }
};
