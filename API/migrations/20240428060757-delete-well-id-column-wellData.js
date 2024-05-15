'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.removeColumn(
      'wellData',
      'well_id'
    );
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'wellData',
      'well_id',
      {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'wells',
          key: 'id'
        }
      }
    );
  }
};
