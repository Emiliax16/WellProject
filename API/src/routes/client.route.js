const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const validateParams = require('../middlewares/validate-params.middleware');
const checkTroll = require('../middlewares/check-troll.middleware');
const { editDataOfClient, createWell, addDataToWell, editDataOfWell } = require('../utils/params/client/client.params');
const { 
  getAllClients,
  getClientWells,
  editClient,
  deleteClient,
  deleteClientWell,
  editClientWell,
  getWellData,
  createClientWell,
  addDataToClientWell,
  getOneWell,
} = require('../controllers/client.controller');
const {
  AdminAndCompanyAndNormal,
  AdminAndCompany,
  Admin
} = require('../utils/allowed-roles.util');

const router = express.Router();

// ! Ojo la mayoria no deberia dejar pasar a un user regular, pero quiza eso es tarea de otro pr
// Por ahora lo dejare tal cuaal como estaba y simplemnte dejare pasar tambien a company
router.get('/clients', authMiddleware(...AdminAndCompanyAndNormal), getAllClients); 
router.get('/clients/:id/wells', authMiddleware(...AdminAndCompanyAndNormal), getClientWells);
router.get('/clients/:id/wells/:code', authMiddleware(...AdminAndCompanyAndNormal), getOneWell);
router.get('/clients/:id/wells/:code/data', authMiddleware(...AdminAndCompanyAndNormal), getWellData);
router.put('/clients/:id/edit', authMiddleware(...AdminAndCompanyAndNormal), checkTroll(), validateParams(editDataOfClient), editClient);
router.post('/clients/:id/wells/create', authMiddleware(...AdminAndCompanyAndNormal), validateParams(createWell), createClientWell);
router.post('/clients/:id/wells/:code/add', authMiddleware(...AdminAndCompanyAndNormal), validateParams(addDataToWell), addDataToClientWell);
router.delete('/clients/:id/delete', authMiddleware(...AdminAndCompanyAndNormal), deleteClient);
router.delete('/clients/:id/wells/:code/delete', authMiddleware(...AdminAndCompanyAndNormal), deleteClientWell);
router.put('/clients/:id/wells/:code/edit', authMiddleware(...AdminAndCompanyAndNormal), validateParams(editDataOfWell), editClientWell);

module.exports = router;