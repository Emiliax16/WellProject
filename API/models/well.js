'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class well extends Model {
    static associate(models) {
      // Well tendrá dos asociaciones, una con Client (belongsTo) y otra con WellData (hasMany)
      // Para la demo, se usará información dummy
      well.hasMany(models.wellData, { foreignKey: 'code', sourceKey: 'code' });
    }
  }
  well.init({
    name: DataTypes.STRING,
    location: {
      allowNull: false,
      type: DataTypes.STRING
    },
    isActived: {
      allowNull: false,
      defaultValue: false,
      type: DataTypes.BOOLEAN
    },
    clientId: {
      allowNull: false,
      type: DataTypes.INTEGER
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      primaryKey: true
    }
  }, {
    sequelize,
    modelName: 'well',
  });
  return well;
};