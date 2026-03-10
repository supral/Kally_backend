const express = require('express');
const ManualSale = require('../models/ManualSale');
const { protect, authorize } = require('../middleware/auth');
const { getBranchId } = require('../middleware/branchFilter');

const router = express.Router();

router.use(protect);

/** GET /api/manual-sales?from=&to=&branchId= - Admin: all or filter. Vendor: own branch only. */
router.get('/', async (req, res) => {
  try {
    const { from, to, branchId } = req.query;
    const bid = getBranchId(req.user);
    const filter = {};
    if (req.user.role === 'admin' && branchId) filter.branchId = branchId;
    else if (req.user.role === 'vendor' && bid) filter.branchId = bid;
    else if (req.user.role === 'vendor') filter.branchId = { $in: [] };
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        filter.date.$lte = toDate;
      }
    }
    const sales = await ManualSale.find(filter)
      .populate('branchId', 'name')
      .sort({ date: -1 })
      .lean();
    res.json({
      success: true,
      sales: sales.map((s) => ({
        id: String(s._id),
        branchId: String(s.branchId?._id ?? s.branchId),
        branchName: s.branchId?.name ?? '—',
        date: s.date,
        amount: s.amount,
        hasImage: Boolean(s.imageBase64),
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch manual sales.' });
  }
});

/** GET /api/manual-sales/:id - get single entry with image for view/download */
router.get('/:id', async (req, res) => {
  try {
    const sale = await ManualSale.findById(req.params.id)
      .populate('branchId', 'name')
      .lean();
    if (!sale) return res.status(404).json({ success: false, message: 'Manual sale not found.' });
    const bid = getBranchId(req.user);
    const canAccess =
      req.user.role === 'admin' ||
      (bid && String(sale.branchId?._id ?? sale.branchId) === String(bid));
    if (!canAccess) return res.status(404).json({ success: false, message: 'Manual sale not found.' });
    res.json({
      success: true,
      sale: {
        id: String(sale._id),
        branchId: String(sale.branchId?._id ?? sale.branchId),
        branchName: sale.branchId?.name ?? '—',
        date: sale.date,
        amount: sale.amount,
        imageBase64: sale.imageBase64,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch manual sale.' });
  }
});

/** POST /api/manual-sales - create with optional base64 image. Admin: any branch. Vendor: own branch. */
router.post('/', async (req, res) => {
  try {
    const { branchId, date, amount, imageBase64 } = req.body;
    if (!date || amount == null) {
      return res.status(400).json({ success: false, message: 'Date and number of sales are required.' });
    }
    const bid = getBranchId(req.user);
    const targetBranchId = req.user.role === 'admin' ? (branchId || bid) : bid;
    if (!targetBranchId) {
      return res.status(400).json({ success: false, message: 'Branch is required.' });
    }
    const sale = await ManualSale.create({
      branchId: targetBranchId,
      date: new Date(date),
      amount: Number(amount),
      imageBase64: imageBase64 || undefined,
    });
    const populated = await ManualSale.findById(sale._id).populate('branchId', 'name').lean();
    res.status(201).json({
      success: true,
      sale: {
        id: String(populated._id),
        branchId: String(populated.branchId?._id ?? populated.branchId),
        branchName: populated.branchId?.name ?? '—',
        date: populated.date,
        amount: populated.amount,
        hasImage: Boolean(populated.imageBase64),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create manual sale.' });
  }
});

/** DELETE /api/manual-sales/:id - Admin only */
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const sale = await ManualSale.findByIdAndDelete(req.params.id);
    if (!sale) return res.status(404).json({ success: false, message: 'Manual sale not found.' });
    res.json({ success: true, message: 'Manual sale deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to delete manual sale.' });
  }
});

module.exports = router;
