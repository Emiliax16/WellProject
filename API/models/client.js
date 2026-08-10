'use strict';

const ErrorHandler = require('../src/utils/error.util');
const { badPasswordValidation } = require('../src/utils/errorcodes.util');
const soloCampos = require('../src/utils/only-fields.util');

const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class client extends Model {
    static associate(models) {
      client.belongsTo(models.user, { foreignKey: 'userId', onDelete: 'CASCADE' });
      client.hasMany(models.well, { foreignKey: 'clientId',  onDelete: 'CASCADE'});
      client.belongsTo(models.company, { foreignKey: 'companyId', onDelete: 'CASCADE' });
    }
  }
  client.init({
    userId: {
      allowNull: false,
      unique: {
        args: true,
        msg: "El usuario ya tiene un cliente asociado."
      },
      type: DataTypes.INTEGER
    },
    companyId: {
      allowNull: true,
      type: DataTypes.INTEGER
    },
  }, {
    sequelize,
    modelName: 'client',
  });

  // Sólo estos campos se pueden tocar desde el formulario de edición.
  // `validate-params` no sirve de filtro: comprueba los campos que declara,
  // pero deja pasar intactos los que no, así que sin esta lista el body llega
  // entero a `update()` y se puede escribir cualquier columna, incluidas `id`,
  // `userId` y `createdBy`.
  // `encrypted_password` queda fuera a propósito: lo maneja
  // `handlePasswordChange`, que la hashea. Escribirla por acá la guardaría en
  // texto plano y dejaría la cuenta sin poder iniciar sesión.
  const CAMPOS_EDITABLES_USER = ['name', 'email', 'roleId', 'isActived'];
  const CAMPOS_EDITABLES_PERSON = ['fullName', 'personalEmail', 'phoneNumber', 'location'];

  client.prototype.updateDetails = async function (user, person, data) {
    if (data.encrypted_password) {
      const isPasswordValid = await user.checkPasswordValidation(data.encrypted_password);
      if (!isPasswordValid) {
        throw new ErrorHandler(badPasswordValidation);
      }
    }
    await user.update(soloCampos(data, CAMPOS_EDITABLES_USER));
    await person.update(soloCampos(data, CAMPOS_EDITABLES_PERSON));
  }

  client.prototype.checkUserPasswordValidation = async function (password) {
    return await this.user.checkPassword(password);
  }

  return client;
};