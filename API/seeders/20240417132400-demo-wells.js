'use strict';

const { faker } = require('@faker-js/faker'); // permite generar datos dummy de nombres, direcciones, etc.

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) { // queryInterface es un objeto que contiene métodos para manipular la base de datos
    await queryInterface.bulkInsert('wells', [{ // bulkInsert inserta múltiples registros en la tabla Wells
      name: 'Well 1',
      location: faker.location.streetAddress(),
      is_actived: true,
      client_id: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Well 2',
      location: faker.location.streetAddress(),
      is_actived: true,
      client_id: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Well 3',
      location: faker.location.streetAddress(),
      is_actived: true,
      client_id: 2,
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('wells', null, {});
  }
};
