'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('wellData', [{
      code: 'WELL-DUMMY-1',
      date: '21-03-2021',
      hour: '12:00:00',
      well_id: 1,
      totalizador: 123,
      caudal: 123,
      nivel_freatico: 123,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      code: 'WELL-DUMMY-1',
      date: '21-03-2021',
      hour: '12:10:00',
      well_id: 1,
      totalizador: 1232,
      caudal: 1232,
      nivel_freatico: 1232,
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('wellData', null, {});
  }
};
