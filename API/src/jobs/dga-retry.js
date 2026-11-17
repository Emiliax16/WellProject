// Reintento diario de los reportes que la DGA no aceptó.
//
// Reemplaza al SENDER (Rails), que hacía lo mismo llamando a la API por HTTP.
// Sigue la sección 6 del documento de transmisión de la DGA ("Transmisión MEE
// subterráneas, nueva API"):
//
// - §6.2: si la respuesta no es `00`, o no llega, la medición se reenvía una
//   vez al día siguiente, y así cada día hasta recibir `00`. Por eso corre una
//   vez al día y vuelve a tomar lo que siga pendiente.
// - §6.1: las mediciones atrasadas se envían una por una, con al menos 5
//   minutos entre cada envío.
// - §6.3: no se retransmiten mediciones que la DGA ya tiene. Se omite toda hora
//   de un pozo que ya tenga un reporte enviado, y `processAndPostData` lo vuelve
//   a comprobar justo antes de transmitir.
//
// Diferencias con el SENDER, a propósito:
//
// - Un rechazo no detiene la corrida. El SENDER abortaba el lote en el primer
//   error, así que un pozo con credenciales malas dejaba sin reintento a todos
//   los demás.
// - Envía una medición por hora y por pozo, la primera que llegó. La DGA guarda
//   una sola por hora, y transmitir la segunda solo produciría un rechazo.
// - La ventana es de 35 días, decidida con Emilia el 17-11-2026. La de 3 días
//   venía de agosto, cuando la cola tenía 57 mil duplicados; con los
//   duplicados resueltos (PRs #97 y #98) lo que queda son fallas reales, y la
//   DGA pide seguir reintentándolas.
// - Un pozo activo sin `editStatusDate` también entra (#69). El modelo `well`
//   ahora la fija cada vez que cambia `isActived`, pero los pozos anteriores a
//   ese cambio pueden tenerla vacía.

const moment = require('moment-timezone');
const { sequelize, wellData: WellData } = require('../../models');
const processAndPostData = require('../services/wellData/handleSendData.service');

const DIAS_DE_VENTANA = 35;

// Margen para que el envío automático del hook `afterCreate` haya tenido su
// oportunidad, igual que en `fetchUnsentReports`.
const HORAS_DE_GRACIA = 2;

// §6.2 pide reenviar "el día siguiente del envío fallido". Por eso solo entran
// reportes de días anteriores al de la corrida, en hora de Chile: una falla de
// las 00:30 se reintenta a las 03:00 del día siguiente, no dos horas y media
// después.
const ZONA = 'America/Santiago';

// §6.1: al menos 5 minutos entre cada envío de mediciones atrasadas.
const SEPARACION_MS = 5 * 60 * 1000;

// Con 5 minutos entre envíos, 250 reportes ocupan casi 21 horas: la corrida
// termina antes de la siguiente. Lo que exceda queda para el día siguiente.
const MAXIMO_POR_CORRIDA = 250;

// La hora de un reporte (`HH:mm`, `H:mm` o con segundos) como número. Si no
// tiene ese formato, el texto completo hace de hora, para que ese reporte forme
// su propio grupo en vez de quedar fuera.
const HORA_SQL = (tabla) =>
  `COALESCE(substring(${tabla}.hour from '^\\s*(\\d{1,2}):\\d{2}')::int::text, ${tabla}.hour)`;

// Devuelve los ids a reintentar, del más antiguo al más nuevo: el primer
// reporte de cada pozo, fecha y hora que siga sin enviarse y cuya hora no tenga
// ya otro reporte enviado. Solo trae ids, para que la consulta no cargue
// filas completas en memoria.
const buscarPendientes = async ({ ahora = new Date(), maximo = MAXIMO_POR_CORRIDA } = {}) => {
  const conGracia = ahora.getTime() - HORAS_DE_GRACIA * 60 * 60 * 1000;
  const inicioDelDia = moment(ahora).tz(ZONA).startOf('day').valueOf();
  // `createdAt < hasta`, para que un reporte creado justo a medianoche cuente
  // como del día de la corrida.
  const hasta = new Date(Math.min(conGracia, inicioDelDia));
  const desde = new Date(ahora.getTime() - DIAS_DE_VENTANA * 24 * 60 * 60 * 1000);

  const [filas] = await sequelize.query(
    `
    WITH candidatos AS (
      SELECT d.id, d.code, d.date, d."createdAt", ${HORA_SQL('d')} AS hora
        FROM "wellData" d
        JOIN wells w ON w.code = d.code
       WHERE d.sent = false
         AND d."createdAt" >= :desde
         AND d."createdAt" < :hasta
         AND w."isActived" = true
         AND (w."editStatusDate" IS NULL OR d."createdAt" >= w."editStatusDate")
    ),
    horas_enviadas AS (
      SELECT DISTINCT s.code, s.date, ${HORA_SQL('s')} AS hora
        FROM "wellData" s
       WHERE s.sent = true
         AND (s.code, s.date) IN (SELECT code, date FROM candidatos)
    ),
    primero_de_cada_hora AS (
      SELECT DISTINCT ON (c.code, c.date, c.hora) c.id, c."createdAt"
        FROM candidatos c
       WHERE NOT EXISTS (
               SELECT 1 FROM horas_enviadas h
                WHERE h.code = c.code AND h.date = c.date AND h.hora = c.hora
             )
       ORDER BY c.code, c.date, c.hora, c."createdAt", c.id
    )
    SELECT id FROM primero_de_cada_hora
     ORDER BY "createdAt", id
     LIMIT :maximo
    `,
    { replacements: { desde, hasta, maximo } }
  );

  return filas.map((fila) => fila.id);
};

// El reporte y su pozo, si el reporte sigue sin enviarse y el pozo sigue
// activo. Si no, ambos vienen en `null`.
const leerEnviable = async (id) => {
  const reporte = await WellData.findByPk(id);
  const pozo = reporte && !reporte.sent ? await reporte.getWell() : null;
  return pozo && pozo.isActived ? { reporte, pozo } : { reporte: null, pozo: null };
};

const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Evita dos corridas a la vez, por ejemplo si una se alarga y node-cron recupera
// una ejecución. Si el proceso se reinicia a mitad de camino no queda nada
// colgado: lo que falte se toma en la corrida siguiente.
let enCurso = false;

const reintentarPendientes = async ({
  ahora = new Date(),
  esperar = dormir,
  maximo = MAXIMO_POR_CORRIDA,
} = {}) => {
  if (enCurso) {
    console.warn('[reintento-dga] ya hay una corrida en curso; se omite esta');
    return { omitida: true };
  }
  enCurso = true;

  try {
    const ids = await buscarPendientes({ ahora, maximo });
    console.log(
      `[reintento-dga] ${ids.length} medición(es) pendiente(s) de los últimos ${DIAS_DE_VENTANA} días`
    );

    const resultado = { pendientes: ids.length, aceptados: 0, fallidos: 0, omitidos: 0 };
    let transmitioAntes = false;

    for (const id of ids) {
      let reporte = null;
      try {
        // La corrida puede durar horas: cada reporte y su pozo se vuelven a leer
        // justo antes de enviarlo, por si se envió o se desactivó entre medio.
        // Si hay que esperar los 5 minutos, se leen otra vez después.
        let pozo;
        ({ reporte, pozo } = await leerEnviable(id));
        if (reporte && transmitioAntes) {
          await esperar(SEPARACION_MS);
          ({ reporte, pozo } = await leerEnviable(id));
        }
        if (!reporte) {
          resultado.omitidos += 1;
          continue;
        }
        transmitioAntes = true;

        await processAndPostData(reporte, pozo);
        resultado.aceptados += 1;
      } catch (error) {
        // Puede ser un rechazo de la DGA, un timeout o un error propio, como
        // la base caída: en ningún caso se corta la corrida. Solo se registra
        // el mensaje, porque un error de axios completo podría arrastrar el
        // cuerpo enviado, que lleva las credenciales DGA del pozo.
        resultado.fallidos += 1;
        const detalle = reporte ? ` (${reporte.code} ${reporte.date} ${reporte.hour})` : '';
        console.error(`[reintento-dga] falló el reintento del reporte ${id}${detalle}: ${error.message}`);
      }
    }

    console.log('[reintento-dga] resultado:', resultado);
    return resultado;
  } finally {
    enCurso = false;
  }
};

module.exports = {
  reintentarPendientes,
  buscarPendientes,
  DIAS_DE_VENTANA,
  HORAS_DE_GRACIA,
  SEPARACION_MS,
  MAXIMO_POR_CORRIDA,
};
