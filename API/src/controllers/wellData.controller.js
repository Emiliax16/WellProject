const db = require("../../models");

const Well = db.well;
const WellData = db.wellData;
const Client = db.client;

const processAndPostData = require("../services/wellData/handleSendData.service");
const ErrorHandler = require("../utils/error.util");
const checkPermissionsForClientResources = require("../utils/check-permissions");
const getPaginationParameters = require("../utils/query-params.util");
const moment = require("moment-timezone");
const { bulkCreateWellDataIsNotArray, unauthorized } = require("../utils/errorcodes.util");

// Comprueba que el solicitante pueda operar sobre todos los reportes de la
// tanda. Se exige el lote completo en vez de filtrar los ajenos en silencio:
// si la petición trae algo que no le corresponde, es un error de quien llama,
// y borrar o transmitir "sólo una parte" es peor que rechazar.
const assertOwnsReports = async (requester, reports) => {
  // Se comprueba una vez por cliente distinto, no una vez por reporte:
  // checkPermissions consulta la base, y un lote de miles de reportes casi
  // siempre pertenece a uno o dos clientes.
  const porCliente = new Map();
  for (const report of reports) {
    const cliente = report.well?.client;
    // Sin cliente resoluble no se puede afirmar pertenencia: se niega.
    if (!cliente) {
      throw new ErrorHandler(unauthorized);
    }
    if (!porCliente.has(cliente.id)) {
      porCliente.set(cliente.id, cliente);
    }
  }

  for (const cliente of porCliente.values()) {
    if (!await checkPermissionsForClientResources(requester, cliente)) {
      throw new ErrorHandler(unauthorized);
    }
  }
};

/**
 * Normaliza un valor numérico que puede venir con coma como separador decimal
 * Convierte "2,00" a 2.00 (número)
 * @param {string|number} value - Valor a normalizar
 * @returns {number} Valor numérico con punto decimal
 */
const normalizeDecimalValue = (value) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Reemplazar coma por punto y convertir a número
    return parseFloat(value.replace(',', '.'));
  }
  return value;
};

/**
 * Parsea una fecha del formato DD/MM/YYYY a un objeto Date
 * @param {string} dateStr - Fecha en formato DD/MM/YYYY
 * @returns {Date|null} Objeto Date o null si el formato es inválido
 */
const parseDateString = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  // Formato DD/MM/YYYY
  const ddmmyyyyMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    return new Date(year, month - 1, day);
  }
  
  // Formato ISO YYYY-MM-DD
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(year, month - 1, day);
  }
  
  return null;
};

/**
 * Normaliza los campos numéricos de un reporte (caudal y nivel_freatico)
 * y rellena automáticamente el campo realDate desde date
 * @param {Object} reportData - Datos del reporte
 * @returns {Object} Reporte con valores normalizados
 */
const normalizeReportNumericFields = (reportData) => {
  return {
    ...reportData,
    caudal: normalizeDecimalValue(reportData.caudal),
    nivel_freatico: normalizeDecimalValue(reportData.nivel_freatico),
    realDate: parseDateString(reportData.date)
  };
};

const createWellData = async (req, res, next) => {
  try {
    console.log(req.body);
    const well = await Well.findOne({ where: { code: req.body.code } }); // Buscamos el pozo por su código
    if (!well) {
      return res.status(404).send({
        message: "Code no pertenece a ningún pozo registrado",
      });
    }

    // Por hora, llegarán 4 reportes pero tendrán la misma hora y fecha, la idea es que si el primero
    // no se envía por errores de interferencia/conexión, se pueda capturar alguno de los otros tres reportes.
    // El primero que llega con esa fecha y hora, se guarda y los otros tres se descartan.
    const existingWellData = await WellData.findOne({
      where: {
        date: req.body.date,
        hour: req.body.hour,
        code: req.body.code,
      },
    });
    if (existingWellData) {
      return res.status(400).send({
        message: "Ya existe un reporte para esa fecha y hora",
      });
    }

    // Normalizar valores numéricos (coma a punto)
    const normalizedData = normalizeReportNumericFields(req.body);
    const wellData = await WellData.create(normalizedData);
    res.json(wellData);
  } catch (error) {
    // Ruta pública de ingesta: respondiendo con `error.message` se filtraba el
    // detalle interno a cualquiera. Se delega en el middleware de errores.
    next(error);
  }
};

const bulkCreateWellData = async (req, res, next) => {
  try {
    const rawData = req.body;
    console.log(typeof rawData);
    if (!Array.isArray(rawData)) {
      throw new ErrorHandler(bulkCreateWellDataIsNotArray);
    }

    const errors = [];
    const validReports = [];

    // 1) Pozos en una sola query
    const uniqueCodes = [...new Set(rawData.map(i => i.code))];
    const wells = await Well.findAll({
      where: { code: { [db.Op.in]: uniqueCodes } }
    });
    const wellsMap = new Map(wells.map(w => [w.code, w]));

    // 2) Existing en una o más queries (chunk opcional)
    const chunkSize = 500; // ajusta si lo necesitas
    const makeKey = (i) => `${i.code}-${i.date}-${i.hour}`;

    const allKeys = rawData.map(makeKey);
    const existingSet = new Set();

    for (let i = 0; i < rawData.length; i += chunkSize) {
      const slice = rawData.slice(i, i + chunkSize);
      const existing = await WellData.findAll({
        where: {
          [db.Op.or]: slice.map(item => ({
            date: item.date,
            hour: item.hour,
            code: item.code
          }))
        }
      });
      for (const row of existing) {
        existingSet.add(`${row.code}-${row.date}-${row.hour}`);
      }
    }

    // 3) Validación por item (manteniendo mensajes)
    const seen = new Set(); // para duplicados en la MISMA petición
    for (const wellData of rawData) {
      console.log(`This is the wellData: ${JSON.stringify(wellData)}`);
      
      // Normalizar valores numéricos (coma a punto)
      const normalizedWellData = normalizeReportNumericFields(wellData);
      const { code, date, hour } = normalizedWellData;

      // pozo existe
      if (!wellsMap.get(code)) {
        errors.push({
          message: "Code no pertenece a ningún pozo registrado",
          report: wellData,
        });
        continue;
      }

      const key = `${code}-${date}-${hour}`;

      // duplicado dentro del mismo batch (preserva comportamiento original)
      if (seen.has(key)) {
        errors.push({
          message: "Ya existe un reporte para esa fecha y hora",
          report: wellData,
        });
        continue;
      }
      seen.add(key);

      // ya existía en DB
      if (existingSet.has(key)) {
        errors.push({
          message: "Ya existe un reporte para esa fecha y hora",
          report: wellData,
        });
        continue;
      }

      validReports.push(normalizedWellData);
    }

    if (validReports.length > 0) {
      await WellData.bulkCreate(validReports);
    }

    if (validReports.length === 0) {
      return res.status(400).send({
        message: "No se pudo crear ningún reporte",
        errors,
      });
    }

    res.status(200).send({
      message: `${validReports.length} de ${rawData.length} pozos fueron creados existosamente.`,
      errors,
    });
  } catch (error) {
    next(error);
  }
};


const repostAllReportsToDGA = async (req, res, next) => {
  try {
    const { reportIds } = req.body;

    if (!reportIds || reportIds.length === 0) {
      return res.status(400).send({
        message: "No se proporcionaron reportes para enviar.",
      });
    }

    const reports = await WellData.findAll({
                                    where: {
                                      id: {
                                        [db.Op.in]: reportIds,
                                      },
                                    },
                                    // OJO: acá el pozo SÍ debe traer sus credenciales DGA, al
                                    // revés que en fetchUnsentReports. Este `well` se pasa a
                                    // processAndPostData, que hace parseRUT(data.rutEmpresa), y
                                    // parseRUT revienta con undefined. Excluirlas "por
                                    // consistencia" rompe el reenvío manual desde el portal.
                                    // No se filtran porque esta respuesta no serializa el pozo.
                                    include: [
                                      {
                                        model: Well,
                                        as: 'well',
                                        include: [{ model: Client, as: 'client' }],
                                      },
                                    ],
                                  });

    console.log("Pending reports BACKKKK IDDD:", reportIds);

    if (reports.length === 0) {
      return res.status(404).send({
        message: "No se encontraron reportes para enviar.",
      });
    }

    // Mismo IDOR que en el borrado masivo: sin esto, cualquiera puede forzar el
    // envío a la DGA de reportes de otro cliente enumerando ids.
    await assertOwnsReports(req.user, reports);

    // Procesar los reportes en paralelo con concurrencia limitada
    const concurrencyLimit = 3; // Limitar la cantidad de envíos simultáneos
    const promises = [];
    let activePromises = 0;

    for (const report of reports) {
      if (activePromises >= concurrencyLimit) {
        await Promise.race(promises); // Esperar a que uno termine
      }

      let well = report.well;
      const promise = processAndPostData(report, well)
        .then((success) => {
          if (success) {
            console.log(`Reporte ${report.id} enviado correctamente.`);
          } else {
            console.error(`Reporte ${report.id} falló en el envío.`);
          }
        })
        .catch((error) => {
          console.error(
            `Error crítico al enviar reporte ${report.id}:`,
            error.message
          );
        })
        .finally(() => {
          activePromises--;
        });

      promises.push(promise);
      activePromises++;
    }

    // Esperar a que todos los procesos terminen
    await Promise.all(promises);

    res.status(200).json({ message: "Se intentó enviar todos los reportes." });
  } catch (error) {
    next(error);
  }
};

const repostToDGA = async (req, res, next) => {
  const { id: wellDataId } = req.body;
  try {
    const wellData = await WellData.findByPk(wellDataId);
    const well = await wellData.getWell();
    await processAndPostData(wellData, well);
    res.json({ message: "Reporte enviado correctamente." }).status(200);
  } catch (error) {
    next(error);
  }
};

// Ventana de reintento. Un reporte que lleva más de tres días sin enviarse ya
// no se reintenta: la DGA lo rechazaría por duplicado o por antigüedad, y
// arrastrar la cola histórica es lo que hizo crecer esta consulta sin techo.
// Decidido con el cliente el 11 de agosto de 2026: la cola anterior se da por
// perdida.
const DIAS_DE_VENTANA = 3;

// Tope de reportes por respuesta. Sin él, esta consulta materializaba en memoria
// los 57.977 reportes pendientes: el 10 de agosto de 2026 Node pidió 11,5 GB en
// una instancia de 957 MB, el OOM killer lo mató y la máquina quedó inaccesible
// 14 horas. Ver el postmortem en `errores/06-caida-2026-08-10...`.
const TAMANO_PAGINA_POR_DEFECTO = 100;
const TAMANO_PAGINA_MAXIMO = 500;

const fetchUnsentReports = async (req, res, next) => {
  try {
    const ahora = moment().tz("America/Santiago");
    // `createdAt <= ahora - 2h` da margen a que el envío automático del hook
    // `afterCreate` haya tenido su oportunidad antes de reintentar.
    const hasta = ahora.clone().subtract(2, "hours").toDate();
    const desde = ahora.clone().subtract(DIAS_DE_VENTANA, "days").toDate();

    // El tamaño se acota siempre, incluso si quien llama pide más: el objetivo
    // es que ninguna petición pueda volver a tumbar la instancia. Se acota por
    // arriba y por abajo: un `size` o un `page` negativos generan un `LIMIT` o
    // un `OFFSET` negativos, que Postgres rechaza.
    // Se usa `Number` y no `parseInt` por el mismo motivo que en
    // `assert-role-change.js`: `parseInt` lee un prefijo y descarta el resto,
    // así que `'1.5'` daría 1 y `'5x'` daría 5. Acá eso convertiría una entrada
    // inválida en una página de tamaño 1 en vez de caer al valor por defecto.
    const enRango = (valor, porDefecto, minimo, maximo) => {
      if (valor === undefined || valor === null || valor === '') {
        return porDefecto;
      }
      const n = Number(valor);
      if (!Number.isInteger(n) || n < minimo) {
        return porDefecto;
      }
      return Math.min(n, maximo);
    };

    const { limit, offset } = getPaginationParameters({
      size: enRango(req.query.size, TAMANO_PAGINA_POR_DEFECTO, 1, TAMANO_PAGINA_MAXIMO),
      page: enRango(req.query.page, 0, 0, Number.MAX_SAFE_INTEGER),
    });

    const { count, rows: unsentReports } = await WellData.findAndCountAll({
      where: {
        sent: false,
        createdAt: {
          // Sólo reportes creados después de la última edición del pozo.
          [db.Op.gte]: db.Sequelize.col("well.editStatusDate"),
          [db.Op.lte]: hasta,
        },
        // La ventana va en su propia condición porque `createdAt` ya tiene un
        // `gte` contra la columna del pozo y un mismo objeto no admite dos.
        [db.Op.and]: [{ createdAt: { [db.Op.gte]: desde } }],
      },
      include: [
        {
          model: Well,
          as: "well",
          // Esta ruta es pública (la consume el SENDER), así que el pozo no
          // puede viajar con sus credenciales DGA. El join se mantiene porque
          // el `where` de arriba lo necesita.
          attributes: { exclude: ["password", "rutEmpresa", "rutUsuario"] },
          where: {
            isActived: true,
            editStatusDate: {
              [db.Op.ne]: null,
            },
          },
        },
      ],
      // Sin un orden estable, paginar es incorrecto: entre una página y la
      // siguiente el motor puede devolver las filas en otro orden y quedarían
      // reportes repetidos y otros nunca entregados. Se ordena por antigüedad,
      // que además es el orden en que conviene reintentar.
      order: [["createdAt", "ASC"], ["id", "ASC"]],
      limit,
      offset,
    });

    // Si no hay reportes no enviados, se envía un 404. El SENDER depende de
    // esto: trata cualquier respuesta no exitosa como "no hay nada que hacer".
    if (unsentReports.length === 0) {
      return res.status(404).send({
        message: "No hay reportes no enviados",
      });
    }

    console.log(
      `[sender] entregando ${unsentReports.length} de ${count} reportes pendientes ` +
      `de los últimos ${DIAS_DE_VENTANA} días (offset ${offset})`
    );

    // Se conserva la forma `{ reports: { id: reporte } }` porque es lo que el
    // SENDER consume (`json_response['reports'].values`). La paginación se
    // agrega como clave aparte para no romper ese contrato.
    const formattedReports = { reports: {} };
    unsentReports.forEach((report) => {
      formattedReports.reports[report.id] = report;
    });
    formattedReports.pagination = {
      totalItems: count,
      totalPages: Math.ceil(count / limit),
      currentPage: Math.floor(offset / limit),
      pageSize: limit,
      windowDays: DIAS_DE_VENTANA,
    };

    res.status(200).json(formattedReports);
  } catch (error) {
    next(error);
  }
};

const bulkDeleteWellData = async (req, res, next) => {
  try {
    const { reportIds } = req.body;

    if (!reportIds || !Array.isArray(reportIds) || reportIds.length === 0) {
      return res.status(400).send({
        message: "Debe proporcionar un array de IDs de reportes para eliminar.",
      });
    }

    // Los ids de reporte son autoincrementales, así que sin comprobar
    // pertenencia basta con enumerar para borrar telemetría de cualquier
    // cliente. Se resuelve el dueño de cada reporte antes de tocar nada.
    const objetivos = await WellData.findAll({
      where: { id: { [db.Op.in]: reportIds } },
      include: [{ model: Well, as: "well", include: [{ model: Client, as: "client" }] }],
    });

    if (objetivos.length === 0) {
      return res.status(404).send({
        message: "No se encontraron reportes con los IDs proporcionados.",
      });
    }

    await assertOwnsReports(req.user, objetivos);

    const deletedCount = await WellData.destroy({
      where: {
        id: {
          [db.Op.in]: objetivos.map((r) => r.id),
        },
      },
    });

    if (deletedCount === 0) {
      return res.status(404).send({
        message: "No se encontraron reportes con los IDs proporcionados.",
      });
    }

    res.status(200).send({
      message: `${deletedCount} reporte(s) eliminado(s) exitosamente.`,
      deletedCount,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createWellData,
  fetchUnsentReports,
  repostToDGA,
  repostAllReportsToDGA,
  bulkCreateWellData,
  bulkDeleteWellData,
};
