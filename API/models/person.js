'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class person extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      person.belongsTo(models.user, { foreignKey: 'userId' });
    }
  }
  person.init({
    fullName: DataTypes.STRING,
    personalEmail: DataTypes.STRING,
    phoneNumber: DataTypes.STRING,
    location: DataTypes.STRING,
    userId: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'person',
  });
  return person;
};