//well.controller.js

const db = require('../../models')

const Well = db.well;
const WellData = db.wellData;

const getAllWells = async (req, res) => {
  try {
    const wells = await Well.findAll();
    res.json(wells);
  } catch (error) {
    res.status(500).send({
      message: error.message || 'Some error occurred while retrieving Wells'
    });
  }
}

const createWell = async (req, res) => {
  try { 
    const well = await Well.create(req.body)
    res.json({created: well})
  } catch (error) {
    res.status(500).send({
      message: error.message || 'Some error occurred while creating the Well'
    });
  }
}

const getWellDataByWell = async (req, res) => {
  try {
    const well = await Well.findOne({ where: { id: req.params.id } });
    if (!well) {
      res.status(404).send({
        message: 'Well not found'
      });
    }
    //console.log(well.__proto__) -> para conocer los métodos que se pueden usar
    const wellDataInfo = await well.getWellData()
    res.json(wellDataInfo)
  } catch (error) {
    res.status(500).send({
      message: error.message || 'Some error occurred while retrieving Well Data'
    });
  
  }
}

const activeOrDesactiveWell = async (req, res) => {
  try {
    const well = await Well.findOne({ where: { id: req.params.id } });
    if (!well) {
      res.status(404).send({
        message: 'Well not found'
      });
    }


    well.isActived = !well.isActived;
    await well.save();
    res.json(well);
  } catch (error) {
    res.status(500).send({
      message: error.message || 'Some error occurred while activating the Well'
    });
  }
}

module.exports = {
    getAllWells,
    createWell,
    getWellDataByWell,
    activeOrDesactiveWell,
}