"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("activity_logs", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      action: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: "Action performed (e.g., created, updated, deleted)",
      },
      entityType: {
        type: Sequelize.ENUM("client", "company", "distributor", "well"),
        allowNull: false,
        comment: "Type of entity affected",
      },
      entityId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: "ID of the entity affected",
      },
      entityName: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: "Name/code of the entity for quick display",
      },
      context: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: "Hierarchical context (client, company, distributor)",
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        comment: "User who performed the action",
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

    // // Add index for faster queries
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("activity_logs");
  },
};
