'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('companies', 'companyLogo', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('companies', 'companyRut', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('companies', 'companyLogo');
    await queryInterface.removeColumn('companies', 'companyRut');
  }
};
