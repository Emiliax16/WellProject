// Mediciones que la DGA todavía no aceptó.
//
// Lo usan el reintento diario (`src/jobs/dga-retry.js`), que las reenvía, y la
// alerta de las 08:00 (`monitoring.controller.js`), que avisa de las que siguen
// sin llegar. Las dos parten de la misma consulta para que nunca discrepen
// sobre qué cuenta como pendiente.
//
// Una medición pendiente es una hora de un pozo (obra, fecha y hora del día)
// que tiene reportes, ninguno enviado, y que cumple estas condiciones:
//
// - El pozo está activo y el reporte se creó después de su última activación
//   (`editStatusDate`), o el pozo no tiene esa fecha (#69).
// - El reporte se creó en un día anterior al de la consulta, en hora de Chile,
//   y hace más de 2 horas. §6.2 del documento de transmisión de la DGA pide
//   reenviar "el día siguiente del envío fallido", y las 2 horas dan tiempo al
//   envío automático del hook `afterCreate`.
// - El reporte tiene como máximo 35 días, la ventana que decidió Emilia el
//   17-11-2026.

const moment = require('moment-timezone');
const { sequelize } = require('../../../models');

const DIAS_DE_VENTANA = 35;
const HORAS_DE_GRACIA = 2;
const ZONA = 'America/Santiago';

// La hora de un reporte (`HH:mm`, `H:mm` o con segundos) como número. Si no
// tiene ese formato, el texto completo hace de hora, para que ese reporte forme
// su propio grupo en vez de quedar fuera.
const HORA_SQL = (tabla) =>
  `COALESCE(substring(${tabla}.hour from '^\\s*(\\d{1,2}):\\d{2}')::int::text, ${tabla}.hour)`;

// Límites de la ventana para un momento dado.
const ventana = (ahora) => {
  const inicioDeHoy = moment(ahora).tz(ZONA).startOf('day');
  const conGracia = ahora.getTime() - HORAS_DE_GRACIA * 60 * 60 * 1000;
  return {
    desde: new Date(ahora.getTime() - DIAS_DE_VENTANA * 24 * 60 * 60 * 1000),
    // `createdAt < hasta`, para que un reporte creado justo a medianoche cuente
    // como del día de la consulta.
    hasta: new Date(Math.min(conGracia, inicioDeHoy.valueOf())),
    inicioDeAyer: inicioDeHoy.clone().subtract(1, 'day').toDate(),
  };
};

// El primer reporte de cada medición pendiente. Recibe `:desde` y `:hasta`.
const MEDICIONES_PENDIENTES = `
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
  pendientes AS (
    SELECT DISTINCT ON (c.code, c.date, c.hora) c.id, c.code, c."createdAt"
      FROM candidatos c
     WHERE NOT EXISTS (
             SELECT 1 FROM horas_enviadas h
              WHERE h.code = c.code AND h.date = c.date AND h.hora = c.hora
           )
     ORDER BY c.code, c.date, c.hora, c."createdAt", c.id
  )`;

// Ids a reintentar, del más antiguo al más nuevo. Solo trae ids, para que la
// consulta no cargue filas completas en memoria.
const buscarPendientes = async ({ ahora = new Date(), maximo }) => {
  const { desde, hasta } = ventana(ahora);
  const [filas] = await sequelize.query(
    `${MEDICIONES_PENDIENTES}
     SELECT id FROM pendientes ORDER BY "createdAt", id LIMIT :maximo`,
    { replacements: { desde, hasta, maximo } }
  );
  return filas.map((fila) => fila.id);
};

// Resumen por pozo de lo que sigue pendiente: cuántas mediciones son de ayer
// (ya pasaron por el envío automático y por el reintento de las 03:00) y
// cuántas suman en total dentro de la ventana.
const resumenSinAceptar = async ({ ahora = new Date() } = {}) => {
  const { desde, hasta, inicioDeAyer } = ventana(ahora);
  const [filas] = await sequelize.query(
    `${MEDICIONES_PENDIENTES}
     SELECT p.code,
            w.name,
            count(*) FILTER (WHERE p."createdAt" >= :inicioDeAyer)::int AS "deAyer",
            count(*)::int AS total,
            min(p."createdAt") AS "masAntigua"
       FROM pendientes p
       JOIN wells w ON w.code = p.code
      GROUP BY p.code, w.name
      ORDER BY "deAyer" DESC, total DESC, p.code`,
    { replacements: { desde, hasta, inicioDeAyer } }
  );
  return filas.map((fila) => ({ ...fila, masAntigua: new Date(fila.masAntigua) }));
};

module.exports = {
  buscarPendientes,
  resumenSinAceptar,
  DIAS_DE_VENTANA,
  HORAS_DE_GRACIA,
};
