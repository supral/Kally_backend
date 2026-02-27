const express = require('express');
const Service = require('../models/Service');
const { protect, authorize } = require('../middleware/auth');
const { getBranchId } = require('../middleware/branchFilter');

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

router.post('/', authorize('admin'), async (req, res) => {
  try {
    const { name, category, branchId, durationMinutes, price } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Service name is required.' });
    const service = await Service.create({
      name,
      category: category || undefined,
      branchId: branchId || undefined,
      durationMinutes: durationMinutes != null ? Number(durationMinutes) : undefined,
      price: price != null ? Number(price) : 0,
    });
    res.status(201).json({
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
    res.status(500).json({ success: false, message: err.message || 'Failed to create service.' });
  }
});

router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, branchId, durationMinutes, price } = req.body;
    const service = await Service.findByIdAndUpdate(
      id,
      {
        ...(name != null && { name }),
        ...(category !== undefined && { category: category || undefined }),
        ...(branchId !== undefined && { branchId: branchId || undefined }),
        ...(durationMinutes !== undefined && { durationMinutes: durationMinutes != null ? Number(durationMinutes) : undefined }),
        ...(price !== undefined && { price: price != null ? Number(price) : 0 }),
      },
      { new: true }
    );
    if (!service) return res.status(404).json({ success: false, message: 'Service not found.' });
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

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const service = await Service.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!service) return res.status(404).json({ success: false, message: 'Service not found.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to delete service.' });
  }
});

module.exports = router;
