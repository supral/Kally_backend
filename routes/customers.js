const express = require('express');
const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Branch = require('../models/Branch');
const Appointment = require('../models/Appointment');
const Membership = require('../models/Membership');
const MembershipUsage = require('../models/MembershipUsage');
const LoyaltyAccount = require('../models/LoyaltyAccount');
const LoyaltyTransaction = require('../models/LoyaltyTransaction');
const Settings = require('../models/Settings');
const { protect } = require('../middleware/auth');
const { createActivityLog } = require('../utils/activityLog');
const { validateBulkIds } = require('../utils/validateBulkIds');
const { mapCustomerDocToApi } = require('../utils/customerNormalize');

/** Generate next card ID for a branch: prefix (first 3 letters of branch name) + 5-digit sequence, e.g. tes-00001 */
async function generateCardId(primaryBranchId) {
  let prefix = 'gen';
  let filter = { membershipCardId: { $regex: /^gen-\d+$/ } };
  if (primaryBranchId) {
    const branch = await Branch.findById(primaryBranchId).select('name').lean();
    if (branch && branch.name) {
      const letters = branch.name.replace(/[^a-zA-Z]/g, '').toLowerCase().slice(0, 3);
      prefix = letters || 'brn';
    }
    filter = { primaryBranchId, membershipCardId: new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d+$`) };
  }
  const existing = await Customer.find(filter).select('membershipCardId').lean();
  let maxNum = 0;
  for (const c of existing) {
    const match = (c.membershipCardId || '').match(/-(\d+)$/);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  }
  const nextNum = maxNum + 1;
  return `${prefix}-${String(nextNum).padStart(5, '0')}`;
}

const router = express.Router();

router.use(protect);

function extractRows(parsed) {
  if (Array.isArray(parsed)) {
    const tableObj = parsed.find((x) => x && typeof x === 'object' && x.type === 'table' && Array.isArray(x.data));
    if (tableObj) return tableObj.data;
    return parsed;
  }
  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.data)) return parsed.data;
  return [];
}

function normalizeBranchName(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '');
}

/**
 * POST /api/customers/import-legacy
 * Admin-only: Import customers from legacy JSON exports (PHPMyAdmin or plain array).
 *
 * Body: { data: any } where data is either:
 * - PHPMyAdmin export array with {type:"table",data:[...]}
 * - Array of customer rows
 * - { data: [...] }
 */
router.post('/import-legacy', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only.' });

    const rows = extractRows((req.body || {}).data);
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No rows found in JSON.' });
    }

    const cleanPhone = (s) => String(s || '').replace(/[^\d+]/g, '').trim();

    // Ensure branches exist so we can set primaryBranchId.
    const branchNames = new Set();
    for (const r of rows) {
      if (!r || typeof r !== 'object') continue;
      const name = String(r.branch || r.primaryBranch || r.primary_branch || '').trim();
      if (name) branchNames.add(name);
    }
    const existingBranches = await Branch.find({ name: { $in: Array.from(branchNames) } }).select('_id name').lean();
    const branchIdByNorm = new Map(existingBranches.map((b) => [normalizeBranchName(b.name), b._id]));
    const newBranchOps = [];
    for (const n of branchNames) {
      const norm = normalizeBranchName(n);
      if (!norm || branchIdByNorm.has(norm)) continue;
      newBranchOps.push({ insertOne: { document: { name: n, isActive: true } } });
    }
    if (newBranchOps.length) {
      await Branch.collection.bulkWrite(newBranchOps, { ordered: false });
      const refreshed = await Branch.find({ name: { $in: Array.from(branchNames) } }).select('_id name').lean();
      refreshed.forEach((b) => branchIdByNorm.set(normalizeBranchName(b.name), b._id));
    }

    const legacyIdMap = {};
    let imported = 0;
    let updated = 0;

    const BATCH_SIZE = 1000;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const ops = [];
      const phoneToLegacyId = new Map();
      const phones = [];

      for (const r of batch) {
        if (!r || typeof r !== 'object') continue;
        const legacyId = String(r.id || r.customer_id || r.customerId || '').trim();
        const name = String(r.name || r.customer_name || r.customerName || r.customer || '').trim();
        const phoneRaw = r.phone || r.contact || r.mobile || r.phoneNumber || r.contact_no;
        const phone = cleanPhone(phoneRaw);
        const emailRaw = String(r.email || r.customer_email || r.customerEmail || '').trim();
        const email = emailRaw ? emailRaw.toLowerCase() : undefined;
        if (!name || !phone) continue;

        const branchName = String(r.branch || r.primaryBranch || r.primary_branch || '').trim();
        const primaryBranchId = branchName ? branchIdByNorm.get(normalizeBranchName(branchName)) : undefined;

        const membershipCardId = String(r.membershipCardId || r.membership_card_id || r.card_id || r.cardId || legacyId || '').trim() || undefined;
        const notesParts = [];
        if (r.street_address) notesParts.push(`Address: ${String(r.street_address).trim()}`);
        else if (r.address) notesParts.push(`Address: ${String(r.address).trim()}`);
        if (r.notes) notesParts.push(String(r.notes).trim());
        const notes = notesParts.length ? notesParts.join('\n') : undefined;

        const $set = {
          name,
          phone,
          ...(email ? { email } : {}),
          ...(membershipCardId ? { membershipCardId } : {}),
          ...(notes ? { notes } : {}),
          ...(primaryBranchId ? { primaryBranchId } : {}),
        };

        ops.push({
          updateOne: {
            filter: { phone },
            update: { $set },
            upsert: true,
          },
        });

        if (legacyId) phoneToLegacyId.set(phone, legacyId);
        phones.push(phone);
      }

      if (ops.length === 0) continue;

      // Track which phones already existed for imported/updated counts.
      const existingPhones = await Customer.distinct('phone', { phone: { $in: phones } });
      const existingSet = new Set(existingPhones);

      await Customer.collection.bulkWrite(ops, { ordered: false });

      imported += phones.filter((p) => !existingSet.has(p)).length;
      updated += phones.filter((p) => existingSet.has(p)).length;

      // Build legacyIdMap by reading back _id for updated/inserted phones.
      const docs = await Customer.find({ phone: { $in: phones } }).select('_id phone').lean();
      for (const d of docs) {
        const legacyId = phoneToLegacyId.get(d.phone);
        if (legacyId) legacyIdMap[String(legacyId)] = String(d._id);
      }
    }

    return res.json({ success: true, imported, updated, legacyIdMap });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to import legacy customers.' });
  }
});

/**
 * POST /api/customers/backfill-branches
 * Admin-only: set customers.primaryBranchId based on memberships soldAtBranchId.
 * Useful after imports where customers were created without a branch.
 */
router.post('/backfill-branches', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only.' });

    const pipeline = [
      { $match: { customerId: { $ne: null }, soldAtBranchId: { $ne: null } } },
      // Prefer most recent membership for each customer
      { $sort: { purchaseDate: -1, createdAt: -1 } },
      {
        $group: {
          _id: '$customerId',
          soldAtBranchId: { $first: '$soldAtBranchId' },
        },
      },
    ];
    const rows = await Membership.aggregate(pipeline);
    if (!rows.length) return res.json({ success: true, updated: 0 });

    const ops = [];
    for (const r of rows) {
      // Some imported memberships stored customerId as a string, while Customer._id is an ObjectId.
      const customerObjectId =
        typeof r._id === 'string' && mongoose.Types.ObjectId.isValid(r._id)
          ? new mongoose.Types.ObjectId(r._id)
          : r._id;
      ops.push({
        updateOne: {
          filter: { _id: customerObjectId, $or: [{ primaryBranchId: { $exists: false } }, { primaryBranchId: null }] },
          update: { $set: { primaryBranchId: r.soldAtBranchId } },
        },
      });
    }

    const result = await Customer.collection.bulkWrite(ops, { ordered: false });
    return res.json({ success: true, updated: result.modifiedCount ?? 0 });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to backfill branches.' });
  }
});

/**
 * POST /api/customers/bulk-delete
 * Admin-only: deletes selected customers + related documents (appointments + loyalty).
 * Skips customers that have memberships.
 */
router.post('/bulk-delete', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only.' });

    const settingsDoc = await Settings.findOne().lean();
    const allowed = settingsDoc?.showCustomerDeleteToAdmin !== false;
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Customer delete is disabled in Settings.' });
    }

    const { ids, confirm } = req.body || {};
    if (confirm !== 'DELETE_SELECTED_CUSTOMERS') {
      return res.status(400).json({ success: false, message: 'Confirmation required.' });
    }
    const { valid, ids: objectIds, message } = validateBulkIds(ids);
    if (!valid) return res.status(400).json({ success: false, message: message || 'Invalid ids.' });

    const membershipCustomerIds = await Membership.distinct('customerId', { customerId: { $in: objectIds } });
    const blockedSet = new Set(membershipCustomerIds.map((x) => String(x)));
    const deletableIds = objectIds.filter((id) => !blockedSet.has(id.toString()));

    const [appointments, loyaltyAccounts, loyaltyTxns, customers] = await Promise.all([
      Appointment.deleteMany({ customerId: { $in: deletableIds } }),
      LoyaltyAccount.deleteMany({ customerId: { $in: deletableIds } }),
      LoyaltyTransaction.deleteMany({ customerId: { $in: deletableIds } }),
      Customer.deleteMany({ _id: { $in: deletableIds } }),
    ]);

    const customerCount = customers.deletedCount ?? 0;
    if (customerCount > 0) {
      createActivityLog({
        userId: req.user._id,
        description: `Bulk deleted ${customerCount} customer(s)`,
        entity: 'customer',
        details: { count: customerCount },
      }).catch(() => {});
    }
    return res.json({
      success: true,
      deleted: {
        customers: customerCount,
        appointments: appointments.deletedCount ?? 0,
        loyaltyAccounts: loyaltyAccounts.deletedCount ?? 0,
        loyaltyTransactions: loyaltyTxns.deletedCount ?? 0,
      },
      skippedWithMemberships: Array.from(blockedSet),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to bulk delete customers.' });
  }
});

/**
 * POST /api/customers/purge-all
 * Admin-only: deletes ALL customer data (customers + related documents).
 * Guarded by a Settings toggle and a confirm string in the request body.
 */
router.post('/purge-all', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only.' });

    const settingsDoc = await Settings.findOne().lean();
    const allowed = settingsDoc?.showDeleteAllCustomersButtonToAdmin === true;
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Delete-all is disabled in Settings.' });
    }

    const { confirm } = req.body || {};
    if (confirm !== 'DELETE_ALL_CUSTOMERS') {
      return res.status(400).json({ success: false, message: 'Confirmation required.' });
    }

    const [appointments, memberships, usages, loyaltyAccounts, loyaltyTxns, customers] = await Promise.all([
      Appointment.deleteMany({}),
      Membership.deleteMany({}),
      MembershipUsage.deleteMany({}),
      LoyaltyAccount.deleteMany({}),
      LoyaltyTransaction.deleteMany({}),
      Customer.deleteMany({}),
    ]);

    return res.json({
      success: true,
      deleted: {
        appointments: appointments.deletedCount ?? 0,
        memberships: memberships.deletedCount ?? 0,
        membershipUsages: usages.deletedCount ?? 0,
        loyaltyAccounts: loyaltyAccounts.deletedCount ?? 0,
        loyaltyTransactions: loyaltyTxns.deletedCount ?? 0,
        customers: customers.deletedCount ?? 0,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to purge customers.' });
  }
});

router.get('/', async (req, res) => {
  try {
    const forDropdown = req.query.forDropdown === '1' || req.query.forDropdown === 'true';
    const branchIdQuery = req.query.branchId;
    const pageParam = req.query.page;
    const limitParam = req.query.limit;
    const searchParam = (req.query.search || req.query.q || '').toString().trim();

    // Only use offset paging when `page` is present, or search/branch filter needs it.
    // Passing `limit` alone (e.g. ?limit=20000 for membership dropdowns) must NOT force paging — that path
    // incorrectly capped at 500 rows and hid newer customers from the create-membership picker.
    const wantsPaging =
      !forDropdown &&
      (String(pageParam || '').trim() !== '' ||
        searchParam.length > 0 ||
        (req.user.role === 'admin' && branchIdQuery));
    let filter = {};
    if (!forDropdown && req.user.role === 'admin' && branchIdQuery) {
      filter = { primaryBranchId: branchIdQuery };
    }
    // Universal customers: all branches see all customers. Admin can optionally filter by primary branch for reporting.
    // Default was 500, which made the UI look like it "can't add more than 500 customers" because lists/dropdowns
    // would never fetch beyond the first 500. We allow larger lists; UI should still prefer search for performance.
    // For large imports, we allow up to 50k; default is 20k so big accounts can see most/all customers.
    const limit = limitParam ? Math.min(50000, Math.max(1, parseInt(limitParam, 10))) : 20000;

    if (!wantsPaging) {
      const customers = await Customer.find(filter)
        .populate('primaryBranchId', 'name')
        .sort({ name: 1, customer_name: 1 })
        .limit(limit)
        .lean();

      return res.json({
        success: true,
        customers: customers.map((c) => mapCustomerDocToApi(c)).filter(Boolean),
      });
    }

    const page = Math.max(1, parseInt(String(pageParam || '1'), 10) || 1);
    const pagedLimit = Math.min(500, Math.max(1, parseInt(String(limitParam || '100'), 10) || 100));
    const skip = (page - 1) * pagedLimit;

    if (searchParam) {
      const safe = searchParam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rxText = new RegExp(safe, 'i');

      // Normalize phone queries so "98 76 54", "+977-98..." match stored phone digits.
      const digitsOnly = searchParam.replace(/[^\d]/g, '');
      const looksLikePhone = digitsOnly.length >= 3 && !/[a-zA-Z]/.test(searchParam);
      const rxPhone = looksLikePhone
        ? new RegExp(String(digitsOnly).split('').join('\\D*'), 'i')
        : null;

      filter.$or = [
        { name: rxText },
        { customer_name: rxText },
        { customerName: rxText },
        { customer: rxText },
        { phone: rxPhone ?? rxText },
        { contact: rxPhone ?? rxText },
        { mobile: rxPhone ?? rxText },
        { phoneNumber: rxPhone ?? rxText },
        { contact_no: rxPhone ?? rxText },
        { email: rxText },
        { customer_email: rxText },
        { customerEmail: rxText },
        { membershipCardId: rxText },
        { cardId: rxText },
        { card_id: rxText },
        { id: rxText },
      ];
    }

    const [total, customers] = await Promise.all([
      Customer.countDocuments(filter),
      Customer.find(filter)
        .populate('primaryBranchId', 'name')
        .sort({ name: 1, customer_name: 1 })
        .skip(skip)
        .limit(pagedLimit)
        .lean(),
    ]);

    const pages = Math.max(1, Math.ceil(total / pagedLimit));

    res.json({
      success: true,
      page,
      limit: pagedLimit,
      total,
      pages,
      customers: customers.map((c) => mapCustomerDocToApi(c)).filter(Boolean),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch customers.' });
  }
});

/**
 * GET /api/customers/suggest
 * Lightweight customer suggestions for typeahead UIs.
 * - Does NOT run countDocuments.
 * - Returns max `limit` records.
 */
router.get('/suggest', async (req, res) => {
  try {
    const searchParam = (req.query.search || req.query.q || '').toString().trim();
    const limitParam = req.query.limit != null ? parseInt(String(req.query.limit), 10) : 20;
    const limit = Math.min(100, Math.max(1, Number.isFinite(limitParam) ? limitParam : 20));

    let filter = {};
    if (searchParam) {
      const safe = searchParam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rxText = new RegExp(safe, 'i');

      // Normalize phone queries so "98 76 54", "+977-98..." match stored phone digits.
      const digitsOnly = searchParam.replace(/[^\d]/g, '');
      const looksLikePhone = digitsOnly.length >= 3 && !/[a-zA-Z]/.test(searchParam);
      const rxPhone = looksLikePhone ? new RegExp(String(digitsOnly).split('').join('\\D*'), 'i') : null;

      filter.$or = [
        { name: rxText },
        { customer_name: rxText },
        { customerName: rxText },
        { customer: rxText },
        { phone: rxPhone ?? rxText },
        { contact: rxPhone ?? rxText },
        { mobile: rxPhone ?? rxText },
        { phoneNumber: rxPhone ?? rxText },
        { contact_no: rxPhone ?? rxText },
        { email: rxText },
        { customer_email: rxText },
        { customerEmail: rxText },
        { membershipCardId: rxText },
        { cardId: rxText },
        { card_id: rxText },
        { id: rxText },
      ];
    }

    const customers = await Customer.find(filter)
      .populate('primaryBranchId', 'name')
      .sort({ name: 1, customer_name: 1 })
      .limit(limit)
      .lean();

    const mapped = customers.map((c) => mapCustomerDocToApi(c)).filter(Boolean);
    res.json({
      success: true,
      customers: mapped.map((row) => ({
        id: row.id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        membershipCardId: row.membershipCardId,
        primaryBranchId: row.primaryBranchId,
        primaryBranch: row.primaryBranch,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to build customer suggestions.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, phone, email, primaryBranchId, customerPackage, customerPackagePrice, customerPackageExpiry, notes } = req.body;
    if (!name || !phone)
      return res.status(400).json({ success: false, message: 'Name and phone are required.' });
    const bid = req.user.role === 'admin' ? primaryBranchId : (req.user.branchId?._id || req.user.branchId);
    const resolvedBranchId = bid || primaryBranchId || null;
    const membershipCardId = await generateCardId(resolvedBranchId);
    const customer = await Customer.create({
      name,
      phone,
      email: email || undefined,
      membershipCardId,
      primaryBranchId: resolvedBranchId,
      createdBy: req.user._id,
      customerPackage: customerPackage || undefined,
      customerPackagePrice: customerPackagePrice != null && customerPackagePrice !== '' ? Number(customerPackagePrice) : undefined,
      customerPackageExpiry: customerPackageExpiry ? new Date(customerPackageExpiry) : undefined,
      notes: notes || undefined,
    });
    const c = await Customer.findById(customer._id).populate('primaryBranchId', 'name').lean();
    createActivityLog({
      userId: req.user._id,
      branchId: c.primaryBranchId?._id || c.primaryBranchId,
      description: `Created customer: ${c.name}`,
      entity: 'customer',
      entityId: customer._id,
      details: { phone: c.phone, primaryBranch: c.primaryBranchId?.name },
    }).catch(() => {});
    res.status(201).json({
      success: true,
      customer: mapCustomerDocToApi(c),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create customer.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid customer id.' });
    }
    const customer = await Customer.findById(req.params.id).populate('primaryBranchId', 'name').lean();
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });
    // Universal: any branch can view any customer
    res.json({
      success: true,
      customer: mapCustomerDocToApi(customer, { includeNotes: true, includeCreatedAt: true }),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch customer.' });
  }
});

router.get('/:id/visit-history', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid customer id.' });
    }
    const customer = await Customer.findById(req.params.id).select('primaryBranchId createdBy').lean();
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });
    // Universal: any branch can view visit history

    const membershipIds = await Membership.find({ customerId: req.params.id }).distinct('_id');

    const [appointments, usageList] = await Promise.all([
      Appointment.find({ customerId: req.params.id, status: 'completed' })
        .populate('branchId', 'name')
        .populate('staffUserId', 'name')
        .populate('serviceId', 'name')
        .sort({ scheduledAt: -1 })
        .limit(200)
        .lean(),
      membershipIds.length
        ? MembershipUsage.find({ membershipId: { $in: membershipIds } })
            .populate('usedAtBranchId', 'name')
            .populate('usedByUserId', 'name')
            .sort({ usedAt: -1 })
            .limit(200)
            .lean()
        : [],
    ]);

    const timeline = [
      ...appointments.map((a) => ({
        type: 'appointment',
        id: a._id,
        date: a.scheduledAt,
        service: a.serviceId?.name || 'Appointment',
        branch: a.branchId?.name,
        branchId: a.branchId?._id,
        staff: a.staffUserId?.name,
      })),
      ...usageList.map((u) => ({
        type: 'membership_usage',
        id: u._id,
        date: u.usedAt,
        service: u.serviceDetails?.trim() || 'Membership service',
        branch: u.usedAtBranchId?.name,
        branchId: u.usedAtBranchId?._id,
        staff: u.usedByUserId?.name,
        creditsUsed: u.creditsUsed,
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ success: true, visitHistory: timeline });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch visit history.' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid customer id.' });
    }
    const existing = await Customer.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ success: false, message: 'Customer not found.' });
    // Allowlist fields to prevent mass assignment (e.g. createdBy, membershipCardId)
    const allowed = ['name', 'phone', 'email', 'customerPackage', 'customerPackagePrice', 'customerPackageExpiry', 'notes'];
    const updates = {};
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) {
        if (key === 'customerPackagePrice' && (req.body[key] === '' || req.body[key] == null)) updates[key] = undefined;
        else if (key === 'customerPackageExpiry') updates[key] = req.body[key] ? new Date(req.body[key]) : undefined;
        else updates[key] = req.body[key];
      }
    });
    if (req.user.role === 'admin' && req.body.primaryBranchId !== undefined) {
      updates.primaryBranchId = req.body.primaryBranchId || null;
    }
    const customer = await Customer.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    })
      .populate('primaryBranchId', 'name')
      .lean();
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });
    createActivityLog({
      userId: req.user._id,
      branchId: customer.primaryBranchId?._id || customer.primaryBranchId,
      description: `Updated customer: ${customer.name}`,
      entity: 'customer',
      entityId: customer._id,
      details: { phone: customer.phone, primaryBranch: customer.primaryBranchId?.name },
    }).catch(() => {});
    res.json({
      success: true,
      customer: mapCustomerDocToApi(customer, { includeNotes: true }),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update customer.' });
  }
});

module.exports = router;
