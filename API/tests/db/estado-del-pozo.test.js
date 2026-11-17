// estado-del-pozo.test.js
//
// `editStatusDate` marca desde cuándo un pozo está activo, y el reintento a la
// DGA solo toma los reportes creados después de esa fecha. Antes solo la fijaba
// el botón de activar: crear un pozo activo la dejaba vacía y activarlo desde
// el formulario de edición la dejaba vieja (#69). Ahora la fija el modelo cada
// vez que cambia `isActived`, venga del camino que venga.
//
// Usa una base real armada con las migraciones, porque prueba lo que el modelo
// guarda en ella.

const { sequelize, well: Well } = require('../../models');
const { migrarTodo } = require('../helpers/migrar');

jest.setTimeout(60000);

const HACE_UN_MES = new Date('2026-10-17T12:00:00.000Z');

const crearPozo = (campos) =>
  Well.create({ name: 'Pozo 1', location: 'Región de Valparaíso', clientId: 1, code: 'OB-0902-639', ...campos });

const leerFecha = async () =>
  (await sequelize.query(`SELECT "editStatusDate" FROM wells WHERE code = 'OB-0902-639'`))[0][0].editStatusDate;

describe('fecha de cambio de estado del pozo', () => {
  beforeEach(async () => {
    await migrarTodo();
    await sequelize.query(`
      INSERT INTO roles (id, type, description, "isAdmin", "isCompany", "isDistributor", "createdAt", "updatedAt")
        VALUES (2, 'normal', 'Cliente', false, false, false, now(), now());
      INSERT INTO users (id, name, email, encrypted_password, "roleId", "isActived", "createdAt", "updatedAt")
        VALUES (1, 'Cliente', 'cliente@example.com', 'x', 2, true, now(), now());
      INSERT INTO clients (id, "userId", "createdAt", "updatedAt") VALUES (1, 1, now(), now());`);
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('al crear', () => {
    test('fijar la fecha al crear un pozo activo', async () => {
      const antes = new Date();

      await crearPozo({ isActived: true });

      expect((await leerFecha()).getTime()).toBeGreaterThanOrEqual(antes.getTime() - 1000);
    });

    test('dejarla vacía al crear un pozo inactivo', async () => {
      await crearPozo({ isActived: false });

      expect(await leerFecha()).toBeNull();
    });
  });

  describe('con un pozo existente', () => {
    beforeEach(async () => {
      await sequelize.query(
        `INSERT INTO wells (name, location, "isActived", "clientId", code, "editStatusDate", "createdAt", "updatedAt")
         VALUES ('Pozo 1', 'Región de Valparaíso', false, 1, 'OB-0902-639', :fecha, now(), now())`,
        { replacements: { fecha: HACE_UN_MES } }
      );
    });

    test('fijar la fecha al activarlo desde el formulario de edición', async () => {
      const pozo = await Well.findOne({ where: { code: 'OB-0902-639' } });
      const antes = new Date();

      await pozo.update({ isActived: true, name: 'Pozo 1 norte' });

      expect((await leerFecha()).getTime()).toBeGreaterThanOrEqual(antes.getTime() - 1000);
    });

    test('fijar la fecha al desactivarlo', async () => {
      await sequelize.query(`UPDATE wells SET "isActived" = true WHERE code = 'OB-0902-639'`);
      const pozo = await Well.findOne({ where: { code: 'OB-0902-639' } });
      const antes = new Date();

      await pozo.update({ isActived: false });

      expect((await leerFecha()).getTime()).toBeGreaterThanOrEqual(antes.getTime() - 1000);
    });

    test('conservar la fecha si cambian otros campos', async () => {
      const pozo = await Well.findOne({ where: { code: 'OB-0902-639' } });

      await pozo.update({ name: 'Pozo 1 norte', location: 'Región de O’Higgins' });

      expect(await leerFecha()).toEqual(HACE_UN_MES);
    });

    test('conservar la fecha si se guarda el mismo estado', async () => {
      const pozo = await Well.findOne({ where: { code: 'OB-0902-639' } });

      await pozo.update({ isActived: false });

      expect(await leerFecha()).toEqual(HACE_UN_MES);
    });
  });
});
