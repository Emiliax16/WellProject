const express = require('express');

const wellDataController = require('../controllers/wellData.controller');
const router = express.Router();

router.post('/wellData', wellDataController);

module.exports = router;
