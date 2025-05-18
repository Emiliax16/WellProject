"use strict";

const { role } = require("../models");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const roles = [
      {
        type: "admin",
        description: "Role for admin users, can view and edit all data",
        isAdmin: true,
        isCompany: false,
        isDistributor: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        type: "normal",
        description:
          "Role for normal users, can only view and edit their own data",
        isAdmin: false,
        isCompany: false,
        isDistributor: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        type: "company",
        description: "Role for company users, can view and edit all data",
        isAdmin: false,
        isCompany: true,
        isDistributor: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        type: "distributor",
        description: "Role for distributor users, can view and create companies",
        isAdmin: false,
        isCompany: false,
        isDistributor: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    for (const roleData of roles) {
      const [record, created] = await role.findOrCreate({
        where: { type: roleData.type },
        defaults: roleData,
      });
      if (!created) {
        await record.update(roleData);
      }
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("roles", null, {});
  },
};
