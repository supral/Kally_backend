const express = require('express');
const SalesImage = require('../models/SalesImage');
const ManualSale = require('../models/ManualSale');
const Membership = require('../models/Membership');
const { protect } = require('../middleware/auth');
const { getBranchId } = require('../middleware/branchFilter');

const router = express.Router();

const RETENTION_DAYS = 7;

async function purgeOldRecords() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  cutoff.setHours(0, 0, 0, 0);
  await SalesImage.deleteMany({ createdAt: { $lt: cutoff } });
}

async function getSalesCountForBranchDate(branchId, date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const [manualCount, membershipCount] = await Promise.all([
    ManualSale.countDocuments({ branchId, date: { $gte: start, $lte: end } }),
    Membership.countDocuments({ soldAtBranchId: branchId, purchaseDate: { $gte: start, $lte: end } }),
  ]);

  return manualCount + membershipCount;
}

router.use(protect);

/** GET /api/sales-images - list. Admin: all. Vendor: own branch. Purge old, return with sales count */
router.get('/', async (req, res) => {
  try {
    await purgeOldRecords();

    const bid = getBranchId(req.user);
    const { branchId } = req.query;
    const filter = {};
    if (req.user.role === 'admin' && branchId) filter.branchId = branchId;
    else if (req.user.role === 'vendor' && bid) filter.branchId = bid;
    else if (req.user.role === 'vendor') filter.branchId = { $in: [] };

    const images = await SalesImage.find(filter)
      .populate('branchId', 'name')
      .sort({ date: -1, createdAt: -1 })
      .lean();

    const withCount = await Promise.all(
      images.map(async (img) => {
        const computed = await getSalesCountForBranchDate(img.branchId?._id ?? img.branchId, img.date);
        const salesCount = typeof img.manualSalesCount === 'number' && img.manualSalesCount >= 0 ? img.manualSalesCount : computed;
        return {
          id: img._id,
          title: img.title,
          description: img.description ?? '',
          date: img.date,
          branchId: img.branchId?._id?.toString?.() ?? img.branchId,
          branchName: img.branchId?.name ?? '—',
          hasImage: true,
          salesCount,
          manualSalesCount: img.manualSalesCount ?? null,
          salesAmount: img.salesAmount ?? null,
          createdAt: img.createdAt,
        };
      })
    );

    res.json({ success: true, images: withCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch Sales Data.' });
  }
});

/** GET /api/sales-images/:id - get single with image */
router.get('/:id', async (req, res) => {
  try {
    const img = await SalesImage.findById(req.params.id).populate('branchId', 'name').lean();
    if (!img) return res.status(404).json({ success: false, message: 'Sales Data not found.' });

    const bid = getBranchId(req.user);
    const canAccess =
      req.user.role === 'admin' ||
      (bid && String(img.branchId?._id ?? img.branchId) === String(bid));

    if (!canAccess) return res.status(404).json({ success: false, message: 'Sales Data not found.' });

    const computed = await getSalesCountForBranchDate(img.branchId?._id ?? img.branchId, img.date);
    const salesCount = typeof img.manualSalesCount === 'number' && img.manualSalesCount >= 0 ? img.manualSalesCount : computed;

    const imageBase64s = Array.isArray(img.imageBase64s) && img.imageBase64s.length > 0
      ? img.imageBase64s
      : (img.imageBase64 ? [img.imageBase64] : []);

    res.json({
      success: true,
      image: {
        id: img._id,
        title: img.title,
        description: img.description ?? '',
        date: img.date,
        branchId: img.branchId?._id?.toString?.() ?? img.branchId,
        branchName: img.branchId?.name ?? '—',
        imageBase64s,
        salesCount,
        manualSalesCount: img.manualSalesCount ?? null,
        salesAmount: img.salesAmount ?? null,
        createdAt: img.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch sales image.' });
  }
});

/** PATCH /api/sales-images/:id - update manual sales count, description, sales amount */
router.patch('/:id', async (req, res) => {
  try {
    const img = await SalesImage.findById(req.params.id);
    if (!img) return res.status(404).json({ success: false, message: 'Sales Data not found.' });

    const bid = getBranchId(req.user);
    const canAccess =
      req.user.role === 'admin' ||
      (bid && String(img.branchId) === String(bid));
    if (!canAccess) return res.status(404).json({ success: false, message: 'Sales Data not found.' });

    const { manualSalesCount, description, salesAmount } = req.body;
    if (manualSalesCount != null && manualSalesCount !== '') {
      const num = Number(manualSalesCount);
      if (!Number.isInteger(num) || num < 0) {
        return res.status(400).json({ success: false, message: 'Manual sales count must be a non-negative integer.' });
      }
      img.manualSalesCount = num;
    } else if (manualSalesCount === '' || manualSalesCount === null) {
      img.manualSalesCount = null;
    }
    if (description !== undefined) img.description = description ? String(description).trim() : '';
    if (salesAmount !== undefined) {
      const amt = Number(salesAmount);
      img.salesAmount = (amt >= 0 && !Number.isNaN(amt)) ? amt : null;
    }
    await img.save();

    const populated = await SalesImage.findById(img._id).populate('branchId', 'name').lean();
    const computed = await getSalesCountForBranchDate(populated.branchId?._id ?? populated.branchId, populated.date);
    const salesCount = typeof populated.manualSalesCount === 'number' && populated.manualSalesCount >= 0 ? populated.manualSalesCount : computed;

    res.json({
      success: true,
      image: {
        id: populated._id,
        title: populated.title,
        description: populated.description ?? '',
        date: populated.date,
        branchId: populated.branchId?._id?.toString?.() ?? populated.branchId,
        branchName: populated.branchId?.name ?? '—',
        hasImage: true,
        salesCount,
        manualSalesCount: populated.manualSalesCount ?? null,
        salesAmount: populated.salesAmount ?? null,
        createdAt: populated.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update Sales Data.' });
  }
});

/** POST /api/sales-images - create. Vendor: own branch. Admin: any branch */
router.post('/', async (req, res) => {
  try {
    const { title, description, date, imageBase64, imageBase64s, branchId, manualSalesCount, salesAmount } = req.body;
    if (!title || !String(title).trim()) return res.status(400).json({ success: false, message: 'Title is required.' });
    if (!date) return res.status(400).json({ success: false, message: 'Date is required.' });
    const images = Array.isArray(imageBase64s) && imageBase64s.length > 0
      ? imageBase64s.filter((b) => b && typeof b === 'string')
      : (imageBase64 ? [imageBase64] : []);
    if (images.length === 0) return res.status(400).json({ success: false, message: 'At least one image is required.' });

    const bid = getBranchId(req.user);
    const targetBranchId = req.user.role === 'admin' ? (branchId || bid) : bid;
    if (!targetBranchId) return res.status(400).json({ success: false, message: 'Branch is required.' });

    const manual = manualSalesCount != null && Number.isInteger(Number(manualSalesCount)) && Number(manualSalesCount) >= 0 ? Number(manualSalesCount) : null;
    const desc = description != null ? String(description).trim() : '';
    const amt = salesAmount != null && salesAmount !== '' ? Number(salesAmount) : null;
    const salesAmt = (amt != null && !Number.isNaN(amt) && amt >= 0) ? amt : null;

    const img = await SalesImage.create({
      branchId: targetBranchId,
      title: String(title).trim(),
      description: desc,
      date: new Date(date),
      imageBase64s: images,
      ...(manual !== null && { manualSalesCount: manual }),
      ...(salesAmt !== null && { salesAmount: salesAmt }),
    });

    const populated = await SalesImage.findById(img._id).populate('branchId', 'name').lean();
    const computed = await getSalesCountForBranchDate(populated.branchId?._id ?? populated.branchId, populated.date);
    const salesCount = typeof populated.manualSalesCount === 'number' && populated.manualSalesCount >= 0 ? populated.manualSalesCount : computed;

    res.status(201).json({
      success: true,
      image: {
        id: populated._id,
        title: populated.title,
        description: populated.description ?? '',
        date: populated.date,
        branchId: populated.branchId?._id?.toString?.() ?? populated.branchId,
        branchName: populated.branchId?.name ?? '—',
        hasImage: true,
        salesCount,
        manualSalesCount: populated.manualSalesCount ?? null,
        salesAmount: populated.salesAmount ?? null,
        createdAt: populated.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create Sales Data.' });
  }
});

module.exports = router;
