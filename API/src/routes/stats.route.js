const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const { getGlobalStats } = require('../controllers/stats.controller');
const { Admin, AdminAndCompany, AdminAndDistributor } = require('../utils/allowed-roles.util');

const router = express.Router();

// Get global statistics (admin only)
router.get('/stats/global', authMiddleware(...Admin), getGlobalStats);

module.exports = router;
