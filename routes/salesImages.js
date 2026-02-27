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
        const salesCount = await getSalesCountForBranchDate(img.branchId?._id ?? img.branchId, img.date);
        return {
          id: img._id,
          title: img.title,
          date: img.date,
          branchId: img.branchId?._id?.toString?.() ?? img.branchId,
          branchName: img.branchId?.name ?? '—',
          hasImage: true,
          salesCount,
          createdAt: img.createdAt,
        };
      })
    );

    res.json({ success: true, images: withCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch sales images.' });
  }
});

/** GET /api/sales-images/:id - get single with image */
router.get('/:id', async (req, res) => {
  try {
    const img = await SalesImage.findById(req.params.id).populate('branchId', 'name').lean();
    if (!img) return res.status(404).json({ success: false, message: 'Sales image not found.' });

    const bid = getBranchId(req.user);
    const canAccess =
      req.user.role === 'admin' ||
      (bid && String(img.branchId?._id ?? img.branchId) === String(bid));

    if (!canAccess) return res.status(404).json({ success: false, message: 'Sales image not found.' });

    const salesCount = await getSalesCountForBranchDate(img.branchId?._id ?? img.branchId, img.date);

    res.json({
      success: true,
      image: {
        id: img._id,
        title: img.title,
        date: img.date,
        branchId: img.branchId?._id?.toString?.() ?? img.branchId,
        branchName: img.branchId?.name ?? '—',
        imageBase64: img.imageBase64,
        salesCount,
        createdAt: img.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch sales image.' });
  }
});

/** POST /api/sales-images - create. Vendor: own branch. Admin: any branch */
router.post('/', async (req, res) => {
  try {
    const { title, date, imageBase64, branchId } = req.body;
    if (!title || !String(title).trim()) return res.status(400).json({ success: false, message: 'Title is required.' });
    if (!date) return res.status(400).json({ success: false, message: 'Date is required.' });
    if (!imageBase64) return res.status(400).json({ success: false, message: 'Image is required.' });

    const bid = getBranchId(req.user);
    const targetBranchId = req.user.role === 'admin' ? (branchId || bid) : bid;
    if (!targetBranchId) return res.status(400).json({ success: false, message: 'Branch is required.' });

    const img = await SalesImage.create({
      branchId: targetBranchId,
      title: String(title).trim(),
      date: new Date(date),
      imageBase64,
    });

    const populated = await SalesImage.findById(img._id).populate('branchId', 'name').lean();
    const salesCount = await getSalesCountForBranchDate(populated.branchId?._id ?? populated.branchId, populated.date);

    res.status(201).json({
      success: true,
      image: {
        id: populated._id,
        title: populated.title,
        date: populated.date,
        branchId: populated.branchId?._id?.toString?.() ?? populated.branchId,
        branchName: populated.branchId?.name ?? '—',
        hasImage: true,
        salesCount,
        createdAt: populated.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create sales image.' });
  }
});

module.exports = router;
