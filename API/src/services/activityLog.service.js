const db = require('../../models');
const ActivityLog = db.activitylog;
const User = db.user;
const Person = db.person;

/**
 * Create a new activity log entry
 * @param {Object} params - Activity log parameters
 * @param {string} params.action - Action performed (e.g., 'created')
 * @param {string} params.entityType - Type of entity ('client', 'company', 'distributor', 'well')
 * @param {number} params.entityId - ID of the entity
 * @param {string} params.entityName - Name/code of the entity
 * @param {Object} params.context - Hierarchical context (client, company, distributor)
 * @param {number} params.userId - ID of the user who performed the action
 * @returns {Promise<Object>} Created activity log
 */
const createActivityLog = async ({ action, entityType, entityId, entityName, context, userId }) => {
  try {
    const activityLog = await ActivityLog.create({
      action,
      entityType,
      entityId,
      entityName,
      context: context || null,
      userId
    });

    return activityLog;
  } catch (error) {
    console.error('Error creating activity log:', error);
    // Don't throw - we don't want logging errors to break the main operation
    return null;
  }
};

/**
 * Get recent activity logs with user information
 * @param {number} limit - Maximum number of logs to retrieve (default: 10)
 * @param {number} offset - Number of logs to skip (default: 0)
 * @returns {Promise<Object>} Object with rows (activity logs) and count (total)
 */
const getRecentActivityLogs = async (limit = 10, offset = 0) => {
  try {
    const { rows: logs, count } = await ActivityLog.findAndCountAll({
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email'],
          include: [
            {
              model: Person,
              as: 'person',
              attributes: ['fullName']
            }
          ]
        }
      ]
    });

    // Format the response
    const formattedLogs = logs.map(log => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      entityName: log.entityName,
      context: log.context,
      user: {
        id: log.user.id,
        name: log.user.person?.fullName || log.user.email,
        email: log.user.email
      },
      createdAt: log.createdAt
    }));

    return {
      rows: formattedLogs,
      count
    };
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    throw error;
  }
};

module.exports = {
  createActivityLog,
  getRecentActivityLogs
};
