'use strict';

const { Hooks } = require('sequelize/lib/hooks');
const { hashPassword, comparePassword, generateToken } = require('../src/utils/auth.util');

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
  }, 
  {
    hooks: {
      beforeCreate: async (user) => {
        console.log('beforeCreate hook');
        user.encrypted_password = await hashPassword(user.encrypted_password);
      }
    },
    sequelize,
    modelName: 'user',
  });

  user.prototype.generateToken = function () {
    return generateToken(this);
  }

  user.prototype.checkPassword = async function (password) {
    return await comparePassword(password, this.encrypted_password);
  }

  return user;
};