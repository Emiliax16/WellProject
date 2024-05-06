'use strict';
const { hashPassword, comparePassword, generateToken } = require('../src/utils/auth.util');
const ErrorHandler = require('../src/utils/error.util');
const { 
  badPasswordValidation, 
  passwordsDontMatch, 
  newPasswordCantBeTheSame,
  passwordIsRequired,
} = require('../src/utils/errorcodes.util');

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
      user.hasOne(models.person, { foreignKey: 'userId', onDelete: 'CASCADE' });
      user.belongsTo(models.role, { foreignKey: 'roleId' });
      user.hasOne(models.client, { foreignKey: 'userId', onDelete: 'CASCADE' });
    }
  }
  user.init({
    name: {
      allowNull: false,
      type: DataTypes.STRING
    },
    email: {
      allowNull: false,
      validate:{
        isEmail: {
          msg: "Email inválido."
        },
      },
      unique: {
        args: true,
        msg: "El email ya existe."
      },
      type: DataTypes.STRING
    },
    encrypted_password: {
      allowNull: false,
      type: DataTypes.STRING,
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
      },
      afterCreate: async (user) => {
        if (user.roleId === 1) return;
        const client = sequelize.models.client;
        await client.create({ userId: user.id })
      },
    },
    sequelize,
    modelName: 'user',
  });

  user.prototype.generateToken = async function () {
    return await generateToken(this);
  }

  user.prototype.handlePasswordChange = async function (oldPassword, newPassword) {
    if (!newPassword || !oldPassword) {
      throw new ErrorHandler(passwordIsRequired);
    }

    const doesPasswordMatch = await this.checkPassword(oldPassword);
    if (!doesPasswordMatch) {
      throw new ErrorHandler(passwordsDontMatch);
    }

    const isPasswordValid = await this.checkPasswordValidation(newPassword);
    if (!isPasswordValid) {
      throw new ErrorHandler(badPasswordValidation);
    }

    if (oldPassword === newPassword) {
      throw new ErrorHandler(newPasswordCantBeTheSame);
    }

    await this.updatePassword(newPassword);
  }

  user.prototype.checkPassword = async function (password) {
    return await comparePassword(password, this.encrypted_password);
  }

  user.prototype.checkPasswordValidation = async function (password) {
    const isValid = this.passwordFollowsLength(password);
    if (!isValid) {
      return false
    }
    return true
  }

  user.prototype.passwordFollowsLength = function (password) {
    if (password.length < 8) {
      return false;
    }
    return true
  }

  user.prototype.updatePassword = async function (newPassword) {
    this.encrypted_password = await hashPassword(newPassword);
    await this.save();
  }

  user.prototype.createPerson = async function (personParams, Person) {
    personParams.userId = this.id;
    const person = await Person.create(personParams);
    return person;
  }

  return user;
};