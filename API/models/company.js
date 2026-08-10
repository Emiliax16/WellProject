'use strict';

const ErrorHandler = require('../src/utils/error.util');
const { badPasswordValidation } = require('../src/utils/errorcodes.util');

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
      company.belongsTo(models.distributor, { foreignKey: 'distributorId', onDelete: 'CASCADE' });

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
    },
    distributorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'distributors',
        key: 'id'
      },
      onUpdate: 'CASCADE',
    },
  }, {
    sequelize,
    modelName: 'company',
  });

  // Ver el comentario equivalente en `models/client.js`: el body llega crudo
  // desde el controlador y sin esta lista se puede escribir cualquier columna.
  const CAMPOS_EDITABLES_USER = ['name', 'email', 'roleId', 'isActived'];
  const CAMPOS_EDITABLES_COMPANY = [
    'companyLogo', 'companyRut', 'phoneNumber', 'recoveryEmail', 'location', 'distributorId',
  ];

  const soloCampos = (data, permitidos) =>
    Object.fromEntries(
      Object.entries(data).filter(([campo]) => permitidos.includes(campo))
    );

  company.prototype.updateDetails = async function (user, data) {
    if (data.encrypted_password) {
      const isPasswordValid = await user.checkPasswordValidation(data.encrypted_password);
      if (!isPasswordValid) {
        throw new ErrorHandler(badPasswordValidation);
      }
    }
    await user.update(soloCampos(data, CAMPOS_EDITABLES_USER));
    await this.update(soloCampos(data, CAMPOS_EDITABLES_COMPANY));
  }

  return company;
};