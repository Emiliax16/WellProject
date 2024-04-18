'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('wellData', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      code: {
        type: Sequelize.STRING
      },
      date: {
        type: Sequelize.STRING
      },
      hour: {
        type: Sequelize.STRING
      },
      well_id: {
        type: Sequelize.INTEGER
      },
      totalizador: {
        type: Sequelize.INTEGER
      },
      caudal: {
        type: Sequelize.INTEGER
      },
      nivel_freatico: {
        type: Sequelize.INTEGER
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('wellData');
  }
};