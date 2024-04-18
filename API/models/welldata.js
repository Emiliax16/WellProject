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
      wellData.belongsTo(models.Well, { foreignKey: 'well_id' });
    }
  }
  wellData.init({
    code: DataTypes.STRING,
    date: DataTypes.STRING,
    hour: DataTypes.STRING,
    well_id: DataTypes.INTEGER,
    totalizador: DataTypes.INTEGER,
    caudal: DataTypes.INTEGER,
    nivel_freatico: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'wellData',
  });
  return wellData;
};