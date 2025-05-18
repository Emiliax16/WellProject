"use strict";

const ErrorHandler = require("../src/utils/error.util");
const { badPasswordValidation } = require("../src/utils/errorcodes.util");

const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class distributor extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      distributor.belongsTo(models.user, {
        foreignKey: "userId",
        onDelete: "CASCADE",
      });
      distributor.hasMany(models.company, {
        foreignKey: "distributorId",
        onDelete: "CASCADE",
      });
    }
  }
  distributor.init(
    {
      userId: {
        allowNull: false,
        unique: {
          args: true,
          msg: "El usuario ya tiene una distribuidora asociada.",
        },
        type: DataTypes.INTEGER,
      },
      distributorLogo: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      distributorRut: {
        allowNull: true,
        type: DataTypes.STRING,
        unique: {
          args: true,
          msg: "El RUT ya está en uso.",
        },
      },
      phoneNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      recoveryEmail: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: {
          args: true,
          msg: "El correo electrónico ya está en uso",
        },
        validate: {
          isEmail: {
            args: true,
            msg: "El correo electrónico no es válido",
          },
        },
      },
      location: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "distributor",
    }
  );

  distributor.prototype.updateDetails = async function (user, data) {
    if (data.encrypted_password) {
      const isPasswordValid = await user.checkPasswordValidation(
        data.encrypted_password
      );
      if (!isPasswordValid) {
        throw new ErrorHandler(badPasswordValidation);
      }
    }
    await user.update(data);
    await this.update(data);
  };

  return distributor;
};
