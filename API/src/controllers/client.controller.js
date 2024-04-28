const db = require('../../models');
const ErrorHandler = require('../utils/error.util');
const { unauthorized, userHasNoClientAssociated, wellNotFound, userNotFound } = require('../utils/errorcodes.util');
const Client = db.client;
const Well = db.well;
const WellData = db.wellData;

const getClientWells = async (req, res, next) => {
  try {
    const { id: userId } = req.params;
    const { id: requesterId, type: requesterRole } = req.user;
    // si los id no son iguales, solo se puede proceder si el rol del usuario es admin
    if (userId !== requesterId && requesterRole !== 'admin') {
      throw new ErrorHandler(unauthorized);
    }
    console.log('checking wells for', userId)
    const client = await Client.findOne({
      where: { userId },  // La condición where debe estar dentro del mismo objeto que include
      include: [
        {
          model: Well,
          as: 'wells',
          include: [
            {
              model: WellData,
              as: 'wellData',
            },
          ],
        },
      ],
    });
    
    if (!client) {
      throw new ErrorHandler(userNotFound);
    }

    res.json(client);

  } catch (error) {
    next(error);
  }
}

const createClientWell = async (req, res, next) => {
  try {
    const { id: userId } = req.params;
    const { id: requesterId, type: requesterRole } = req.user;
    // si los id no son iguales, solo se puede proceder si el rol del usuario es admin
    if (userId !== requesterId && requesterRole !== 'admin') {
      throw new ErrorHandler(unauthorized);
    }
    const client = await Client.findOne({ where: { userId } });
    if (!client) {
      throw new ErrorHandler(userHasNoClientAssociated);
    }
    const well = await Well.create({ ...req.body, clientId: client.id });
    res.json(well);
  } catch (error) {
    next(error);
  }
}

const addDataToClientWell = async (req, res, next) => {
  try {
    const { id: userId, code: wellCode } = req.params;
    const { id: requesterId, type: requesterRole } = req.user;
    // si los id no son iguales, solo se puede proceder si el rol del usuario es admin
    if (userId !== requesterId && requesterRole !== 'admin') {
      throw new ErrorHandler(unauthorized);
    }
    const client = await Client.findOne({ where: { userId } });
    if (!client) {
      throw new ErrorHandler(userHasNoClientAssociated);
    }
    const well = await Well.findOne({ where: { code: wellCode, clientId: client.id } });
    if (!well) {
      throw new ErrorHandler(wellNotFound);
    }
    const wellData = await WellData.create({ ...req.body, code: well.code });
    res.json(wellData);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getClientWells,
  createClientWell,
  addDataToClientWell,
}