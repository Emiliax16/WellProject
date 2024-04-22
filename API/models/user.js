'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class user extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      user.hasOne(models.person, { foreignKey: 'userId' });
      user.belongsTo(models.role, { foreignKey: 'roleId' });
    }
  }
  user.init({
    name: DataTypes.STRING,
    email: DataTypes.STRING,
    encrypted_password: DataTypes.STRING,
    roleId: DataTypes.INTEGER,
    status: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'user',
  });
  return user;
};