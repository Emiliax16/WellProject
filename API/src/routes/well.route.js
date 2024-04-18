//well.route.js
const express = require('express');
const { 
  getAllWells,
  createWell,
  createWellEntry,
  getWellDataByWell
} = require('../controllers/well.controller');

const router = express.Router();

router.get('/well', getAllWells);
router.get('/well/:id', getWellDataByWell);
router.post('/well', createWell);
router.post('/well/:id', createWellEntry);

module.exports = router;