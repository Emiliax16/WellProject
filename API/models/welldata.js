"use strict";
const { Model } = require("sequelize");
const processAndPostData = require("../src/services/wellData/handleSendData.service");
module.exports = (sequelize, DataTypes) => {
  class wellData extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      wellData.belongsTo(models.well, {
        foreignKey: "code",
        targetKey: "code",
        onDelete: "CASCADE",
      });
    }
  }
  wellData.init(
    {
      code: {
        allowNull: false,
        validate: {
          len: [1, 20],
        },
        type: DataTypes.STRING,
      },
      date: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      realDate: {
        allowNull: true,
        type: DataTypes.DATEONLY,
        comment: 'Fecha en formato DATE para filtros y consultas. Se rellena automáticamente desde el campo date (string)',
      },
      hour: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      totalizador: {
        allowNull: false,
        type: DataTypes.INTEGER,
      },
      caudal: {
        allowNull: false,
        type: DataTypes.FLOAT,
      },
      nivel_freatico: {
        allowNull: false,
        type: DataTypes.FLOAT,
      },
      sent: {
        allowNull: false,
        defaultValue: false,
        type: DataTypes.BOOLEAN,
      },
      sentDate: {
        allowNull: true,
        type: DataTypes.STRING,
      },
    },
    {
      hooks: {
        // Fire-and-forget: NO retornamos la promesa al hook, así Sequelize
        // no espera al envío a DGA antes de resolver `WellData.create()`.
        // Si DGA falla o tarda, el reporte queda con `sent: false` y el
        // SENDER lo reintenta en su próxima corrida. Esto desacopla el
        // SLA del endpoint POST /wellData del SLA de la DGA y evita los
        // timeouts del lado del cliente IoT (Layrz) que vimos en prod.
        afterCreate: (wellData) => {
          setImmediate(async () => {
            try {
              const well = await wellData.getWell();
              if (well?.isActived) {
                await processAndPostData(wellData, well);
              }
            } catch (error) {
              console.error(JSON.stringify({
                level: 'error',
                msg: 'DGA dispatch failed in afterCreate hook',
                wellDataId: wellData.id,
                code: wellData.code,
                error: error.message,
              }));
            }
          });
        },
      },
      sequelize,
      modelName: "wellData",
      indexes: [
        {
          unique: true,
          fields: ["date", "hour", "code"],
        },
      ],
    }
  );
  return wellData;
};
