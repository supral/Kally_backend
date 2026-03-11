const express = require('express');
const Membership = require('../models/Membership');
const Package = require('../models/Package');
const MembershipType = require('../models/MembershipType');
const MembershipUsage = require('../models/MembershipUsage');
const InternalSettlement = require('../models/InternalSettlement');
const Settings = require('../models/Settings');
const AuditLog = require('../models/AuditLog');
const Customer = require('../models/Customer');
const Branch = require('../models/Branch');
const { protect, authorize } = require('../middleware/auth');
const { getBranchId } = require('../middleware/branchFilter');

async function getDefaultMembershipTypeId() {
  let type = await MembershipType.findOne({ isActive: true }).sort({ name: 1 }).lean();
  if (!type) {
    type = await MembershipType.create({ name: 'Default', totalCredits: 1 });
  }
  return type._id;
}

const router = express.Router();

router.use(protect);

/**
 * POST /api/memberships/bulk-delete
 * Admin-only: delete memberships in bulk and also delete associated membership usages and internal settlements.
 * Guarded by a Settings toggle.
 */
router.post('/bulk-delete', authorize('admin'), async (req, res) => {
  try {
    const settingsDoc = await Settings.findOne().lean();
    if (settingsDoc?.showBulkDeleteMembershipsToAdmin !== true) {
      return res.status(403).json({ success: false, message: 'Bulk delete is disabled in Settings.' });
    }
    const { ids, confirm } = req.body || {};
    if (confirm !== 'DELETE_SELECTED_MEMBERSHIPS') {
      return res.status(400).json({ success: false, message: 'Confirmation required.' });
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'ids[] is required.' });
    }
    if (ids.length > 5000) {
      return res.status(400).json({ success: false, message: 'Too many ids. Max 5000 per request.' });
    }
    const [usages, settlements, memberships] = await Promise.all([
      MembershipUsage.deleteMany({ membershipId: { $in: ids } }),
      InternalSettlement.deleteMany({ membershipId: { $in: ids } }),
      Membership.deleteMany({ _id: { $in: ids } }),
    ]);
    return res.json({
      success: true,
      deleted: {
        memberships: memberships.deletedCount ?? 0,
        membershipUsages: usages.deletedCount ?? 0,
        internalSettlements: settlements.deletedCount ?? 0,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to bulk delete memberships.' });
  }
});

const DEFAULT_MEMBERSHIPS_LIMIT = 1000;
const MAX_MEMBERSHIPS_LIMIT = 2000;

router.get('/', async (req, res) => {
  try {
    const { branchId, customerId, status, dateFrom, dateTo, limit: limitParam } = req.query;
    const filter = {};
    // Universal: all branches see all memberships (so any branch can do credit redeem). Admin can filter by sold-at branch for reporting.
    if (req.user.role === 'admin' && branchId) filter.soldAtBranchId = branchId;
    if (customerId) filter.customerId = customerId;
    if (status) filter.status = status;
    if (dateFrom || dateTo) {
      filter.purchaseDate = {};
      if (dateFrom) filter.purchaseDate.$gte = new Date(dateFrom);
      if (dateTo) {
        const d = new Date(dateTo);
        d.setHours(23, 59, 59, 999);
        filter.purchaseDate.$lte = d;
      }
    }

    const limit = limitParam ? Math.min(MAX_MEMBERSHIPS_LIMIT, Math.max(1, parseInt(limitParam, 10))) : DEFAULT_MEMBERSHIPS_LIMIT;
    const memberships = await Membership.find(filter)
      .populate('customerId', 'name phone email membershipCardId')
      .populate('membershipTypeId', 'name totalCredits')
      .populate('soldAtBranchId', 'name')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({
      success: true,
      memberships: memberships.map((m) => ({
        id: m._id,
        customer: m.customerId
          ? { id: m.customerId._id, name: m.customerId.name, phone: m.customerId.phone, email: m.customerId.email, membershipCardId: m.customerId.membershipCardId }
          : null,
        typeName: m.membershipTypeId?.name,
        packageName: m.packageName || m.membershipTypeId?.name,
        totalCredits: m.totalCredits,
        usedCredits: m.usedCredits,
        remainingCredits: m.totalCredits - m.usedCredits,
        soldAtBranch: m.soldAtBranchId?.name,
        soldAtBranchId: m.soldAtBranchId?._id,
        purchaseDate: m.purchaseDate,
        expiryDate: m.expiryDate,
        status: m.status,
        packagePrice: m.packagePrice,
        discountAmount: m.discountAmount ?? 0,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch memberships.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { customerId, membershipTypeId, totalCredits, soldAtBranchId, expiryDate, customerPackage, customerPackagePrice, customerPackageExpiry, discountAmount } = req.body;
    if (!customerId || totalCredits == null)
      return res.status(400).json({ success: false, message: 'customerId and totalCredits are required.' });
    const bid = getBranchId(req.user);
    const soldAt = req.user.role === 'admin' ? soldAtBranchId : (bid || soldAtBranchId);
    if (!soldAt) return res.status(400).json({ success: false, message: 'Branch is required.' });

    const packageName = customerPackage && String(customerPackage).trim() ? String(customerPackage).trim() : null;
    const rawPrice = customerPackagePrice != null && customerPackagePrice !== '' ? Number(customerPackagePrice) : NaN;
    if (!packageName)
      return res.status(400).json({ success: false, message: 'Package is required. Select a package from the list.' });
    if (Number.isNaN(rawPrice) || rawPrice < 0)
      return res.status(400).json({ success: false, message: 'Package price is required and must be 0 or greater.' });

    const packagePrice = rawPrice;
    const discount = discountAmount != null && discountAmount !== '' ? Math.max(0, Number(discountAmount)) : 0;
    const typeId = membershipTypeId || await getDefaultMembershipTypeId();
    let settlementAmount;
    const pkg = await Package.findOne({ name: packageName }).lean();
    if (pkg?.settlementAmount != null) settlementAmount = Number(pkg.settlementAmount);
    const membership = await Membership.create({
      customerId,
      membershipTypeId: typeId,
      totalCredits: Number(totalCredits),
      usedCredits: 0,
      soldAtBranchId: soldAt,
      status: 'active',
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      packagePrice: packagePrice,
      discountAmount: discount,
      packageName: packageName,
      settlementAmount: settlementAmount,
    });

    const effectivePrice = (packagePrice != null ? packagePrice : 0) - discount;

    // Keep Customer's denormalized package in sync for expiry alert on Customers page
    if (packageName || customerPackage != null || customerPackageExpiry != null) {
      const customerUpdates = {};
      customerUpdates.customerPackage = (customerPackage || packageName || null) && String(customerPackage || packageName).trim() ? String(customerPackage || packageName).trim() : null;
      if (customerPackagePrice != null && customerPackagePrice !== '' || packagePrice != null) customerUpdates.customerPackagePrice = effectivePrice;
      if (customerPackageExpiry !== undefined) customerUpdates.customerPackageExpiry = customerPackageExpiry ? new Date(customerPackageExpiry) : null;
      else if (packageName) customerUpdates.customerPackageExpiry = membership.expiryDate ? membership.expiryDate : null;
      if (Object.keys(customerUpdates).length > 0) {
        await Customer.findByIdAndUpdate(customerId, customerUpdates);
      }
    }

    const m = await Membership.findById(membership._id)
      .populate('customerId', 'name phone')
      .populate('membershipTypeId', 'name totalCredits')
      .populate('soldAtBranchId', 'name')
      .lean();

    res.status(201).json({
      success: true,
      membership: {
        id: m._id,
        customer: m.customerId ? { id: m.customerId._id, name: m.customerId.name, phone: m.customerId.phone } : null,
        typeName: m.membershipTypeId?.name,
        totalCredits: m.totalCredits,
        usedCredits: m.usedCredits,
        soldAtBranch: m.soldAtBranchId?.name,
        purchaseDate: m.purchaseDate,
        expiryDate: m.expiryDate,
        status: m.status,
        packagePrice: m.packagePrice,
        discountAmount: m.discountAmount ?? 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create membership.' });
  }
});

/** POST /api/memberships/import - bulk import from CSV-style rows. Branch from file is resolved by name. */
router.post('/import', async (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'rows array is required and must not be empty.' });
    }
    const bid = getBranchId(req.user);
    const branches = await Branch.find({ isActive: true }).lean();
    const branchByName = {};
    branches.forEach((b) => { branchByName[b.name.trim().toLowerCase()] = b._id; });
    const defaultTypeId = await getDefaultMembershipTypeId();
    let imported = 0;
    let createdCustomers = 0;
    const errors = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const customerName = (row.customerName || row.customer || '').toString().trim();
      const customerPhone = (row.customerPhone || row.phone || '').toString().trim();
      const customerEmail = (row.customerEmail || row.email || '').toString().trim();
      const totalCredits = parseInt(row.totalCredits, 10);
      const soldAtBranchName = (row.soldAtBranch || row.soldAt || row.branch || '').toString().trim();
      if (!customerName || !customerPhone) {
        errors.push({ row: i + 1, message: 'Customer name and phone are required.' });
        continue;
      }
      if (!totalCredits || totalCredits < 1) {
        errors.push({ row: i + 1, message: 'Total credits must be at least 1.' });
        continue;
      }
      const branchId = soldAtBranchName ? branchByName[soldAtBranchName.toLowerCase()] : null;
      if (!branchId) {
        errors.push({ row: i + 1, message: `Branch "${soldAtBranchName || '(empty)'}" not found. Use exact branch name from Branches.` });
        continue;
      }
      if (req.user.role === 'vendor' && bid && String(branchId) !== String(bid)) {
        errors.push({ row: i + 1, message: 'You can only import for your own branch.' });
        continue;
      }
      let customer = await Customer.findOne({ phone: customerPhone }).lean();
      if (!customer) {
        const created = await Customer.create({ name: customerName, phone: customerPhone, email: customerEmail || undefined });
        customer = { _id: created._id, name: created.name, phone: created.phone, email: created.email };
        createdCustomers++;
      }
      const purchaseDate = row.purchaseDate ? new Date(row.purchaseDate) : new Date();
      const expiryDate = row.expiryDate ? new Date(row.expiryDate) : undefined;
      const packagePrice = row.packagePrice != null && row.packagePrice !== '' ? Number(row.packagePrice) : undefined;
      const discountAmount = row.discountAmount != null && row.discountAmount !== '' ? Math.max(0, Number(row.discountAmount)) : 0;
      const customerPackage = (row.customerPackage || row.packageName || '').toString().trim() || undefined;
      await Membership.create({
        customerId: customer._id,
        membershipTypeId: defaultTypeId,
        totalCredits,
        usedCredits: 0,
        soldAtBranchId: branchId,
        status: 'active',
        purchaseDate,
        expiryDate: expiryDate || undefined,
        packagePrice,
        discountAmount,
        packageName: customerPackage,
      });
      imported++;
    }
    res.json({ success: true, imported, createdCustomers, errors });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to import memberships.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const membership = await Membership.findById(req.params.id)
      .populate('customerId', 'name phone email membershipCardId')
      .populate('membershipTypeId', 'name totalCredits serviceCategory')
      .populate('soldAtBranchId', 'name')
      .lean();
    if (!membership) return res.status(404).json({ success: false, message: 'Membership not found.' });

    const usages = await MembershipUsage.find({ membershipId: membership._id })
      .populate('usedAtBranchId', 'name')
      .populate('usedByUserId', 'name')
      .sort({ usedAt: -1 })
      .lean();

    res.json({
      success: true,
      membership: {
        id: membership._id,
        customer: membership.customerId,
        typeName: membership.membershipTypeId?.name,
        totalCredits: membership.totalCredits,
        usedCredits: membership.usedCredits,
        remainingCredits: membership.totalCredits - membership.usedCredits,
        soldAtBranch: membership.soldAtBranchId?.name,
        soldAtBranchId: membership.soldAtBranchId?._id?.toString(),
        purchaseDate: membership.purchaseDate,
        expiryDate: membership.expiryDate,
        status: membership.status,
        packagePrice: membership.packagePrice,
        discountAmount: membership.discountAmount ?? 0,
      },
      usageHistory: usages.map((u) => ({
        id: u._id,
        usedAtBranch: u.usedAtBranchId?.name,
        usedBy: u.usedByUserId?.name,
        creditsUsed: u.creditsUsed,
        usedAt: u.usedAt,
        notes: u.notes,
        serviceDetails: u.serviceDetails,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch membership.' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const membership = await Membership.findById(req.params.id);
    if (!membership) return res.status(404).json({ success: false, message: 'Membership not found.' });

    const allowed = ['usedCredits', 'status', 'expiryDate'];
    const updates = {};
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    });
    if (Object.keys(updates).length === 0)
      return res.status(400).json({ success: false, message: 'No allowed fields to update.' });

    const previous = { usedCredits: membership.usedCredits, status: membership.status };
    Object.assign(membership, updates);
    await membership.save();

    if (req.user.role === 'admin' && (updates.usedCredits !== undefined || updates.status !== undefined)) {
      await AuditLog.create({
        entity: 'Membership',
        entityId: membership._id,
        action: 'admin_edit',
        userId: req.user._id,
        changes: { previous, updates },
      });
    }

    const m = await Membership.findById(membership._id)
      .populate('customerId', 'name phone')
      .populate('membershipTypeId', 'name totalCredits')
      .populate('soldAtBranchId', 'name')
      .lean();

    res.json({
      success: true,
      membership: {
        id: m._id,
        totalCredits: m.totalCredits,
        usedCredits: m.usedCredits,
        remainingCredits: m.totalCredits - m.usedCredits,
        status: m.status,
        expiryDate: m.expiryDate,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update membership.' });
  }
});

/** DELETE /api/memberships/:id - delete a membership (admin only). Removes usage records then the membership. */
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const membership = await Membership.findById(req.params.id);
    if (!membership) return res.status(404).json({ success: false, message: 'Membership not found.' });
    await MembershipUsage.deleteMany({ membershipId: membership._id });
    await Membership.findByIdAndDelete(membership._id);
    res.json({ success: true, message: 'Membership deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to delete membership.' });
  }
});

/** POST /api/memberships/:id/renew - create a new membership as renewal (expired or fully used). Form sends price & package details; price is included in total sales. */
router.post('/:id/renew', async (req, res) => {
  try {
    const { packagePrice, totalCredits, expiryDate } = req.body;

    const membership = await Membership.findById(req.params.id)
      .populate('membershipTypeId', 'name totalCredits')
      .populate('soldAtBranchId', 'name');
    if (!membership) return res.status(404).json({ success: false, message: 'Membership not found.' });
    if (membership.status !== 'expired' && membership.status !== 'used') {
      return res.status(400).json({ success: false, message: 'Only expired or fully used memberships can be renewed.' });
    }

    const price = typeof packagePrice === 'number' && packagePrice >= 0
      ? packagePrice
      : (typeof packagePrice === 'string' ? parseFloat(packagePrice) : NaN);
    if (Number.isNaN(price) || price < 0) {
      return res.status(400).json({ success: false, message: 'Renewal price is required and must be 0 or greater.' });
    }

    const credits = totalCredits != null && Number(totalCredits) > 0
      ? Number(totalCredits)
      : membership.totalCredits;
    const expiry = expiryDate ? new Date(expiryDate) : undefined;

    const packageName = membership.packageName || membership.membershipTypeId?.name;
    const newMembership = await Membership.create({
      customerId: membership.customerId,
      membershipTypeId: membership.membershipTypeId._id || membership.membershipTypeId,
      totalCredits: credits,
      usedCredits: 0,
      soldAtBranchId: membership.soldAtBranchId._id || membership.soldAtBranchId,
      status: 'active',
      packagePrice: price,
      discountAmount: 0,
      packageName,
      expiryDate: expiry,
    });

    // Update Customer's denormalized package info so expiry alert on Customers page stays correct
    const customerUpdates = {};
    if (packageName) customerUpdates.customerPackage = packageName;
    customerUpdates.customerPackagePrice = price;
    customerUpdates.customerPackageExpiry = expiry ? expiry : null;
    if (Object.keys(customerUpdates).length > 0) {
      await Customer.findByIdAndUpdate(membership.customerId, customerUpdates);
    }

    const m = await Membership.findById(newMembership._id)
      .populate('customerId', 'name phone email membershipCardId')
      .populate('membershipTypeId', 'name totalCredits')
      .populate('soldAtBranchId', 'name')
      .lean();

    res.status(201).json({
      success: true,
      membership: {
        id: m._id,
        customer: m.customerId ? { id: m.customerId._id, name: m.customerId.name, phone: m.customerId.phone, email: m.customerId.email, membershipCardId: m.customerId.membershipCardId } : null,
        typeName: m.membershipTypeId?.name,
        totalCredits: m.totalCredits,
        usedCredits: m.usedCredits,
        remainingCredits: m.totalCredits - m.usedCredits,
        soldAtBranch: m.soldAtBranchId?.name,
        soldAtBranchId: m.soldAtBranchId?._id,
        purchaseDate: m.purchaseDate,
        expiryDate: m.expiryDate,
        status: m.status,
        packagePrice: m.packagePrice,
        discountAmount: m.discountAmount ?? 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to renew membership.' });
  }
});

router.post('/:id/use', async (req, res) => {
  try {
    const { creditsUsed = 1, notes, serviceDetails } = req.body;
    const bid = getBranchId(req.user);
    const usedAtBranchId = bid || req.body.usedAtBranchId;
    if (!usedAtBranchId) return res.status(400).json({ success: false, message: 'Branch (used at) is required.' });

    const membership = await Membership.findById(req.params.id)
      .populate('customerId', 'name phone')
      .populate('membershipTypeId', 'name price totalCredits')
      .populate('soldAtBranchId', 'name');
    if (!membership) return res.status(404).json({ success: false, message: 'Membership not found.' });

    const toUse = Number(creditsUsed) || 1;
    const remaining = membership.totalCredits - membership.usedCredits;
    if (toUse > remaining)
      return res.status(400).json({ success: false, message: `Only ${remaining} credit(s) remaining.` });

    membership.usedCredits += toUse;
    if (membership.usedCredits >= membership.totalCredits) membership.status = 'used';
    await membership.save();

    const usage = await MembershipUsage.create({
      membershipId: membership._id,
      usedAtBranchId,
      usedByUserId: req.user._id,
      creditsUsed: toUse,
      notes: notes || undefined,
      serviceDetails: serviceDetails ? String(serviceDetails).trim() : undefined,
    });

    const soldAtBranchId = membership.soldAtBranchId._id || membership.soldAtBranchId;
    if (String(soldAtBranchId) !== String(usedAtBranchId)) {
      let amount;
      if (membership.settlementAmount != null && membership.settlementAmount >= 0) {
        amount = Math.round(Number(membership.settlementAmount) * toUse * 100) / 100;
      } else {
        const settingsDoc = await Settings.findOne().lean();
        const settlementPercentage = settingsDoc?.settlementPercentage ?? 100;
        const multiplier = settlementPercentage / 100;
        const price = membership.membershipTypeId?.price != null ? Number(membership.membershipTypeId.price) : (membership.packagePrice != null ? Number(membership.packagePrice) : 0);
        const totalCredits = membership.totalCredits || 1;
        const baseAmount = totalCredits > 0 ? (price / totalCredits) * toUse : 0;
        amount = Math.round(baseAmount * multiplier * 100) / 100;
      }
      await InternalSettlement.create({
        fromBranchId: soldAtBranchId,
        toBranchId: usedAtBranchId,
        amount,
        reason: `Membership usage: ${membership.membershipTypeId?.name || 'Membership'} - ${toUse} credit(s)`,
        membershipUsageId: usage._id,
        status: 'pending',
      });
    }

    const u = await MembershipUsage.findById(usage._id)
      .populate('usedAtBranchId', 'name')
      .lean();

    res.status(201).json({
      success: true,
      usage: {
        id: u._id,
        usedAtBranch: u.usedAtBranchId?.name,
        creditsUsed: u.creditsUsed,
        usedAt: u.usedAt,
        remainingCredits: membership.totalCredits - membership.usedCredits,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to record usage.' });
  }
});

module.exports = router;
