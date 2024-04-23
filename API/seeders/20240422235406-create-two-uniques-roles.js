'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
   await queryInterface.bulkInsert('roles', [
    {
      type: 'admin',
      description: 'Role for admin users, can view and edit all data',
      isAdmin: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      type: 'normal',
      description: 'Role for normal users, can only view and edit their own data',
      isAdmin: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }]);
  },
  
  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('roles', null, {});
  }
};
