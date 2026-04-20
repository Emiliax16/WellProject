const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const { getWellsStatus, sendAlertEmail } = require('../controllers/monitoring.controller');
const { Admin } = require('../utils/allowed-roles.util');

const router = express.Router();

router.get('/monitoring/wells-status', authMiddleware(...Admin), getWellsStatus);

// Endpoints usados por el servicio SENDER (cron interno, sin auth)
router.get('/monitoring/wells-status/internal', getWellsStatus);
router.post('/monitoring/send-alert-email', sendAlertEmail);

module.exports = router;
