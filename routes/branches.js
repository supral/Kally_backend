const express = require('express');
const Branch = require('../models/Branch');
const User = require('../models/User');
const Settings = require('../models/Settings');
const { protect, authorize } = require('../middleware/auth');
const { getBranchId } = require('../middleware/branchFilter');
const { createActivityLog } = require('../utils/activityLog');
const { validateBulkIds } = require('../utils/validateBulkIds');

const router = express.Router();

router.use(protect);

/**
 * POST /api/branches/bulk-delete
 * Admin-only: deactivate branches in bulk (sets isActive=false).
 * Guarded by a Settings toggle.
 */
router.post('/bulk-delete', authorize('admin'), async (req, res) => {
  try {
    const settingsDoc = await Settings.findOne().lean();
    if (settingsDoc?.showBulkDeleteBranchesToAdmin !== true) {
      return res.status(403).json({ success: false, message: 'Bulk delete is disabled in Settings.' });
    }
    const { ids, confirm } = req.body || {};
    if (confirm !== 'DELETE_SELECTED_BRANCHES') {
      return res.status(400).json({ success: false, message: 'Confirmation required.' });
    }
    const { valid, ids: objectIds, message } = validateBulkIds(ids);
    if (!valid) return res.status(400).json({ success: false, message: message || 'Invalid ids.' });
    const r = await Branch.updateMany({ _id: { $in: objectIds } }, { $set: { isActive: false } });
    const count = r.modifiedCount ?? 0;
    if (count > 0) {
      createActivityLog({
        userId: req.user._id,
        description: `Bulk deactivated ${count} branch(es)`,
        entity: 'branch',
        details: { count },
      }).catch(() => {});
    }
    return res.json({ success: true, deactivated: count });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to bulk delete branches.' });
  }
});

router.get('/', async (req, res) => {
  try {
    const bid = getBranchId(req.user);
    const allForSelection = req.query.all === '1' || req.query.all === 'true';
    if (req.user.role === 'vendor' && !allForSelection && bid) {
      const branch = await Branch.findById(bid).lean();
      if (!branch) return res.json({ success: true, branches: [] });
      return res.json({
        success: true,
        branches: [{ id: branch._id, name: branch.name, code: branch.code, address: branch.address, zipCode: branch.zipCode }],
      });
    }
    const branches = await Branch.find({ isActive: true }).sort({ name: 1 }).lean();
    res.json({
      success: true,
      branches: branches.map((b) => ({ id: b._id, name: b.name, code: b.code, address: b.address, zipCode: b.zipCode })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch branches.' });
  }
});

router.post('/', authorize('admin'), async (req, res) => {
  try {
    const { name, code, address, zipCode } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Branch name is required.' });
    const branch = await Branch.create({ name, code: code || undefined, address: address || undefined, zipCode: zipCode || undefined });
    createActivityLog({
      userId: req.user._id,
      branchId: branch._id,
      description: `Created branch ${branch.name}`,
      entity: 'branch',
      entityId: branch._id,
      details: { branchName: branch.name, code: branch.code },
    }).catch(() => {});
    res.status(201).json({
      success: true,
      branch: { id: branch._id, name: branch.name, code: branch.code, address: branch.address, zipCode: branch.zipCode },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create branch.' });
  }
});

router.patch('/:id', authorize('admin'), async (req, res) => {
  try {
    const allowed = ['name', 'code', 'address', 'zipCode'];
    const updates = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const branch = await Branch.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).lean();
    if (!branch) return res.status(404).json({ success: false, message: 'Branch not found.' });
    createActivityLog({
      userId: req.user._id,
      branchId: branch._id,
      description: `Updated branch ${branch.name}`,
      entity: 'branch',
      entityId: branch._id,
      details: { branchName: branch.name, code: branch.code },
    }).catch(() => {});
    res.json({ success: true, branch: { id: branch._id, name: branch.name, code: branch.code, address: branch.address, zipCode: branch.zipCode } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update branch.' });
  }
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id).lean();
    if (!branch) return res.status(404).json({ success: false, message: 'Branch not found.' });
    await Branch.findByIdAndUpdate(req.params.id, { isActive: false });
    createActivityLog({
      userId: req.user._id,
      branchId: branch._id,
      description: `Deactivated branch ${branch.name}`,
      entity: 'branch',
      entityId: branch._id,
      details: { branchName: branch.name },
    }).catch(() => {});
    res.json({ success: true, message: 'Branch deactivated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to delete branch.' });
  }
});

module.exports = router;
