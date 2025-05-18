'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class role extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      role.hasMany(models.user, { foreignKey: 'roleId' });
    }
  }
  role.init({
    type: {
      allowNull: false,
      defaultValue: 'normal',
      type: DataTypes.STRING,
      unique: {
        args: true,
        msg: 'Role already exists'
      },
      validate: {
        isIn: [['admin', 'normal', 'company', 'distributor']],
      }
    },
    description: {
      allowNull: false,
      type: DataTypes.STRING
    },
    isAdmin: {
      allowNull: false,
      defaultValue: false,
      type: DataTypes.BOOLEAN
    },
    isCompany: {
      allowNull: false,
      defaultValue: false,
      type: DataTypes.BOOLEAN
    },
    isDistributor: {
      allowNull: false,
      defaultValue: false,
      type: DataTypes.BOOLEAN
    }
  }, {
    sequelize,
    modelName: 'role',
  });
  return role;
};