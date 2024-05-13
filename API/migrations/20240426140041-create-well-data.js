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
        allowNull: false,
        max: 20,
        type: Sequelize.STRING,
        references : {
          model: 'wells',
          key: 'code'
        },
        onDelete: 'CASCADE'
      },
      date: {
        allowNull: false,
        isDate: true,
        type: Sequelize.STRING
      },
      hour: {
        allowNull: false,
        type: Sequelize.STRING
      },
      well_id: {
        type: Sequelize.INTEGER
      },
      totalizador: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      caudal: {
        allowNull: false,
        isDecimal: true,
        type: Sequelize.INTEGER
      },
      nivel_freatico: {
        allowNull: false,
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