const db = require("../../models");

const Well = db.well;
const WellData = db.wellData;

const processAndPostData = require("../services/wellData/handleSendData.service");
const ErrorHandler = require("../utils/error.util");
const moment = require("moment-timezone");
const { bulkCreateWellDataIsNotArray } = require("../utils/errorcodes.util");

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

    const wellData = await WellData.create(req.body);
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
    for (const wellData of rawData) {
      console.log(`This is the wellData: ${JSON.stringify(wellData)}`);

      const { code, date, hour } = wellData;
      const well = await Well.findOne({ where: { code } });
      if (!well) {
        errors.push({
          message: "Code no pertenece a ningún pozo registrado",
          report: wellData,
        });
        continue;
      }
      const existingWellData = await WellData.findOne({
        where: {
          date,
          hour,
          code,
        },
      });
      if (existingWellData) {
        errors.push({
          message: "Ya existe un reporte para esa fecha y hora",
          report: wellData,
        });
        continue;
      }

      validReports.push(wellData);
      await WellData.create(wellData);
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

      const promise = processAndPostData(report)
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
    await processAndPostData(wellData);
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
