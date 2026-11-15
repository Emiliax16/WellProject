//well.route.js
const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const { 
  getAllWells,
  createWell,
  getWellDataByWell,
  activeOrDesactiveWell,
} = require('../controllers/well.controller');
const {
  Admin,
  AdminAndCompanyAndNormal,
} = require('../utils/allowed-roles.util');

const router = express.Router();

// Listado global de pozos, solo para admin. Era anónimo y entregaba el `code`
// de todos los pozos, que basta para inyectar telemetría en `/wellData`. Ni el
// portal ni los dispositivos la usan: en los logs de producción solo aparecen
// llamadas manuales de soporte.
router.get('/well', authMiddleware(...Admin), getAllWells);
router.get('/well/:id', authMiddleware(...AdminAndCompanyAndNormal), getWellDataByWell);
router.post('/well', authMiddleware(...AdminAndCompanyAndNormal), createWell);
router.put('/wells/:id/active', authMiddleware(...AdminAndCompanyAndNormal), activeOrDesactiveWell);

module.exports = router;