const express = require('express');

const { createWellData } = require('../controllers/wellData.controller');
const router = express.Router();

router.post('/wellData', createWellData);

module.exports = router;