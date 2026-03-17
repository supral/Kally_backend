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
const { createActivityLog } = require('../utils/activityLog');
const { validateBulkIds } = require('../utils/validateBulkIds');

async function getDefaultMembershipTypeId() {
  let type = await MembershipType.findOne({ isActive: true }).sort({ name: 1 }).lean();
  if (!type) {
    type = await MembershipType.create({ name: 'Default', totalCredits: 1 });
  }
  return type._id;
}

function toNumber(value, fallback = 0) {
  if (value == null || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function computeSettlementPerCredit(packagePrice, discountAmount, totalCredits) {
  const price = toNumber(packagePrice, 0);
  const discount = toNumber(discountAmount, 0);
  const credits = Math.max(1, toNumber(totalCredits, 1));
  // Settlement Amount per credit/session:
  // (Price of package + Discount) / (2 * No. Of sessions)
  return (price + discount) / (2 * credits);
}

function mapLegacyCustomer(c) {
  if (!c) return null;
  const name = c.name || c.customer_name || c.customerName || '';
  const phone = c.phone || c.contact || c.mobile || c.phoneNumber || '';
  const email = c.email || c.customer_email || c.customerEmail || null;
  const membershipCardId = c.membershipCardId || c.cardId || c.card_id || c.id || null;
  return { id: c._id || c.id, name, phone, email, membershipCardId };
}

function normalizeBranchName(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '');
}

function parseTotalUsedRemaining(value) {
  const raw = String(value || '').replace(/\\\//g, '/');
  const parts = raw.split('/').map((p) => p.trim()).filter(Boolean);
  const total = toNumber(parts[0], 0);
  const used = toNumber(parts[1], 0);
  const remaining = toNumber(parts[2], total - used);
  return {
    totalCredits: total > 0 ? total : 0,
    usedCredits: used >= 0 ? used : 0,
    remainingCredits: Number.isFinite(remaining) ? remaining : Math.max(0, total - used),
  };
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
    const { valid, ids: objectIds, message } = validateBulkIds(ids);
    if (!valid) return res.status(400).json({ success: false, message: message || 'Invalid ids.' });
    const [usages, settlements, memberships] = await Promise.all([
      MembershipUsage.deleteMany({ membershipId: { $in: objectIds } }),
      InternalSettlement.deleteMany({ membershipId: { $in: objectIds } }),
      Membership.deleteMany({ _id: { $in: objectIds } }),
    ]);
    const count = memberships.deletedCount ?? 0;
    if (count > 0) {
      createActivityLog({
        userId: req.user._id,
        description: `Bulk deleted ${count} membership(s)`,
        entity: 'membership',
        details: { count },
      }).catch(() => {});
    }
    return res.json({
      success: true,
      deleted: {
        memberships: count,
        membershipUsages: usages.deletedCount ?? 0,
        internalSettlements: settlements.deletedCount ?? 0,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to bulk delete memberships.' });
  }
});

// Allow larger membership lists for big imports/reports.
// Default fetches up to 40k; callers can request up to 60k via ?limit=.
const DEFAULT_MEMBERSHIPS_LIMIT = 40000;
const MAX_MEMBERSHIPS_LIMIT = 60000;

router.get('/', async (req, res) => {
  try {
    const { branchId, customerId, status, dateFrom, dateTo, limit: limitParam } = req.query;
    const filter = {};
    // Universal: all branches see all memberships (so any branch can do credit redeem). Admin can filter by sold-at branch for reporting.
    if (req.user.role === 'admin' && branchId) filter.soldAtBranchId = branchId;
    if (customerId) filter.customerId = customerId;
    // By default, hide fully used memberships from the list, but allow explicit status filter to override.
    if (status) filter.status = status;
    else filter.status = { $ne: 'used' };
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
      // Include legacy customer fields too (older DBs used customer_name/contact/id).
      .populate('customerId', 'name phone email membershipCardId customer_name customerName customer_email customerEmail contact mobile phoneNumber id cardId card_id')
      .populate('membershipTypeId', 'name totalCredits')
      .populate('soldAtBranchId', 'name')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Legacy memberships (from older PHP/MySQL exports) may store foreign keys as numeric strings:
    // customer_id, branch_id, package_id, plus optional package_name/package_price.
    // If those exist, we resolve them by index against current collections (sorted by _id).
    const needLegacyResolution = memberships.some(
      (m) =>
        (m.customerId == null && (m.customer_id != null || m.customerIdLegacy != null)) ||
        (m.soldAtBranchId == null && (m.branch_id != null || m.sold_at != null || m.soldAt != null)) ||
        (m.totalCredits == null && (m.package_id != null || m.total_used_remaining != null || m.totalUsedRemaining != null))
    );
    let customersByIndex = [];
    let branchesByIndex = [];
    let packagesByIndex = [];
    let branchIdByNormName = new Map();
    if (needLegacyResolution) {
      const [customersAll, branchesAll, packagesAll] = await Promise.all([
        Customer.find({}).select('name phone email membershipCardId customer_name contact id').sort({ _id: 1 }).lean(),
        Branch.find({}).select('name').sort({ _id: 1 }).lean(),
        Package.find({}).select('name price totalSessions').sort({ _id: 1 }).lean(),
      ]);
      customersByIndex = customersAll;
      branchesByIndex = branchesAll;
      packagesByIndex = packagesAll;
      branchIdByNormName = new Map(
        branchesAll
          .map((b) => [normalizeBranchName(b.name), b._id])
          .filter(([k]) => k)
      );
    }

    const resolveLegacy = (m) => {
      const out = { ...m };
      // customer
      if (!out.customerId && out.customer_id != null) {
        const idx = Math.max(0, parseInt(String(out.customer_id), 10) - 1);
        const c = customersByIndex[idx];
        if (c) out.customerId = c;
      }
      // soldAt branch
      if (!out.soldAtBranchId && out.branch_id != null) {
        const idx = Math.max(0, parseInt(String(out.branch_id), 10) - 1);
        const b = branchesByIndex[idx];
        if (b) out.soldAtBranchId = b;
      }
      // sold_at branch name (cm.json style)
      if (!out.soldAtBranchId && (out.sold_at != null || out.soldAt != null || out.sold_at_branch != null)) {
        const name = out.sold_at || out.soldAt || out.sold_at_branch;
        const norm = normalizeBranchName(name);
        const bid = branchIdByNormName.get(norm);
        if (bid) out.soldAtBranchId = { _id: bid, name };
        else if (name) out.soldAtBranch = name;
      }
      // package
      if (out.packageName == null && (out.package_name != null || out.packageNameLegacy != null)) {
        out.packageName = out.package_name || out.packageNameLegacy;
      }
      if ((out.totalCredits == null || out.totalCredits === 0) && out.package_id != null) {
        const idx = Math.max(0, parseInt(String(out.package_id), 10) - 1);
        const p = packagesByIndex[idx];
        if (p) {
          out.totalCredits = p.totalSessions ?? out.totalCredits;
          out.packageName = out.packageName || p.name;
          if (out.packagePrice == null && p.price != null) out.packagePrice = p.price;
        }
      }
      // total_used_remaining (cm.json style)
      if ((out.totalCredits == null || out.usedCredits == null) && (out.total_used_remaining != null || out.totalUsedRemaining != null)) {
        const parsed = parseTotalUsedRemaining(out.total_used_remaining || out.totalUsedRemaining);
        if (out.totalCredits == null) out.totalCredits = parsed.totalCredits;
        if (out.usedCredits == null) out.usedCredits = parsed.usedCredits;
        if (out.remainingCredits == null) out.remainingCredits = parsed.remainingCredits;
      }
      return out;
    };

    res.json({
      success: true,
      memberships: memberships.map((raw) => {
        const m = needLegacyResolution ? resolveLegacy(raw) : raw;
        const totalCredits = toNumber(m.totalCredits, toNumber(m.membershipTypeId?.totalCredits, 0));
        const usedCredits = toNumber(m.usedCredits, toNumber(m.used_credits, 0));
        return ({
        id: m._id,
        customer: mapLegacyCustomer(m.customerId),
        typeName: m.membershipTypeId?.name,
          packageName: m.packageName || m.package_name || m.package_name_text || m.membershipTypeId?.name,
        totalCredits,
        usedCredits,
          remainingCredits: Math.max(0, toNumber(m.remainingCredits, totalCredits - usedCredits)),
          soldAtBranch: m.soldAtBranchId?.name || m.soldAtBranch || m.sold_at,
        soldAtBranchId: m.soldAtBranchId?._id || m.soldAtBranchId,
        purchaseDate: m.purchaseDate,
        expiryDate: m.expiryDate,
          status: (() => {
            const s = (m.status || m.membership_status || 'active');
            const up = String(s).toLowerCase();
            if (up === 'inactive') return 'expired';
            return up;
          })(),
        packagePrice: m.packagePrice,
        discountAmount: m.discountAmount ?? 0,
        });
      }),
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
    else settlementAmount = computeSettlementPerCredit(packagePrice, discount, Number(totalCredits));
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

    createActivityLog({
      userId: req.user._id,
      branchId: m.soldAtBranchId?._id || m.soldAtBranchId,
      description: `Sold membership: ${packageName}`,
      entity: 'membership',
      entityId: membership._id,
      details: {
        packageName,
        packagePrice: effectivePrice,
        branchName: m.soldAtBranchId?.name,
        customerName: m.customerId?.name,
        totalCredits: m.membershipTypeId?.totalCredits ?? m.totalCredits,
      },
    }).catch(() => {});

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
      .populate('customerId', 'name phone email membershipCardId customer_name customerName customer_email customerEmail contact mobile phoneNumber id cardId card_id')
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
        customer: mapLegacyCustomer(membership.customerId),
        typeName: membership.membershipTypeId?.name,
        totalCredits: toNumber(membership.totalCredits, toNumber(membership.membershipTypeId?.totalCredits, 0)),
        usedCredits: toNumber(membership.usedCredits, 0),
        remainingCredits: Math.max(0, toNumber(membership.totalCredits, toNumber(membership.membershipTypeId?.totalCredits, 0)) - toNumber(membership.usedCredits, 0)),
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

    createActivityLog({
      userId: req.user._id,
      branchId: m.soldAtBranchId?._id || m.soldAtBranchId,
      description: 'Updated membership',
      entity: 'membership',
      entityId: membership._id,
      details: { customerName: m.customerId?.name, status: m.status, usedCredits: m.usedCredits },
    }).catch(() => {});
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
    const membership = await Membership.findById(req.params.id)
      .populate('customerId', 'name')
      .populate('soldAtBranchId', 'name')
      .lean();
    if (!membership) return res.status(404).json({ success: false, message: 'Membership not found.' });
    await MembershipUsage.deleteMany({ membershipId: membership._id });
    await Membership.findByIdAndDelete(membership._id);
    createActivityLog({
      userId: req.user._id,
      branchId: membership.soldAtBranchId?._id || membership.soldAtBranchId,
      description: 'Deleted membership',
      entity: 'membership',
      entityId: membership._id,
      details: { customerName: membership.customerId?.name },
    }).catch(() => {});
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
    const settlementAmount = computeSettlementPerCredit(price, 0, credits);
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
      settlementAmount,
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

    createActivityLog({
      userId: req.user._id,
      branchId: m.soldAtBranchId?._id || m.soldAtBranchId,
      description: 'Renewed membership',
      entity: 'membership',
      entityId: m._id,
      details: { packageName, customerName: m.customerId?.name, totalCredits: m.totalCredits },
    }).catch(() => {});
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
      const perCredit =
        membership.settlementAmount != null && membership.settlementAmount >= 0
          ? Number(membership.settlementAmount)
          : computeSettlementPerCredit(
              membership.packagePrice != null ? membership.packagePrice : membership.membershipTypeId?.price,
              membership.discountAmount,
              membership.totalCredits
            );
      const amount = round2(perCredit * toUse);
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

    createActivityLog({
      userId: req.user._id,
      branchId: usedAtBranchId,
      description: 'Used membership credit(s)',
      entity: 'membership',
      entityId: membership._id,
      details: { customerName: membership.customerId?.name, creditsUsed: toUse, remainingCredits: membership.totalCredits - membership.usedCredits },
    }).catch(() => {});
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
