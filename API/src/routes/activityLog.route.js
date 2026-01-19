const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const { getActivityLogs } = require('../controllers/activityLog.controller');
const { Admin } = require('../utils/allowed-roles.util');

const router = express.Router();

// GET /activity-logs - Get recent activity logs (Admin only)
router.get('/activity-logs', authMiddleware(...Admin), getActivityLogs);

module.exports = router;
