'use strict';

const ErrorHandler = require('../src/utils/error.util');
const { badPasswordValidation } = require('../src/utils/errorcodes.util');

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
      unique: {
        args: true,
        msg: "El usuario ya tiene un cliente asociado."
      },
      type: DataTypes.INTEGER
    },
  }, {
    sequelize,
    modelName: 'client',
  });

  client.prototype.updateDetails = async function (user, person, data) {
    if (data.encrypted_password) {
      const isPasswordValid = await user.checkPasswordValidation(data.encrypted_password);
      if (!isPasswordValid) {
        throw new ErrorHandler(badPasswordValidation);
      }
    }
    await user.update(data);
    await person.update(data);
  }

  client.prototype.checkUserPasswordValidation = async function (password) {
    return await this.user.checkPassword(password);
  }

  return client;
};