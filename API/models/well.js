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
      allowNull: true,
      type: DataTypes.STRING,
    },
    rutUsuario: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    password: {
      allowNull: true,
      type: DataTypes.STRING,
    },
  }, {
    hooks: {
      // `editStatusDate` marca desde cuándo el pozo está activo o inactivo, y el
      // reintento a la DGA solo toma los reportes creados después de esa fecha:
      // los de un período inactivo no se envían. Antes solo la fijaba el botón
      // de activar, así que crear un pozo activo o cambiarlo desde el formulario
      // de edición la dejaba vacía o vieja (#69). Desde el hook vale para
      // cualquier camino que guarde el pozo.
      beforeSave: (pozo) => {
        const cambioDeEstado = pozo.isNewRecord ? pozo.isActived === true : pozo.changed('isActived');
        if (cambioDeEstado) {
          pozo.editStatusDate = new Date();
        }
      },
    },
    sequelize,
    modelName: 'well',
  });
  return well;
};