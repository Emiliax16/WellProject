const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const validateParams = require('../middlewares/validate-params.middleware');
const { createWell, addDataToWell } = require('../utils/params/client/client.params');
const { 
  getAllClients,
  getClientWells,
  getWellData,
  createClientWell,
  addDataToClientWell,
} = require('../controllers/client.controller');

const router = express.Router();

router.get('/clients', authMiddleware('normal', 'admin'), getAllClients);
router.get('/clients/:id/wells', authMiddleware('normal', 'admin'), getClientWells);
router.get('/clients/:id/wells/:code/data', authMiddleware('normal', 'admin'), getWellData);
router.post('/clients/:id/wells/create', authMiddleware('normal', 'admin'), validateParams(createWell), createClientWell);
router.post('/clients/:id/wells/:code/add', authMiddleware('normal', 'admin'), validateParams(addDataToWell), addDataToClientWell);

module.exports = router;