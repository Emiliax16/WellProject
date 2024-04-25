'use strict';
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
    name: {
      allowNull: false,
      type: DataTypes.STRING
    },
    email: {
      allowNull: false,
      isEmail: true,
      type: DataTypes.STRING
    },
    encrypted_password: {
      allowNull: false,
      type: DataTypes.STRING
    },
    roleId: {
      allowNull: false,
      defaultValue: 2,
      type: DataTypes.INTEGER
    },
    isActived: {
      allowNull: false,
      defaultValue: true,
      type: DataTypes.BOOLEAN
    },
  }, 
  {
    hooks: {
      beforeCreate: async (user) => {
        user.encrypted_password = await hashPassword(user.encrypted_password);
      }
    },
    sequelize,
    modelName: 'user',
  });

  user.prototype.generateToken = async function () {
    return await generateToken(this);
  }

  user.prototype.checkPassword = async function (password) {
    return await comparePassword(password, this.encrypted_password);
  }

  return user;
};