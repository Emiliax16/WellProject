// foreign-keys-faltantes.test.js
//
// `companies.userId`, `distributors.userId` y `users.roleId` no tenían foreign
// key en la base (#83). Borrar un usuario dejaba su empresa o su distribuidora
// huérfana, y nada impedía guardar un `roleId` inexistente.
//
// Usa una base real, que reconstruye desde cero con las migraciones: corre con
// `npm run test:migrations` y nunca contra una base que no termine en `_test`.

const { sequelize, Sequelize } = require('../../models');
const { migrarHastaAntesDe, cargar } = require('../helpers/migrar');
const { assertSafeToWipe } = require('../helpers/safe-database');

const MIGRACION = '20261117000000-add-missing-foreign-keys.js';
const migracion = cargar(MIGRACION);

jest.setTimeout(60000);

const consultar = async (sql) => (await sequelize.query(sql))[0];

const insertarRoles = () =>
  sequelize.query(`
    INSERT INTO roles (id, type, description, "isAdmin", "isCompany", "isDistributor", "createdAt", "updatedAt") VALUES
      (1, 'admin', 'Administrador', true, false, false, now(), now()),
      (2, 'normal', 'Cliente', false, false, false, now(), now()),
      (3, 'company', 'Empresa', false, true, false, now(), now()),
      (4, 'distributor', 'Distribuidora', false, false, true, now(), now())`);

const insertarUsuario = (id, roleId) =>
  sequelize.query(`
    INSERT INTO users (id, name, email, encrypted_password, "roleId", "isActived", "createdAt", "updatedAt")
    VALUES (${id}, 'Usuario ${id}', 'usuario${id}@example.com', 'x', ${roleId}, true, now(), now())`);

const insertarEmpresa = (id, userId, distributorId = null) =>
  sequelize.query(`
    INSERT INTO companies (id, "userId", "distributorId", "createdAt", "updatedAt")
    VALUES (${id}, ${userId}, ${distributorId}, now(), now())`);

const insertarDistribuidora = (id, userId) =>
  sequelize.query(`
    INSERT INTO distributors (id, "userId", "createdAt", "updatedAt")
    VALUES (${id}, ${userId}, now(), now())`);

// Las tres restricciones de la migración, con su acción al borrar y al
// actualizar (`c` = CASCADE, `r` = RESTRICT).
const restriccionesNuevas = () =>
  consultar(`
    SELECT conname, confdeltype, confupdtype FROM pg_constraint
     WHERE contype = 'f'
       AND conname IN ('companies_userId_fkey', 'distributors_userId_fkey', 'users_roleId_fkey')
     ORDER BY conname`);

// El error de Postgres que produjo una operación, por código y restricción.
// Se compara eso y no el mensaje, que Postgres traduce según `lc_messages`.
// 23503 es foreign_key_violation y 42710, duplicate_object.
const errorDePostgres = (promesa) =>
  promesa.then(
    () => {
      throw new Error('La operación debía fallar y terminó bien');
    },
    (error) => ({ codigo: error.parent.code, restriccion: error.parent.constraint })
  );

const subir = () => migracion.up(sequelize.getQueryInterface(), Sequelize);
const bajar = () => migracion.down(sequelize.getQueryInterface(), Sequelize);

describe('migración de las foreign keys faltantes (#83)', () => {
  beforeEach(async () => {
    await migrarHastaAntesDe(MIGRACION);
    await insertarRoles();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('antes de migrar', () => {
    test('aceptar una empresa cuyo usuario no existe, que es el problema del issue', async () => {
      await insertarEmpresa(1, 999);

      expect(await consultar('SELECT id, "userId" FROM companies')).toEqual([{ id: 1, userId: 999 }]);
    });
  });

  describe('después de migrar', () => {
    beforeEach(async () => {
      await insertarUsuario(10, 3);
      await insertarUsuario(20, 4);
      await insertarUsuario(30, 2);
      await insertarDistribuidora(1, 20);
      await insertarEmpresa(1, 10, 1);
      await subir();
    });

    test('crear las tres foreign keys con la acción acordada', async () => {
      expect(await restriccionesNuevas()).toEqual([
        { conname: 'companies_userId_fkey', confdeltype: 'c', confupdtype: 'c' },
        { conname: 'distributors_userId_fkey', confdeltype: 'c', confupdtype: 'c' },
        { conname: 'users_roleId_fkey', confdeltype: 'r', confupdtype: 'c' },
      ]);
    });

    test('borrar la empresa y la distribuidora de un usuario al borrar ese usuario', async () => {
      await sequelize.query('DELETE FROM users WHERE id IN (10, 20)');

      expect(await consultar('SELECT id FROM companies')).toEqual([]);
      expect(await consultar('SELECT id FROM distributors')).toEqual([]);
    });

    test('conservar el borrado de los controladores, que eliminan la empresa antes que su usuario', async () => {
      await sequelize.query('DELETE FROM companies WHERE id = 1');
      await sequelize.query('DELETE FROM users WHERE id = 10');

      expect(await consultar('SELECT id FROM users ORDER BY id')).toEqual([{ id: 20 }, { id: 30 }]);
    });

    test('conservar las empresas de una distribuidora borrada, sin distribuidora', async () => {
      await sequelize.query('DELETE FROM distributors WHERE id = 1');
      await sequelize.query('DELETE FROM users WHERE id = 20');

      expect(await consultar('SELECT id, "distributorId" FROM companies')).toEqual([{ id: 1, distributorId: null }]);
    });

    test('rechazar una empresa cuyo usuario no existe', async () => {
      expect(await errorDePostgres(insertarEmpresa(2, 999))).toEqual({ codigo: '23503', restriccion: 'companies_userId_fkey' });
    });

    test('rechazar una distribuidora cuyo usuario no existe', async () => {
      expect(await errorDePostgres(insertarDistribuidora(2, 999))).toEqual({ codigo: '23503', restriccion: 'distributors_userId_fkey' });
    });

    test('rechazar un usuario con un rol inexistente', async () => {
      expect(await errorDePostgres(insertarUsuario(40, 99))).toEqual({ codigo: '23503', restriccion: 'users_roleId_fkey' });
    });

    test('impedir borrar un rol que tiene usuarios, sin tocar a esos usuarios', async () => {
      expect(await errorDePostgres(sequelize.query('DELETE FROM roles WHERE id = 2'))).toEqual({
        codigo: '23503',
        restriccion: 'users_roleId_fkey',
      });

      expect(await consultar('SELECT id FROM users WHERE "roleId" = 2')).toEqual([{ id: 30 }]);
    });

    test('quitar las tres foreign keys al revertir y permitir migrar de nuevo', async () => {
      await bajar();
      expect(await restriccionesNuevas()).toEqual([]);

      await subir();
      expect(await restriccionesNuevas()).toHaveLength(3);
    });
  });

  describe('modelos', () => {
    beforeEach(async () => {
      assertSafeToWipe();
      await sequelize.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
      await sequelize.sync();
    });

    test('declarar la misma acción que la migración, para que `sync` arme la misma base', async () => {
      expect(await restriccionesNuevas()).toEqual([
        { conname: 'companies_userId_fkey', confdeltype: 'c', confupdtype: 'c' },
        { conname: 'distributors_userId_fkey', confdeltype: 'c', confupdtype: 'c' },
        { conname: 'users_roleId_fkey', confdeltype: 'r', confupdtype: 'c' },
      ]);
    });
  });

  describe('si una de las restricciones ya existe', () => {
    beforeEach(async () => {
      await sequelize.query(
        'ALTER TABLE users ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES roles (id)'
      );
    });

    test('fallar sin dejar creadas las que alcanzó a agregar antes', async () => {
      expect(await errorDePostgres(subir())).toEqual({ codigo: '42710', restriccion: undefined });

      // Solo queda la que ya estaba, con su acción por defecto (`a` = NO ACTION).
      expect(await restriccionesNuevas()).toEqual([
        { conname: 'users_roleId_fkey', confdeltype: 'a', confupdtype: 'a' },
      ]);
    });
  });

  describe('con filas huérfanas', () => {
    beforeEach(async () => {
      await insertarUsuario(10, 3);
      await insertarUsuario(11, 99);
      await insertarEmpresa(1, 10);
      await insertarEmpresa(2, 999);
      await insertarDistribuidora(3, 888);
    });

    test('detenerse y listar cada fila huérfana', async () => {
      await expect(subir()).rejects.toThrow(
        'No se agregaron las foreign keys: hay filas que apuntan a un registro inexistente. ' +
          'Revisarlas una por una antes de volver a migrar: ' +
          'companies.id=2 (userId=999), distributors.id=3 (userId=888), users.id=11 (roleId=99)'
      );
    });

    test('dejar la base sin cambios: ni foreign keys nuevas ni filas borradas', async () => {
      await expect(subir()).rejects.toThrow('No se agregaron las foreign keys');

      expect(await restriccionesNuevas()).toEqual([]);
      expect(await consultar('SELECT id FROM companies ORDER BY id')).toEqual([{ id: 1 }, { id: 2 }]);
      expect(await consultar('SELECT id FROM distributors')).toEqual([{ id: 3 }]);
      expect(await consultar('SELECT id FROM users ORDER BY id')).toEqual([{ id: 10 }, { id: 11 }]);
    });
  });
});
