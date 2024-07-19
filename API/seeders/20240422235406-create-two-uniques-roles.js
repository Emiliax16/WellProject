'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
   await queryInterface.bulkInsert('roles', [
    {
      id: 1,
      type: 'admin',
      description: 'Role for admin users, can view and edit all data',
      isAdmin: true,
      isCompany: false,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 2,
      type: 'normal',
      description: 'Role for normal users, can only view and edit their own data',
      isAdmin: false,
      isCompany: false, 
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 3,
      description: 'Role for company users, can view and edit all data',
      isAdmin: false,
      isCompany: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]);
  },
  
  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('roles', null, {});
  }
};
