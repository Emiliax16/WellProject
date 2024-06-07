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
      wellData.belongsTo(models.well, { foreignKey: 'code', targetKey: 'code', onDelete: 'CASCADE'});
    }
  }
  wellData.init({
    code: {
      allowNull: false,
      validate: {
        len: [1, 20]
      },
      type: DataTypes.STRING
    },
    date: {
      allowNull: false,
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
      type: DataTypes.FLOAT
    },
    nivel_freatico: {
      allowNull: false,
      type: DataTypes.FLOAT
    },
    sent: {
      allowNull: false,
      defaultValue: false,
      type: DataTypes.BOOLEAN
    },
    sentDate: {
      allowNull: true,
      type: DataTypes.STRING
    }
  }, {

    hooks: {
      afterCreate: async (wellData) => {
        //todo
      }
    },
    sequelize,
    modelName: 'wellData',
    indexes: [
      {
        unique: true,
        fields: ['date', 'hour']
      }
    ]
  });
  return wellData;
};