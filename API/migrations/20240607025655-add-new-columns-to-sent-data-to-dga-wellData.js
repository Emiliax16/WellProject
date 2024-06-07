'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'wellData',
      'sent',
      {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }
    );

    await queryInterface.addColumn(
      'wellData',
      'sentDate',
      {
        type: Sequelize.STRING,
        allowNull: true
      }
    );
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn(
      'wellData',
      'sent'
    );

    await queryInterface.removeColumn(
      'wellData',
      'sentDate'
    );
  }
};
