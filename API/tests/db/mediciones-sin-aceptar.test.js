// mediciones-sin-aceptar.test.js
//
// La alerta de las 08:00 avisa de las mediciones que la DGA no aceptó (#70).
// Parte de la misma consulta que el reintento diario, así que los dos coinciden
// en qué cuenta como pendiente. Aquí se prueba el resumen por pozo: cuántas
// mediciones son de ayer, cuántas suman en total y cuál es la más antigua.
//
// Usa una base real armada con las migraciones.

const { sequelize } = require('../../models');
const { migrarTodo } = require('../helpers/migrar');
const { resumenSinAceptar } = require('../../src/services/wellData/pendientesDga.service');

jest.setTimeout(60000);

// 08:00 del 17-11-2026 en Santiago, la hora del chequeo diario. "Ayer" va
// desde las 00:00 del 16-11 en Santiago (03:00 UTC).
const AHORA = new Date('2026-11-17T11:00:00.000Z');

const insertarPozo = (code, name, { activo = true } = {}) =>
  sequelize.query(
    `INSERT INTO wells (name, location, "isActived", "clientId", code, "editStatusDate", "createdAt", "updatedAt")
     VALUES (:name, 'Región de Valparaíso', :activo, 1, :code, '2026-09-01T00:00:00Z', now(), now())`,
    { replacements: { code, name, activo } }
  );

let siguienteId = 1;

const insertarReporte = (code, creado, date, hour, sent = false) =>
  sequelize.query(
    `INSERT INTO "wellData" (id, code, date, hour, totalizador, caudal, nivel_freatico, sent, "createdAt", "updatedAt")
     VALUES (:id, :code, :date, :hour, 1200, 3.5, 12.4, :sent, :creado, :creado)`,
    { replacements: { id: siguienteId++, code, date, hour, sent, creado } }
  );

describe('resumen de mediciones que la DGA no aceptó', () => {
  beforeEach(async () => {
    await migrarTodo();
    await sequelize.query(`
      INSERT INTO roles (id, type, description, "isAdmin", "isCompany", "isDistributor", "createdAt", "updatedAt")
        VALUES (2, 'normal', 'Cliente', false, false, false, now(), now());
      INSERT INTO users (id, name, email, encrypted_password, "roleId", "isActived", "createdAt", "updatedAt")
        VALUES (1, 'Cliente', 'cliente@example.com', 'x', 2, true, now(), now());
      INSERT INTO clients (id, "userId", "createdAt", "updatedAt") VALUES (1, 1, now(), now());`);
    siguienteId = 1;
    await insertarPozo('OB-0902-639', 'Parque Alviso');
    await insertarPozo('OB-1304-1749', 'Pozo Norte');
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('separar por pozo las horas de ayer del total pendiente, con la medición más antigua', async () => {
    await insertarReporte('OB-0902-639', '2026-11-16T08:27:00Z', '16/11/2026', '05:27');
    await insertarReporte('OB-0902-639', '2026-11-16T09:01:00Z', '16/11/2026', '06:01');
    await insertarReporte('OB-0902-639', '2026-11-10T08:27:00Z', '10/11/2026', '05:27');
    await insertarReporte('OB-1304-1749', '2026-11-12T17:12:00Z', '12/11/2026', '14:12');

    expect(await resumenSinAceptar({ ahora: AHORA })).toEqual([
      { code: 'OB-0902-639', name: 'Parque Alviso', deAyer: 2, total: 3, masAntigua: new Date('2026-11-10T08:27:00Z') },
      { code: 'OB-1304-1749', name: 'Pozo Norte', deAyer: 0, total: 1, masAntigua: new Date('2026-11-12T17:12:00Z') },
    ]);
  });

  test('contar como de ayer una medición de las 23:30 de ayer y no una de antes de la medianoche anterior', async () => {
    await insertarReporte('OB-0902-639', '2026-11-17T02:30:00Z', '16/11/2026', '23:30');
    await insertarReporte('OB-0902-639', '2026-11-16T02:30:00Z', '15/11/2026', '23:30');

    expect(await resumenSinAceptar({ ahora: AHORA })).toMatchObject([{ code: 'OB-0902-639', deAyer: 1, total: 2 }]);
  });

  test('dejar fuera las fallas de hoy, que el reintento todavía no tomó', async () => {
    await insertarReporte('OB-0902-639', '2026-11-17T04:01:00Z', '17/11/2026', '01:01');

    expect(await resumenSinAceptar({ ahora: AHORA })).toEqual([]);
  });

  test('contar una sola vez una hora con dos reportes sin enviar', async () => {
    await insertarReporte('OB-0902-639', '2026-11-16T13:01:00Z', '16/11/2026', '10:01');
    await insertarReporte('OB-0902-639', '2026-11-16T13:31:00Z', '16/11/2026', '10:31');

    expect(await resumenSinAceptar({ ahora: AHORA })).toMatchObject([{ deAyer: 1, total: 1 }]);
  });

  test('dejar fuera una hora que ya tiene un reporte enviado', async () => {
    await insertarReporte('OB-0902-639', '2026-11-16T13:01:00Z', '16/11/2026', '10:01', true);
    await insertarReporte('OB-0902-639', '2026-11-16T13:31:00Z', '16/11/2026', '10:31');

    expect(await resumenSinAceptar({ ahora: AHORA })).toEqual([]);
  });

  test('dejar fuera los pozos inactivos y las mediciones de más de 35 días', async () => {
    await insertarPozo('OB-0701-1496', 'Fuente de Agua N°1', { activo: false });
    await insertarReporte('OB-0701-1496', '2026-11-16T13:01:00Z', '16/11/2026', '10:01');
    await insertarReporte('OB-0902-639', '2026-10-12T13:01:00Z', '12/10/2026', '10:01');

    expect(await resumenSinAceptar({ ahora: AHORA })).toEqual([]);
  });
});
