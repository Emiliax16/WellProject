"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("distributors", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      userId: {
        allowNull: false,
        unique: {
          args: true,
          msg: "El usuario ya tiene una distribuidora asociada.",
        },
        type: Sequelize.INTEGER,
      },
      distributorLogo: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      distributorRut: {
        allowNull: true,
        type: Sequelize.STRING,
        unique: {
          args: true,
          msg: "El RUT ya está en uso.",
        },
      },
      phoneNumber: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      recoveryEmail: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      location: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("distributors");
  },
};
