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
    //agregar tambien estas phoneNumber, recoveryEmail, location
    await queryInterface.addColumn('companies', 'phoneNumber', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('companies', 'recoveryEmail', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('companies', 'location', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('companies', 'companyLogo');
  }
};
