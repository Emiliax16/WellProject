'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addConstraint('wellData', {
      fields: ['date', 'hour'],
      type: 'unique',
      name: 'unique_date_hour_constraint'
    });
  },

  async down (queryInterface, Sequelize) {
    down: async (queryInterface, Sequelize) => {
      await queryInterface.removeConstraint('wellData', 'unique_date_hour_constraint');
    }
  }
};
