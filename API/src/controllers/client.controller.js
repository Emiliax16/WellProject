const db = require('../../models');
const ErrorHandler = require('../utils/error.util');
const { 
  unauthorized, 
  userHasNoClientAssociated, 
  clientNotFound,
  wellNotFound,
  clientHasNoUserOrPersonAssociated,
} = require('../utils/errorcodes.util');
const getPaginationParameters = require('../utils/query-params.util');

const Client = db.client;
const Well = db.well;
const WellData = db.wellData;
const User = db.user;
const Person = db.person;


//               GET ALL CLIENTS
const getAllClients = async (req, res, next) => {
  try {
    const clients = await Client.findAll({
      include: [
        {
          model: User,
          as: 'user',
          attributes: {
            exclude: ['encrypted_password']
          },
        }
      ]
    });
    res.json(clients);
  } catch (error) {
    next(error);
  }
}
 
//               EDIT A CLIENT 
const editClient = async (req, res, next) => {
  try {
    const { id: clientId } = req.params; 
    const { id: requesterId, type: requesterRole } = req.user;

    const client = await Client.findByPk(clientId);
    if (!client) {
      throw new ErrorHandler(clientNotFound);
    }
    const user = await client.getUser();
    const person = await user.getPerson();
    
    if (!user || !person) {
      throw new ErrorHandler(clientHasNoUserOrPersonAssociated);
    }

    if (requesterRole === 'admin'){
      //TODO check some kind of password or passphrase confirmation 
      await client.updateDetails(user, person, req.body);
      return res.json({ message: `Cliente ${client.id} editado exitosamente.` });
    }
    
    if (requesterRole === 'normal' & client.userId !== requesterId) {
      throw new ErrorHandler(unauthorized);
    }

    const { newPassword, oldPassword } = req.body;
    await user.handlePasswordChange(oldPassword, newPassword)

    return res.json({ message: `Contraseña del cliente ${client.id} fue editada exitosamente.` });
  } catch (error) {
    next(error);
  }
}


//               DELETE A CLIENT
const deleteClient = async (req, res, next) => {
  try {
    const { id: clientId } = req.params;
    const { id: requesterId, type: requesterRole } = req.user;
    // si los id no son iguales, solo se puede proceder si el rol del usuario es admin
    const client = await Client.findByPk(clientId);
    if (!client) {
      throw new ErrorHandler(userHasNoClientAssociated);
    }
    const user = await client.getUser();
    if (requesterRole === 'admin'){
      //TODO check some kind of password or passphrase confirmation 
      await user.destroy();
      return res.json({message: `Cliente ${client.id} eliminado exitosamente.`});
    }
    if (requesterRole === 'normal' & client.userId !== requesterId) {
      throw new ErrorHandler(unauthorized);
    }
  } catch (error) {
    next(error);
  }
}

//               GET WELLS OF A CLIENT
const getClientWells = async (req, res, next) => {
  try {
    const { id: clientId } = req.params;
    const { id: requesterId, type: requesterRole } = req.user;
    // si los id no son iguales, solo se puede proceder si el rol del usuario es admin
    if (clientId !== requesterId && requesterRole !== 'admin') {
      throw new ErrorHandler(unauthorized);
    }

    const client = await Client.findByPk(clientId);
    
    if (!client) {
      throw new ErrorHandler(clientNotFound);
    }

    const { limit, offset } = getPaginationParameters(req.query);
    console.log(limit, offset)
    const wells = await Well.findAndCountAll({
      where: { clientId: client.id },
      limit,
      offset,
    });

    res.json(wells);

  } catch (error) {
    next(error);
  }
}

//               GET DATA OF A WELL

const getWellData = async (req, res, next) => {
  try {
    const { id: clientId, code: wellCode } = req.params;
    const { id: requesterId, type: requesterRole } = req.user;
    // si los id no son iguales, solo se puede proceder si el rol del usuario es admin
    if (clientId !== requesterId && requesterRole !== 'admin') {
      throw new ErrorHandler(unauthorized);
    }
    const client = await Client.findByPk(clientId);
    if (!client) {
      throw new ErrorHandler(clientNotFound);
    }
    const well = await Well.findOne({ where: { code: wellCode, clientId: client.id } });
    if (!well) {
      throw new ErrorHandler(wellNotFound);
    }
    const { limit, offset } = getPaginationParameters(req.query);
    const wellData = await WellData.findAndCountAll({
      where: { code: well.code },
      limit,
      offset,
    });
    res.json(wellData);
  
  } catch (error) {
    next(error);
  }
}

//               CREATE A WELL FOR A CLIENT

const createClientWell = async (req, res, next) => {
  try {
    const { id: clientId } = req.params;
    const { id: requesterId, type: requesterRole } = req.user;
    // si los id no son iguales, solo se puede proceder si el rol del usuario es admin
    if (clientId !== requesterId && requesterRole !== 'admin') {
      throw new ErrorHandler(unauthorized);
    }
    const client = await Client.findByPk(clientId);
    if (!client) {
      throw new ErrorHandler(clientNotFound);
    }
    const well = await Well.create({ ...req.body, clientId: client.id });
    res.json(well);
  } catch (error) {
    next(error);
  }
}

//               ADD DATA TO A WELL OF A CLIENT

const addDataToClientWell = async (req, res, next) => {
  try {
    const { id: clientId, code: wellCode } = req.params;
    const { id: requesterId, type: requesterRole } = req.user;
    // si los id no son iguales, solo se puede proceder si el rol del usuario es admin
    if (clientId !== requesterId && requesterRole !== 'admin') {
      throw new ErrorHandler(unauthorized);
    }
    const client = await Client.findByPk(clientId);
    if (!client) {
      throw new ErrorHandler(clientNotFound);
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
  getAllClients,
  editClient,
  deleteClient,
  getClientWells,
  getWellData,
  createClientWell,
  addDataToClientWell,
}