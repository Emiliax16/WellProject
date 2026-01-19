const activityLogService = require('../services/activityLog.service');
const getPaginationParameters = require('../utils/query-params.util');

/**
 * Get recent activity logs with pagination
 * Only accessible by administrators
 */
const getActivityLogs = async (req, res, next) => {
  try {
    const { limit, offset } = getPaginationParameters(req.query);
    const { rows, count } = await activityLogService.getRecentActivityLogs(limit, offset);

    res.json({
      data: rows,
      total: count,
      page: req.query.page ? parseInt(req.query.page, 10) : 0,
      size: limit
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    next(error);
  }
};

module.exports = {
  getActivityLogs
};
