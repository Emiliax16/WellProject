'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class wellData extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      wellData.belongsTo(models.well, { foreignKey: 'code', targetKey: 'code' });
    }
  }
  wellData.init({
    code: {
      allowNull: false,
      max: 20,
      type: DataTypes.STRING
    },
    date: {
      allowNull: false,
        isDate: true,
        type: DataTypes.STRING
    },
    hour: {
      allowNull: false,
      type: DataTypes.STRING
    },
    totalizador: {
      allowNull: false,
      type: DataTypes.INTEGER
    },
    caudal: {
      allowNull: false,
      isDecimal: true,
      type: DataTypes.INTEGER
    },
    nivel_freatico: {
      allowNull: false,
      type: DataTypes.INTEGER
    },
  }, {
    sequelize,
    modelName: 'wellData',
  });
  return wellData;
};