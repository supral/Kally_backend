const express = require('express');
const mongoose = require('mongoose');
const Package = require('../models/Package');
const Settings = require('../models/Settings');
const { protect, authorize } = require('../middleware/auth');
const { createActivityLog } = require('../utils/activityLog');
const { validateBulkIds } = require('../utils/validateBulkIds');

const router = express.Router();
router.use(protect);

/** GET /api/packages or /api/packages/ - list packages.
 * Default: active only (dropdown). ?all=true for admin: all.
 *
 * Server-side paging/search (used by Packages page):
 * - ?page=1&limit=100
 * - ?search=... (matches name, status, sessions)
 */
const listPackages = async (req, res) => {
  try {
    const all = req.query.all === 'true' && req.user?.role === 'admin';
    const pageParam = req.query.page;
    const limitParam = req.query.limit;
    const searchParam = (req.query.search || req.query.q || '').toString().trim();

    const wantsPaging = pageParam != null || limitParam != null || searchParam.length > 0;

    const filter = all ? {} : { isActive: true };

    if (!wantsPaging) {
      const list = await Package.find(filter).sort({ name: 1 }).lean();
      return res.json({
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
    }

    const page = Math.max(1, parseInt(String(pageParam || '1'), 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(String(limitParam || '100'), 10) || 100));

    const search = searchParam.toLowerCase();
    if (search) {
      const statusMatch = search === 'active' ? true : search === 'inactive' ? false : null;
      filter.$or = [
        { name: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
        { totalSessions: Number.isFinite(Number(search)) ? Number(search) : -999999 },
      ];
      if (statusMatch !== null) filter.$or.push({ isActive: statusMatch });
    }

    const [total, list] = await Promise.all([
      Package.countDocuments(filter),
      Package.find(filter)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    const pages = Math.max(1, Math.ceil(total / limit));
    res.json({
      success: true,
      page,
      limit,
      total,
      pages,
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

/**
 * POST /api/packages/bulk-delete
 * Admin-only: deactivate packages in bulk (sets isActive=false).
 * Guarded by a Settings toggle.
 */
router.post('/bulk-delete', authorize('admin'), async (req, res) => {
  try {
    const settingsDoc = await Settings.findOne().lean();
    if (settingsDoc?.showBulkDeletePackagesToAdmin !== true) {
      return res.status(403).json({ success: false, message: 'Bulk delete is disabled in Settings.' });
    }
    const { ids, confirm } = req.body || {};
    if (confirm !== 'DELETE_SELECTED_PACKAGES') {
      return res.status(400).json({ success: false, message: 'Confirmation required.' });
    }
    const { valid, ids: objectIds, message } = validateBulkIds(ids);
    if (!valid) return res.status(400).json({ success: false, message: message || 'Invalid ids.' });
    const r = await Package.updateMany({ _id: { $in: objectIds } }, { $set: { isActive: false } });
    const count = r.modifiedCount ?? 0;
    if (count > 0) {
      createActivityLog({
        userId: req.user._id,
        description: `Bulk deactivated ${count} package(s)`,
        entity: 'package',
        details: { count },
      }).catch(() => {});
    }
    return res.json({ success: true, deactivated: count });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to bulk delete packages.' });
  }
});

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
    createActivityLog({
      userId: req.user._id,
      description: `Created package: ${pkg.name}`,
      entity: 'package',
      entityId: pkg._id,
      details: { price: pkg.price, totalSessions: pkg.totalSessions },
    }).catch(() => {});
    res.status(201).json({
      success: true,
      package: { id: pkg._id, name: pkg.name, price: pkg.price, discountAmount: pkg.discountAmount, totalSessions: pkg.totalSessions, settlementAmount: pkg.settlementAmount },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create package.' });
  }
});

/** PATCH /api/packages/:id - update (admin; vendor when showPackageActionsToVendor is true) */
router.patch('/:id', authorize('admin', 'vendor'), async (req, res) => {
  try {
    if (req.user.role === 'vendor') {
      const settingsDoc = await Settings.findOne().lean();
      if (settingsDoc?.showPackageActionsToVendor !== true) {
        return res.status(403).json({
          success: false,
          message: 'Package editing is disabled for vendors. Ask an admin to enable “Packages – vendor actions” in Settings.',
        });
      }
    }
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
    createActivityLog({
      userId: req.user._id,
      description: `Updated package: ${pkg.name}`,
      entity: 'package',
      entityId: pkg._id,
      details: { price: pkg.price, isActive: pkg.isActive },
    }).catch(() => {});
    res.json({
      success: true,
      package: { id: pkg._id, name: pkg.name, price: pkg.price, discountAmount: pkg.discountAmount, totalSessions: pkg.totalSessions, settlementAmount: pkg.settlementAmount, isActive: pkg.isActive },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update package.' });
  }
});

/** DELETE /api/packages/:id - soft delete (admin; vendor when showPackageActionsToVendor is true) */
router.delete('/:id', authorize('admin', 'vendor'), async (req, res) => {
  try {
    if (req.user.role === 'vendor') {
      const settingsDoc = await Settings.findOne().lean();
      if (settingsDoc?.showPackageActionsToVendor !== true) {
        return res.status(403).json({
          success: false,
          message: 'Package delete is disabled for vendors. Ask an admin to enable “Packages – vendor actions” in Settings.',
        });
      }
    }
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID.' });
    }
    const pkg = await Package.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found.' });
    createActivityLog({
      userId: req.user._id,
      description: `Deleted package: ${pkg.name}`,
      entity: 'package',
      entityId: pkg._id,
      details: {},
    }).catch(() => {});
    res.json({ success: true, message: 'Package removed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to delete package.' });
  }
});

module.exports = router;
