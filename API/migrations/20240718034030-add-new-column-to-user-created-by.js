'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'users',
      'createdBy',
      {
        type: Sequelize.INTEGER,
        allowNull: true,
        unique: false
      }
    );
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'createdBy');
  }
};
