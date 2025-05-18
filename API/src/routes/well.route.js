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

router.get('/well', getAllWells);
router.get('/well/:id', getWellDataByWell);
router.post('/well', authMiddleware(...AdminAndCompanyAndNormal), createWell);
router.put('/wells/:id/active', authMiddleware(...AdminAndCompanyAndNormal), activeOrDesactiveWell);

module.exports = router;