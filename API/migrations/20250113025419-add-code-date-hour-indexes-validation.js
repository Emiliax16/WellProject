"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addConstraint("wellData", {
      fields: ["date", "hour", "code"],
      type: "unique",
      name: "unique_code_date_hour_constraint",
    });
  },

  async down(queryInterface, Sequelize) {
    down: async (queryInterface, Sequelize) => {
      await queryInterface.removeConstraint(
        "wellData",
        "unique_code_date_hour_constraint"
      );
    };
  },
};
