"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addConstraint("distributors", {
      fields: ["recoveryEmail"],
      type: "unique",
      name: "unique_email_constraint_distributor",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint(
      "distributors",
      "unique_email_constraint_distributor"
    );
  },
};
