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

router.get('/well', authMiddleware(...Admin), getAllWells);
router.get('/well/:id', authMiddleware(...AdminAndCompanyAndNormal), getWellDataByWell);
router.post('/well', authMiddleware(...AdminAndCompanyAndNormal), createWell);
router.put('/wells/:id/active', authMiddleware(...AdminAndCompanyAndNormal), activeOrDesactiveWell);

module.exports = router;