'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class client extends Model {
    static associate(models) {
      client.belongsTo(models.user, { foreignKey: 'userId' });
      client.hasMany(models.well, { foreignKey: 'clientId' });
    }
  }
  client.init({
    userId: {
      allowNull: false,
      unique: true,
      type: DataTypes.INTEGER
    },
  }, {
    sequelize,
    modelName: 'client',
  });
  return client;
};