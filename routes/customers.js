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
    let filter = {};
    if (!forDropdown && req.user.role === 'admin' && branchIdQuery) {
      filter = { primaryBranchId: branchIdQuery };
    }
    // Universal customers: all branches see all customers. Admin can optionally filter by primary branch for reporting.
    const limitParam = req.query.limit;
    // Default was 500, which made the UI look like it "can't add more than 500 customers" because lists/dropdowns
    // would never fetch beyond the first 500. We allow larger lists; UI should still prefer search for performance.
    // For large imports, we allow up to 50k; default is 20k so big accounts can see most/all customers.
    const limit = limitParam ? Math.min(50000, Math.max(1, parseInt(limitParam, 10))) : 20000;
    const customers = await Customer.find(filter).populate('primaryBranchId', 'name').sort({ name: 1 }).limit(limit).lean();
    res.json({
      success: true,
      customers: customers.map((c) => ({
        id: c._id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        membershipCardId: c.membershipCardId,
        primaryBranch: c.primaryBranchId?.name,
        primaryBranchId: c.primaryBranchId?._id?.toString() || c.primaryBranchId?.toString() || null,
        customerPackage: c.customerPackage,
        customerPackagePrice: c.customerPackagePrice,
        customerPackageExpiry: c.customerPackageExpiry ? c.customerPackageExpiry.toISOString().split('T')[0] : null,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch customers.' });
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
      customer: {
        id: c._id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        membershipCardId: c.membershipCardId,
        primaryBranch: c.primaryBranchId?.name,
        customerPackage: c.customerPackage,
        customerPackagePrice: c.customerPackagePrice,
        customerPackageExpiry: c.customerPackageExpiry ? c.customerPackageExpiry.toISOString().split('T')[0] : null,
      },
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
      customer: {
        id: customer._id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        membershipCardId: customer.membershipCardId,
        primaryBranchId: customer.primaryBranchId?._id?.toString() || customer.primaryBranchId?.toString() || null,
        primaryBranch: customer.primaryBranchId?.name,
        customerPackage: customer.customerPackage,
        customerPackagePrice: customer.customerPackagePrice,
        customerPackageExpiry: customer.customerPackageExpiry ? customer.customerPackageExpiry.toISOString().split('T')[0] : null,
        notes: customer.notes,
        createdAt: customer.createdAt,
      },
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
      customer: {
        id: customer._id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        membershipCardId: customer.membershipCardId,
        primaryBranchId: customer.primaryBranchId?._id?.toString() || customer.primaryBranchId?.toString() || null,
        primaryBranch: customer.primaryBranchId?.name,
        customerPackage: customer.customerPackage,
        customerPackagePrice: customer.customerPackagePrice,
        customerPackageExpiry: customer.customerPackageExpiry ? customer.customerPackageExpiry.toISOString().split('T')[0] : null,
        notes: customer.notes,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update customer.' });
  }
});

module.exports = router;
