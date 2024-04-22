const db = require('../../models')

const Well = db.well;
const WellData = db.wellData;

const createWellData = async (req, res) => {
  try {
    console.log(req.body);
    const well = await Well.findByPk(req.body.code); // Buscamos el pozo por su código
    if (!well) {
      return res.status(404).send({
        message: 'Code no pertenece a ningún pozo registrado'
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