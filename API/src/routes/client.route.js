const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const validateParams = require('../middlewares/validate-params.middleware');
const checkTroll = require('../middlewares/check-troll.middleware');
const { editDataOfClient, createWell, addDataToWell } = require('../utils/params/client/client.params');
const { 
  getAllClients,
  getClientWells,
  editClient,
  deleteClient,
  getWellData,
  createClientWell,
  addDataToClientWell,
} = require('../controllers/client.controller');

const router = express.Router();

router.get('/clients', authMiddleware('normal', 'admin'), getAllClients);
router.get('/clients/:id/wells', authMiddleware('normal', 'admin'), getClientWells);
router.get('/clients/:id/wells/:code/data', authMiddleware('normal', 'admin'), getWellData);
router.put('/clients/:id/edit', authMiddleware('normal', 'admin'), checkTroll(), validateParams(editDataOfClient), editClient);
router.post('/clients/:id/wells/create', authMiddleware('normal', 'admin'), validateParams(createWell), createClientWell);
router.post('/clients/:id/wells/:code/add', authMiddleware('normal', 'admin'), validateParams(addDataToWell), addDataToClientWell);
router.delete('/clients/:id/delete', authMiddleware('normal', 'admin'), deleteClient);

module.exports = router;