const db = require("../../models");

const Well = db.well;
const WellData = db.wellData;

const processAndPostData = require("../services/wellData/handleSendData.service");
const ErrorHandler = require("../utils/error.util");
const moment = require("moment-timezone");
const { bulkCreateWellDataIsNotArray } = require("../utils/errorcodes.util");

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

const createWellData = async (req, res) => {
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
    res.status(500).send({
      message:
        error.message || "Some error occurred while creating the WellData",
    });
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
                                    include: [
                                      {
                                        model: Well,
                                        as: 'well',
                                      },
                                    ],
                                  });

    console.log("Pending reports BACKKKK IDDD:", reportIds);

    if (reports.length === 0) {
      return res.status(404).send({
        message: "No se encontraron reportes para enviar.",
      });
    }

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

const fetchUnsentReports = async (req, res, next) => {
  try {
    // Se obtienen todos los reportes no mandados de pozos activos
    console.log("Buscando reportes no enviados");

    // Obtener fecha actual en zona horaria correcta (Chile) y restar 2 horas
    const twoHoursAgo = moment().tz("America/Santiago").subtract(2, "hours").toDate();

    const unsentReports = await WellData.findAll({
      where: {
        sent: false,
        createdAt: {
          // solo incluir reportes creados después de la última edición del pozo
          [db.Op.gte]: db.Sequelize.col("well.editStatusDate"),
          [db.Op.lte]: twoHoursAgo, // createdAt debe ser <= ahora - 2h
        },
      },
      include: [
        {
          model: Well,
          as: "well",
          where: {
            isActived: true,
            editStatusDate: {
              [db.Op.ne]: null,
            },
          },
        },
      ],
    });

    // Si no hay reportes no enviados, se envía un 404
    if (unsentReports.length === 0) {
      console.log("NO HAY REPORTES NO ENVIADOS!!!!!!!!!!!!!!!!");
      return res.status(404).send({
        message: "No hay reportes no enviados",
      });
    }

    console.log("Reportes encontrados: ", unsentReports.length);
    let formattedReports = { reports: {} };
    unsentReports.forEach((report) => {
      formattedReports["reports"][report.id] = report;
    });
    res.json(formattedReports).status(200);
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
};
