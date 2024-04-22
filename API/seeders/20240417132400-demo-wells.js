'use strict';

const { faker } = require('@faker-js/faker'); // permite generar datos dummy de nombres, direcciones, etc.

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) { // queryInterface es un objeto que contiene métodos para manipular la base de datos
    await queryInterface.bulkInsert('wells', [{ // bulkInsert inserta múltiples registros en la tabla Wells
      name: 'Well dummy 1',
      location: faker.location.streetAddress(),
      is_actived: true,
      code: 'WELL-DUMMY-1',
      client_id: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Well dummy 2',
      location: faker.location.streetAddress(),
      is_actived: true,
      code: 'WELL-DUMMY-2',
      client_id: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('wells', null, {});
  }
};
