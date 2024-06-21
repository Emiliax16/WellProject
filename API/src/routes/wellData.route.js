const express = require('express');

const { createWellData, fetchUnsentReports, repostToDGA} = require('../controllers/wellData.controller');
const router = express.Router();

router.post('/wellData', createWellData);
router.get('/fetchUnsentReports', fetchUnsentReports);
router.post('/repostToDGA', repostToDGA);


module.exports = router;