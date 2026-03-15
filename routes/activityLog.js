const express = require('express');
const ActivityLog = require('../models/ActivityLog');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

/**
 * GET /api/activity-log?page=1&limit=10
 * Admin: all system activity. Vendor/Staff: only vendor-related and vendor-updated (own actions + activity in their branch).
 */
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
    const skip = (page - 1) * limit;

    const filter = req.user.role === 'admin'
      ? {}
      : (() => {
          const vendorBranchId = req.user.branchId?._id || req.user.branchId;
          if (!vendorBranchId) return { userId: req.user._id };
          return { $or: [{ userId: req.user._id }, { branchId: vendorBranchId }] };
        })();
    const [activities, total] = await Promise.all([
      ActivityLog.find(filter)
        .populate('userId', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ActivityLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      activities: activities.map((a) => ({
        id: a._id,
        description: a.description,
        entity: a.entity,
        entityId: a.entityId,
        details: a.details || undefined,
        createdAt: a.createdAt,
        user: a.userId
          ? { id: a.userId._id, name: a.userId.name, email: a.userId.email, role: a.userId.role }
          : null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch activity log.' });
  }
});

module.exports = router;
