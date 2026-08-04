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
  AdminAndCompanyAndNormal,
} = require('../utils/allowed-roles.util');

const router = express.Router();

// Sin JWT a propósito: no está confirmado que los dispositivos IoT no lo usen
// para sincronizar el catálogo de pozos (ver README). El controlador excluye
// las credenciales DGA, que era la fuga real.
router.get('/well', getAllWells);
router.get('/well/:id', authMiddleware(...AdminAndCompanyAndNormal), getWellDataByWell);
router.post('/well', authMiddleware(...AdminAndCompanyAndNormal), createWell);
router.put('/wells/:id/active', authMiddleware(...AdminAndCompanyAndNormal), activeOrDesactiveWell);

module.exports = router;