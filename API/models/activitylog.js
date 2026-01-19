'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class activitylog extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Association with User
      activitylog.belongsTo(models.user, {
        foreignKey: 'userId',
        as: 'user',
        onDelete: 'CASCADE'
      });
    }
  }

  activitylog.init({
    action: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    entityType: {
      type: DataTypes.ENUM('client', 'company', 'distributor', 'well'),
      allowNull: false,
      validate: {
        isIn: [['client', 'company', 'distributor', 'well']]
      }
    },
    entityId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        isInt: true
      }
    },
    entityName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    context: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    }
  }, {
    sequelize,
    modelName: 'activitylog',
    tableName: 'activity_logs',
    indexes: [
      {
        fields: ['userId']
      },
      {
        fields: ['entityType']
      },
      {
        fields: ['createdAt']
      }
    ]
  });

  return activitylog;
};
