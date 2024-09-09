'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class company extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      company.belongsTo(models.user, { foreignKey: 'userId', onDelete: 'CASCADE' });
      company.hasMany(models.client, { foreignKey: 'companyId', onDelete: 'CASCADE' });
    }
  }
  company.init({
    userId: {
      allowNull: false,
      unique: {
        args: true,
        msg: "El usuario ya tiene una empresa asociada."
      },
      type: DataTypes.INTEGER
    },
    companyLogo: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    companyRut: {
      allowNull: true,
      type: DataTypes.STRING,
      unique: {
        args: true,
        msg: "El RUT ya está en uso."
      },
    },
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    recoveryEmail: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true,
    }
  }, {
    sequelize,
    modelName: 'company',
  });
  return company;
};