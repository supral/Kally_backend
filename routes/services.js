const express = require('express');
const Service = require('../models/Service');
const { protect, authorize } = require('../middleware/auth');
const { getBranchId } = require('../middleware/branchFilter');
const { createActivityLog } = require('../utils/activityLog');

const router = express.Router();

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const { branchId } = req.query;
    const bid = getBranchId(req.user);
    const filter = { isActive: true };
    if (bid) filter.$or = [{ branchId: bid }, { branchId: null }];
    else if (branchId) filter.$or = [{ branchId: branchId }, { branchId: null }];

    const services = await Service.find(filter).populate('branchId', 'name').sort({ name: 1 }).lean();
    res.json({
      success: true,
      services: services.map((s) => ({
        id: s._id,
        name: s.name,
        category: s.category,
        branch: s.branchId?.name,
        branchId: s.branchId?._id || s.branchId || undefined,
        durationMinutes: s.durationMinutes,
        price: s.price,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch services.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, category, branchId: bodyBranchId, durationMinutes, price } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Service name is required.' });
    const isAdmin = req.user.role === 'admin';
    const branchIdToUse = isAdmin ? (bodyBranchId || undefined) : getBranchId(req.user);
    if (!isAdmin && !branchIdToUse) {
      return res.status(400).json({ success: false, message: 'You must be assigned to a branch to add services.' });
    }
    const service = await Service.create({
      name,
      category: category || undefined,
      branchId: branchIdToUse || undefined,
      durationMinutes: durationMinutes != null ? Number(durationMinutes) : undefined,
      price: price != null ? Number(price) : 0,
    });
    const populated = await Service.findById(service._id).populate('branchId', 'name').lean();
    createActivityLog({
      userId: req.user._id,
      branchId: service.branchId || undefined,
      description: `Created service: ${service.name}`,
      entity: 'service',
      entityId: service._id,
      details: { branch: populated?.branchId?.name, durationMinutes: service.durationMinutes, price: service.price },
    }).catch(() => {});
    res.status(201).json({
      success: true,
      service: {
        id: service._id,
        name: service.name,
        category: service.category,
        branchId: service.branchId,
        branch: populated?.branchId?.name,
        durationMinutes: service.durationMinutes,
        price: service.price,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create service.' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, branchId: bodyBranchId, durationMinutes, price } = req.body;
    const existing = await Service.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Service not found.' });
    const isAdmin = req.user.role === 'admin';
    const userBranchId = getBranchId(req.user);
    if (!isAdmin) {
      if (!userBranchId || String(existing.branchId) !== String(userBranchId)) {
        return res.status(403).json({ success: false, message: 'You can only edit services for your branch.' });
      }
    }
    const update = {
      ...(name != null && { name }),
      ...(category !== undefined && { category: category || undefined }),
      ...(durationMinutes !== undefined && { durationMinutes: durationMinutes != null ? Number(durationMinutes) : undefined }),
      ...(price !== undefined && { price: price != null ? Number(price) : 0 }),
    };
    if (isAdmin && bodyBranchId !== undefined) update.branchId = bodyBranchId || undefined;
    const service = await Service.findByIdAndUpdate(id, update, { new: true });
    const populated = await Service.findById(service._id).populate('branchId', 'name').lean();
    createActivityLog({
      userId: req.user._id,
      branchId: service.branchId || undefined,
      description: `Updated service: ${service.name}`,
      entity: 'service',
      entityId: service._id,
      details: { branch: populated?.branchId?.name },
    }).catch(() => {});
    res.json({
      success: true,
      service: {
        id: service._id,
        name: service.name,
        category: service.category,
        branchId: service.branchId,
        durationMinutes: service.durationMinutes,
        price: service.price,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update service.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await Service.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Service not found.' });
    const isAdmin = req.user.role === 'admin';
    const userBranchId = getBranchId(req.user);
    if (!isAdmin && (!userBranchId || String(existing.branchId) !== String(userBranchId))) {
      return res.status(403).json({ success: false, message: 'You can only remove services for your branch.' });
    }
    await Service.findByIdAndUpdate(id, { isActive: false });
    createActivityLog({
      userId: req.user._id,
      branchId: existing.branchId || undefined,
      description: `Deleted service: ${existing.name}`,
      entity: 'service',
      entityId: existing._id,
      details: {},
    }).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to delete service.' });
  }
});

module.exports = router;
