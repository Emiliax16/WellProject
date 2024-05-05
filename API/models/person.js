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
    fullName: {
      allowNull: false,
      type: DataTypes.STRING
    },
    personalEmail: {
      allowNull: true,
      validate: {
        isEmail: {
          msg: "Email inválido."
        }
      },
      unique: {
        args: true,
        msg: "El email ya existe."
      },
      type: DataTypes.STRING
    },
    phoneNumber: {
      allowNull: false,
      type: DataTypes.STRING
    },
    location: {
      allowNull: false,
      type: DataTypes.STRING
    },
    userId: {
      allowNull: false,
      type: DataTypes.INTEGER
    },
  }, {
    sequelize,
    modelName: 'person',
  });
  return person;
};