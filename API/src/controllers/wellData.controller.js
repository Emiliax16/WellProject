const db = require('../../models')

const Well = db.well;
const WellData = db.wellData;

const createWellData = async (req, res) => {
  try {
    console.log(req.body);
    const well = await Well.findOne({ where: { code: req.body.code } }); // Buscamos el pozo por su código
    if (!well) {
      return res.status(404).send({
        message: 'Code no pertenece a ningún pozo registrado'
      });
    }

    // Por hora, llegarán 4 reportes pero tendrán la misma hora y fecha, la idea es que si el primero
    // no se envía por errores de interferencia/conexión, se pueda capturar alguno de los otros tres reportes.
    // El primero que llega con esa fecha y hora, se guarda y los otros tres se descartan.
    const existingWellData = await WellData.findOne({ 
      where: { 
        date: req.body.date,
        hour: req.body.hour
      }
    });
    if (existingWellData) {
      return res.status(400).send({
        message: 'Ya existe un reporte para esa fecha y hora'
      });
    }

    const wellData = await WellData.create(req.body);
    res.json(wellData);
  } catch (error) {
    res.status(500).send({
      message: error.message || 'Some error occurred while creating the WellData'
    });
  }
}

module.exports = {
  createWellData
}