const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const { getWellsStatus, sendAlertEmail } = require('../controllers/monitoring.controller');
const { Admin } = require('../utils/allowed-roles.util');

const router = express.Router();

router.get('/monitoring/wells-status', authMiddleware(...Admin), getWellsStatus);
router.post('/monitoring/send-alert-email', authMiddleware(...Admin), sendAlertEmail);

module.exports = router;
