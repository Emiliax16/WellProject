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
      user.hasOne(models.company, { foreignKey: 'userId', onDelete: 'CASCADE' });
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
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    }
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

  user.prototype.handlePasswordChange = async function (oldPassword, newPassword ) {
    if (!newPassword) {
      throw new ErrorHandler(passwordIsRequired);
    }

    if (oldPassword) {
      // Actualmente no se mandará la contraseña actual para actualizarla con una nueva,
      // pero se deja la lógica por si se decide implementar en un futuro
      const doesPasswordMatch = await this.checkPassword(oldPassword);
      if (!doesPasswordMatch) {
        throw new ErrorHandler(passwordsDontMatch);
      }

      if (oldPassword === newPassword) {
        throw new ErrorHandler(newPasswordCantBeTheSame);
      }
    }

    const isPasswordValid = await this.checkPasswordValidation(newPassword);
    if (!isPasswordValid) {
      throw new ErrorHandler(badPasswordValidation);
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

  user.prototype.createCompany = async function (companyParams, Company) {
    companyParams.userId = this.id;
    const company = await Company.create(companyParams);
    return company;
  }

  return user;
};