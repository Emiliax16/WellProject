'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class well extends Model {
    static associate(models) {
      // Well tendrá dos asociaciones, una con Client (belongsTo) y otra con WellData (hasMany)
      // Para la demo, se usará información dummy
      well.hasMany(models.wellData, { foreignKey: 'code', sourceKey: 'code', onDelete: 'CASCADE'});
      well.belongsTo(models.client, { foreignKey: 'clientId', onDelete: 'CASCADE'});
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
      unique: {
        args: true,
        msg: 'Este código ya está en uso.'
      },
    },
    editStatusDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    rutEmpresa: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    rutUsuario: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    password: {
      allowNull: false,
      type: DataTypes.STRING,
    },
  }, {
    sequelize,
    modelName: 'well',
  });
  return well;
};