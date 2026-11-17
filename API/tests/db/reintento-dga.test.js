// reintento-dga.test.js
//
// El reintento diario a la DGA reemplaza al SENDER, que no corre desde marzo
// de 2025. Sigue la sección 6 del documento de transmisión de la DGA: reenviar
// cada día lo que no recibió `00` (§6.2), con 5 minutos entre envíos (§6.1), y
// sin retransmitir lo que la DGA ya tiene (§6.3).
//
// Usa una base real armada con las migraciones, porque la selección es una
// consulta SQL. Sin red: el cliente HTTP de la DGA va mockeado.

const mockPost = jest.fn();

jest.mock('axios', () => ({
  create: () => ({ post: (...a) => mockPost(...a) }),
  post: jest.fn(),
}));

const { sequelize, wellData: WellData } = require('../../models');
const processAndPostData = require('../../src/services/wellData/handleSendData.service');
const { migrarTodo } = require('../helpers/migrar');
const { reintentarPendientes, SEPARACION_MS } = require('../../src/jobs/dga-retry');
const { leerUltimaCorrida, _internal: estadoInterno } = require('../../src/jobs/estado-reintento');

jest.setTimeout(60000);

// 03:00 en Santiago, la hora a la que corre el job.
const AHORA = new Date('2026-11-17T06:00:00.000Z');
const haceHoras = (horas) => new Date(AHORA.getTime() - horas * 60 * 60 * 1000).toISOString();

const ACEPTADO = { data: { status: '00', message: 'Medición subterranea ingresada correctamente' } };

const rechazo = (status, message) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data: { status: String(status), message, data: null } },
  });

const consultar = async (sql) => (await sequelize.query(sql))[0];

const insertarPozo = (code, { activo = true, activadoHaceHoras = 24 * 40 } = {}) =>
  sequelize.query(
    `INSERT INTO wells (name, location, "isActived", "clientId", code, "editStatusDate", "rutEmpresa", "rutUsuario", password, "createdAt", "updatedAt")
     VALUES (:code, 'Región de Valparaíso', :activo, 1, :code, :activado, '76123456-7', '12345678-9', 'clave-del-mop', now(), now())`,
    {
      replacements: {
        code,
        activo,
        activado: activadoHaceHoras === null ? null : haceHoras(activadoHaceHoras),
      },
    }
  );

let siguienteId = 1;

const insertarReporte = async (code, { creadoHaceHoras, date = '16/11/2026', hour, sent = false }) => {
  const id = siguienteId++;
  await sequelize.query(
    `INSERT INTO "wellData" (id, code, date, hour, totalizador, caudal, nivel_freatico, sent, "createdAt", "updatedAt")
     VALUES (:id, :code, :date, :hour, 1200, 3.5, 12.4, :sent, :creado, :creado)`,
    { replacements: { id, code, date, hour, sent, creado: haceHoras(creadoHaceHoras) } }
  );
  return id;
};

const enviados = async () =>
  (await consultar('SELECT id FROM "wellData" WHERE sent = true ORDER BY id')).map((fila) => fila.id);

// Lo que se transmitió a la DGA, en orden: obra y hora de cada envío.
const transmitidos = () =>
  mockPost.mock.calls.map(([, cuerpo, opciones]) => ({
    obra: opciones.headers.codigoObra,
    hora: cuerpo.medicionSubterranea.horaMedicion,
  }));

const correr = (opciones = {}) => reintentarPendientes({ ahora: AHORA, esperar: jest.fn(), ...opciones });

describe('reintento diario a la DGA', () => {
  beforeEach(async () => {
    await migrarTodo();
    await sequelize.query(`
      INSERT INTO roles (id, type, description, "isAdmin", "isCompany", "isDistributor", "createdAt", "updatedAt")
        VALUES (2, 'normal', 'Cliente', false, false, false, now(), now());
      INSERT INTO users (id, name, email, encrypted_password, "roleId", "isActived", "createdAt", "updatedAt")
        VALUES (1, 'Cliente', 'cliente@example.com', 'x', 2, true, now(), now());
      INSERT INTO clients (id, "userId", "createdAt", "updatedAt") VALUES (1, 1, now(), now());`);
    siguienteId = 1;
    estadoInterno.reiniciar();
    mockPost.mockReset();
    mockPost.mockResolvedValue(ACEPTADO);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('con un pozo activo', () => {
    beforeEach(async () => {
      await insertarPozo('OB-0902-639');
    });

    test('enviar una sola medición por hora, la primera que llegó', async () => {
      const primera = await insertarReporte('OB-0902-639', { creadoHaceHoras: 20, hour: '10:01' });
      await insertarReporte('OB-0902-639', { creadoHaceHoras: 19.5, hour: '10:31' });

      const resultado = await correr();

      expect(transmitidos()).toEqual([{ obra: 'OB-0902-639', hora: '10:01:00' }]);
      expect(await enviados()).toEqual([primera]);
      expect(resultado).toEqual({ pendientes: 1, aceptados: 1, fallidos: 0, omitidos: 0 });
    });

    test('omitir una hora que ya tiene un reporte enviado, sin marcar el pendiente', async () => {
      const yaEnviado = await insertarReporte('OB-0902-639', { creadoHaceHoras: 20, hour: '10:01', sent: true });
      await insertarReporte('OB-0902-639', { creadoHaceHoras: 19.5, hour: '10:31' });

      await correr();

      expect(mockPost).not.toHaveBeenCalled();
      expect(await enviados()).toEqual([yaEnviado]);
    });

    test('reconocer la misma hora escrita con y sin cero inicial', async () => {
      const yaEnviado = await insertarReporte('OB-0902-639', { creadoHaceHoras: 20, hour: '09:01', sent: true });
      await insertarReporte('OB-0902-639', { creadoHaceHoras: 19.5, hour: '9:31' });

      const resultado = await correr();

      expect(mockPost).not.toHaveBeenCalled();
      expect(await enviados()).toEqual([yaEnviado]);
      expect(resultado.pendientes).toBe(0);
    });

    test('tratar como horas distintas las de dos fechas distintas', async () => {
      await insertarReporte('OB-0902-639', { creadoHaceHoras: 44, date: '15/11/2026', hour: '10:01', sent: true });
      const otroDia = await insertarReporte('OB-0902-639', { creadoHaceHoras: 20, date: '16/11/2026', hour: '10:01' });

      await correr();

      expect(await enviados()).toContain(otroDia);
    });

    test('enviar primero las fallas de ayer y después las más antiguas, cada grupo por antigüedad', async () => {
      await insertarReporte('OB-0902-639', { creadoHaceHoras: 5, date: '16/11/2026', hour: '22:01' });
      await insertarReporte('OB-0902-639', { creadoHaceHoras: 24 * 5, date: '12/11/2026', hour: '03:01' });
      await insertarReporte('OB-0902-639', { creadoHaceHoras: 20, date: '16/11/2026', hour: '07:01' });
      await insertarReporte('OB-0902-639', { creadoHaceHoras: 30, date: '15/11/2026', hour: '21:01' });

      await correr();

      expect(transmitidos().map((t) => t.hora)).toEqual(['07:01:00', '22:01:00', '03:01:00', '21:01:00']);
    });

    test('esperar 5 minutos entre envíos, y no antes del primero', async () => {
      await insertarReporte('OB-0902-639', { creadoHaceHoras: 30, hour: '00:01' });
      await insertarReporte('OB-0902-639', { creadoHaceHoras: 10, hour: '18:01' });
      await insertarReporte('OB-0902-639', { creadoHaceHoras: 5, hour: '23:01' });
      const esperar = jest.fn();

      await correr({ esperar });

      expect(esperar.mock.calls).toEqual([[SEPARACION_MS], [SEPARACION_MS]]);
      expect(SEPARACION_MS).toBe(300000);
    });

    test('dejar fuera los reportes de las últimas 2 horas, que todavía puede enviar el envío automático', async () => {
      await insertarReporte('OB-0902-639', { creadoHaceHoras: 1.5, date: '17/11/2026', hour: '01:31' });

      expect(await correr()).toEqual({ pendientes: 0, aceptados: 0, fallidos: 0, omitidos: 0 });
    });

    test('dejar para mañana una falla de hoy aunque tenga más de 2 horas, porque la DGA pide reenviar el día siguiente', async () => {
      await insertarReporte('OB-0902-639', { creadoHaceHoras: 2.5, date: '17/11/2026', hour: '00:31' });

      expect((await correr()).pendientes).toBe(0);
    });

    test('incluir una falla de ayer a las 23:30', async () => {
      const ayer = await insertarReporte('OB-0902-639', { creadoHaceHoras: 3.5, date: '16/11/2026', hour: '23:31' });

      await correr();

      expect(await enviados()).toEqual([ayer]);
    });

    test('incluir reportes de hasta 35 días y dejar fuera los más antiguos', async () => {
      const dentro = await insertarReporte('OB-0902-639', { creadoHaceHoras: 24 * 35 - 1, date: '13/10/2026', hour: '07:01' });
      await insertarReporte('OB-0902-639', { creadoHaceHoras: 24 * 35 + 1, date: '13/10/2026', hour: '05:01' });

      await correr();

      expect(await enviados()).toEqual([dentro]);
    });

    test('seguir con los demás cuando la DGA rechaza uno', async () => {
      const rechazado = await insertarReporte('OB-0902-639', { creadoHaceHoras: 20, hour: '07:01' });
      const aceptado = await insertarReporte('OB-0902-639', { creadoHaceHoras: 10, hour: '18:01' });
      mockPost.mockRejectedValueOnce(rechazo(401, 'Credenciales inválidas'));

      const resultado = await correr();

      expect(await enviados()).toEqual([aceptado]);
      expect(resultado).toEqual({ pendientes: 2, aceptados: 1, fallidos: 1, omitidos: 0 });
      expect(console.error).toHaveBeenCalledWith(
        `[reintento-dga] falló el reintento del reporte ${rechazado} (OB-0902-639 16/11/2026 07:01): No se pudo enviar los datos a la DGA. Por favor revisa bien los parámetros que estás enviando`
      );
    });

    test('seguir con los demás si falla la lectura de un reporte en la base', async () => {
      const primero = await insertarReporte('OB-0902-639', { creadoHaceHoras: 20, hour: '07:01' });
      const segundo = await insertarReporte('OB-0902-639', { creadoHaceHoras: 10, hour: '18:01' });
      jest.spyOn(WellData, 'findByPk').mockRejectedValueOnce(new Error('Connection terminated unexpectedly'));

      const resultado = await correr();

      expect(await enviados()).toEqual([segundo]);
      expect(resultado).toEqual({ pendientes: 2, aceptados: 1, fallidos: 1, omitidos: 0 });
      expect(console.error).toHaveBeenCalledWith(
        `[reintento-dga] falló el reintento del reporte ${primero}: Connection terminated unexpectedly`
      );
    });

    test('impedir que quien cargó el reporte antes de la corrida lo retransmita después', async () => {
      const id = await insertarReporte('OB-0902-639', { creadoHaceHoras: 10, hour: '18:01' });
      const cargadoAntes = await WellData.findByPk(id);
      const pozo = await cargadoAntes.getWell();

      await correr();
      await processAndPostData(cargadoAntes, pozo);

      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    test('marcar como enviado el reporte que la DGA rechaza porque ya tiene esa hora', async () => {
      const id = await insertarReporte('OB-0902-639', { creadoHaceHoras: 10, hour: '18:01' });
      mockPost.mockRejectedValueOnce(
        rechazo(400, 'Ya existe un registro en esa fecha, hora para la obra. Comprobante: FftIxl9AfqEO7erAEqOcFz2fi75sMaRQ')
      );

      await correr();

      expect(await enviados()).toEqual([id]);
    });

    test('respetar el máximo de envíos por corrida, sin dejar fuera las fallas de ayer por las antiguas', async () => {
      await insertarReporte('OB-0902-639', { creadoHaceHoras: 24 * 5, date: '12/11/2026', hour: '03:01' });
      await insertarReporte('OB-0902-639', { creadoHaceHoras: 24 * 4, date: '13/11/2026', hour: '03:01' });
      await insertarReporte('OB-0902-639', { creadoHaceHoras: 10, date: '16/11/2026', hour: '17:01' });

      const resultado = await correr({ maximo: 2 });

      expect(transmitidos().map((t) => t.hora)).toEqual(['17:01:00', '03:01:00']);
      expect(resultado.pendientes).toBe(2);
    });

    test('omitir un reporte que se envió mientras la corrida esperaba su turno', async () => {
      await insertarReporte('OB-0902-639', { creadoHaceHoras: 20, hour: '07:01' });
      const segundo = await insertarReporte('OB-0902-639', { creadoHaceHoras: 10, hour: '18:01' });
      const esperar = jest.fn(() => sequelize.query(`UPDATE "wellData" SET sent = true WHERE id = ${segundo}`));

      const resultado = await correr({ esperar });

      expect(transmitidos().map((t) => t.hora)).toEqual(['07:01:00']);
      expect(resultado).toMatchObject({ aceptados: 1, omitidos: 1 });
    });

    test('rechazar una segunda corrida mientras la primera sigue en curso', async () => {
      await insertarReporte('OB-0902-639', { creadoHaceHoras: 10, hour: '18:01' });
      let liberar;
      let avisarEnvio;
      const envioEnCurso = new Promise((resolve) => { avisarEnvio = resolve; });
      mockPost.mockImplementationOnce(() => {
        avisarEnvio();
        return new Promise((resolve) => { liberar = () => resolve(ACEPTADO); });
      });

      const primera = correr();
      await envioEnCurso;
      const segunda = await correr();
      liberar();
      await primera;

      expect(segunda).toEqual({ omitida: true });
      expect(mockPost).toHaveBeenCalledTimes(1);
    });
  });

  describe('según el estado del pozo', () => {
    test('omitir los pozos inactivos desde la selección, sin ocupar el máximo por corrida', async () => {
      await insertarPozo('OB-0701-1496', { activo: false });
      await insertarReporte('OB-0701-1496', { creadoHaceHoras: 10, hour: '18:01' });

      const resultado = await correr();

      expect(mockPost).not.toHaveBeenCalled();
      expect(resultado.pendientes).toBe(0);
    });

    test('incluir un pozo activo sin editStatusDate (#69)', async () => {
      await insertarPozo('OB-1304-1749', { activadoHaceHoras: null });
      const id = await insertarReporte('OB-1304-1749', { creadoHaceHoras: 10, hour: '18:02' });

      await correr();

      expect(await enviados()).toEqual([id]);
    });

    test('omitir los reportes creados antes de la última activación del pozo', async () => {
      await insertarPozo('OB-0902-1553', { activadoHaceHoras: 12 });
      await insertarReporte('OB-0902-1553', { creadoHaceHoras: 20, hour: '10:01' });
      const despues = await insertarReporte('OB-0902-1553', { creadoHaceHoras: 10, hour: '18:01' });

      await correr();

      expect(await enviados()).toEqual([despues]);
    });

    test('omitir un pozo que se desactivó mientras la corrida esperaba su turno', async () => {
      await insertarPozo('OB-0902-639');
      await insertarPozo('OB-0701-1496');
      await insertarReporte('OB-0902-639', { creadoHaceHoras: 20, hour: '07:01' });
      await insertarReporte('OB-0701-1496', { creadoHaceHoras: 10, hour: '18:01' });
      const esperar = jest.fn(() =>
        sequelize.query(`UPDATE wells SET "isActived" = false WHERE code = 'OB-0701-1496'`)
      );

      const resultado = await correr({ esperar });

      expect(transmitidos().map((t) => t.obra)).toEqual(['OB-0902-639']);
      expect(resultado).toMatchObject({ aceptados: 1, omitidos: 1 });
    });
  });

  describe('estado de la corrida, que lee la alerta de las 08:00', () => {
    beforeEach(async () => {
      await insertarPozo('OB-0902-639');
    });

    test('registrar la corrida terminada con sus resultados', async () => {
      await insertarReporte('OB-0902-639', { creadoHaceHoras: 20, hour: '07:01' });
      await insertarReporte('OB-0902-639', { creadoHaceHoras: 10, hour: '17:01' });
      mockPost.mockRejectedValueOnce(rechazo(401, 'Credenciales inválidas'));

      await correr();

      expect(leerUltimaCorrida()).toEqual({
        inicio: AHORA,
        terminada: true,
        pendientes: 2,
        alcanzoElMaximo: false,
        aceptados: 1,
        fallidos: 1,
        omitidos: 0,
        error: null,
      });
    });

    test('marcar que la corrida llegó al máximo de envíos', async () => {
      await insertarReporte('OB-0902-639', { creadoHaceHoras: 20, hour: '07:01' });
      await insertarReporte('OB-0902-639', { creadoHaceHoras: 10, hour: '17:01' });

      await correr({ maximo: 2 });

      expect(leerUltimaCorrida()).toMatchObject({ terminada: true, alcanzoElMaximo: true });
    });

    test('mostrar la corrida en curso con lo que lleva', async () => {
      await insertarReporte('OB-0902-639', { creadoHaceHoras: 20, hour: '07:01' });
      await insertarReporte('OB-0902-639', { creadoHaceHoras: 10, hour: '17:01' });
      let enLaEspera;
      const esperar = jest.fn(() => {
        enLaEspera = leerUltimaCorrida();
      });

      await correr({ esperar });

      expect(enLaEspera).toMatchObject({ terminada: false, pendientes: 2, aceptados: 1 });
    });

    test('registrar el error si la búsqueda de pendientes falla', async () => {
      await sequelize.query('DROP TABLE "wellData" CASCADE');

      // Se compara solo la forma del error: su texto lo traduce Postgres según
      // `lc_messages`.
      const error = await correr().catch((e) => e);

      expect(error).toBeInstanceOf(Error);
      expect(leerUltimaCorrida()).toMatchObject({ terminada: true, error: error.message });
    });
  });
});
