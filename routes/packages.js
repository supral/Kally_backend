const express = require('express');
const mongoose = require('mongoose');
const Package = require('../models/Package');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

/** GET /api/packages or /api/packages/ - list packages. Default: active only (dropdown). ?all=true for admin: all */
const listPackages = async (req, res) => {
  try {
    const all = req.query.all === 'true' && req.user?.role === 'admin';
    const filter = all ? {} : { isActive: true };
    const list = await Package.find(filter).sort({ name: 1 }).lean();
    res.json({
      success: true,
      packages: list.map((p) => {
        const discount = p.discountAmount ?? 0;
        const sessions = p.totalSessions ?? 1;
        let settlement = p.settlementAmount;
        if (settlement == null && sessions > 0) {
          settlement = computeSettlementAmount(p.price, discount, sessions);
        }
        return {
          id: p._id,
          name: p.name,
          price: p.price,
          discountAmount: discount,
          totalSessions: sessions,
          settlementAmount: settlement,
          isActive: p.isActive,
        };
      }),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch packages.' });
  }
};
router.get('/', listPackages);
router.get('', listPackages);

function computeSettlementAmount(price, discountAmount, totalSessions) {
  if (!totalSessions || totalSessions <= 0) return undefined;
  const p = Number(price) || 0;
  const d = Number(discountAmount) || 0;
  return (p + d) / (2 * totalSessions);
}

/** POST /api/packages - create (admin and vendor) */
router.post('/', authorize('admin', 'vendor'), async (req, res) => {
  try {
    const { name, price, discountAmount, totalSessions } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Name is required.' });
    }
    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      return res.status(400).json({ success: false, message: 'Price must be a non-negative number.' });
    }
    const numDiscount = discountAmount != null && discountAmount !== '' ? Number(discountAmount) : 0;
    if (isNaN(numDiscount) || numDiscount < 0) {
      return res.status(400).json({ success: false, message: 'Discount amount must be 0 or greater.' });
    }
    const numSessions = totalSessions != null && totalSessions !== '' ? Number(totalSessions) : undefined;
    if (numSessions == null || !Number.isInteger(numSessions) || numSessions < 1) {
      return res.status(400).json({ success: false, message: 'No. of sessions is required and must be at least 1.' });
    }
    const settlementAmount = computeSettlementAmount(numPrice, numDiscount, numSessions);
    const pkg = await Package.create({
      name: String(name).trim(),
      price: numPrice,
      discountAmount: numDiscount,
      totalSessions: numSessions,
      settlementAmount: settlementAmount != null && !isNaN(settlementAmount) && settlementAmount >= 0 ? settlementAmount : undefined,
    });
    res.status(201).json({
      success: true,
      package: { id: pkg._id, name: pkg.name, price: pkg.price, discountAmount: pkg.discountAmount, totalSessions: pkg.totalSessions, settlementAmount: pkg.settlementAmount },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create package.' });
  }
});

/** PATCH /api/packages/:id - update (admin only) */
router.patch('/:id', authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID.' });
    }
    const pkg = await Package.findById(id);
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found.' });
    const { name, price, discountAmount, totalSessions, isActive } = req.body;
    if (name !== undefined) pkg.name = String(name).trim();
    if (price !== undefined) {
      const num = Number(price);
      if (!isNaN(num) && num >= 0) pkg.price = num;
    }
    if (discountAmount !== undefined) {
      const num = Number(discountAmount);
      if (!isNaN(num) && num >= 0) pkg.discountAmount = num;
    }
    if (totalSessions !== undefined) {
      const num = Number(totalSessions);
      if (Number.isInteger(num) && num >= 1) pkg.totalSessions = num;
    }
    if (isActive !== undefined) pkg.isActive = !!isActive;
    pkg.settlementAmount = computeSettlementAmount(pkg.price, pkg.discountAmount, pkg.totalSessions);
    await pkg.save();
    res.json({
      success: true,
      package: { id: pkg._id, name: pkg.name, price: pkg.price, discountAmount: pkg.discountAmount, totalSessions: pkg.totalSessions, settlementAmount: pkg.settlementAmount, isActive: pkg.isActive },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update package.' });
  }
});

/** DELETE /api/packages/:id - soft delete (admin only) */
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID.' });
    }
    const pkg = await Package.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found.' });
    res.json({ success: true, message: 'Package removed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to delete package.' });
  }
});

module.exports = router;
