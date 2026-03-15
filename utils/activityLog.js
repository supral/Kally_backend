const ActivityLog = require('../models/ActivityLog');

/**
 * Create an activity log entry. Fire-and-forget safe (does not throw).
 * @param {{ userId: import('mongoose').Types.ObjectId, branchId?: import('mongoose').Types.ObjectId, description: string, entity?: string, entityId?: import('mongoose').Types.ObjectId, details?: Record<string, unknown> }} opts
 */
async function createActivityLog(opts) {
  const { userId, branchId, description, entity, entityId, details } = opts;
  if (!userId || !description) return;
  try {
    await ActivityLog.create({
      userId,
      branchId: branchId || undefined,
      description,
      entity: entity || undefined,
      entityId: entityId || undefined,
      details: details && Object.keys(details).length > 0 ? details : undefined,
    });
  } catch (err) {
    console.error('ActivityLog create error:', err.message);
  }
}

module.exports = { createActivityLog };
