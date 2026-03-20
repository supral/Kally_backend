const express = require('express');
const mongoose = require('mongoose');
const Settings = require('../models/Settings');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Package = require('../models/Package');
const Appointment = require('../models/Appointment');
const Membership = require('../models/Membership');
const MembershipUsage = require('../models/MembershipUsage');
const MembershipType = require('../models/MembershipType');
const Lead = require('../models/Lead');
const Ticket = require('../models/Ticket');
const SalesImage = require('../models/SalesImage');
const ManualSale = require('../models/ManualSale');
const LoyaltyAccount = require('../models/LoyaltyAccount');
const LoyaltyTransaction = require('../models/LoyaltyTransaction');
const InternalSettlement = require('../models/InternalSettlement');
const AuditLog = require('../models/AuditLog');
const Branch = require('../models/Branch');
const { protect } = require('../middleware/auth');

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

function toNumber(v, fallback = 0) {
  if (v == null || v === '') return fallback;
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : fallback;
}

function round2(v) {
  return Math.round((Number(v) + Number.EPSILON) * 100) / 100;
}

function cleanPhone(s) {
  return String(s || '').replace(/[^\d+]/g, '').trim();
}

function parseZipCode(text) {
  const s = String(text || '');
  const m = s.match(/\b(\d{5})(?:-\d{4})?\b/);
  return m ? m[1] : undefined;
}

const BRANCH_ADDRESS_MAP = {
  tacoma: { name: 'Tacoma', address: '1901 s 72nd st , Tacoma WA 98408', zipCode: '98408' },
  lacey: { name: 'LACEY', address: '1120 GALAXY DR NE, LACEY, WA 98516', zipCode: '98516' },
  puyallup: { name: 'PUYALLUP', address: '13507 MERIDIAN E , PUYALLUP, WA 98373', zipCode: '98373' },
  silverdale: { name: 'SILVERDALE', address: '10406 SILVERDALE WAY NW, SILVERDALE , WA 98383', zipCode: '98383' },
  lakewood: { name: 'LAKEWOOD', address: '6111 LAKEWOOD TOWN CENTER BLVD, O1 , LAKEWOOD , WA 98499', zipCode: '98499' },
  tumwater: { name: 'TUMWATER', address: '5729 LITTLEROCK RD SE, TUMWATER WA 98512', zipCode: '98512' },
  'federal way': { name: 'FEDERAL WAY', address: '1413 S 348th St Suite L-103, FEDERAL WAY, WA 98003', zipCode: '98003' },
  seattle: { name: 'SEATTLE', address: '1418 Harvard Ave, Seattle, WA 98122', zipCode: '98122' },
  'bonney lake': { name: 'Bonney Lake', address: '20502 98th Street E, Bonney Lake, WA 98391', zipCode: '98391' },
};

async function getDefaultMembershipTypeId() {
  let type = await MembershipType.findOne({ isActive: true }).sort({ name: 1 }).lean();
  if (!type) type = await MembershipType.create({ name: 'Default', totalCredits: 1, isActive: true });
  return type._id;
}

/**
 * POST /api/settings/backfill-branch-addresses
 * Admin-only: set branch address + zip from a built-in map.
 */
router.post('/backfill-branch-addresses', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only.' });

    const branches = await Branch.find({}).select('_id name address zipCode').lean();
    const ops = [];
    for (const b of branches) {
      const norm = normalizeBranchName(b.name);
      const entry = BRANCH_ADDRESS_MAP[norm];
      if (!entry) continue;
      const zipCode = entry.zipCode || parseZipCode(entry.address);
      const nextAddress = entry.address;
      const needsAddress = !b.address || String(b.address).trim() === '';
      const needsZip = !b.zipCode || String(b.zipCode).trim() === '';
      if (!needsAddress && !needsZip) continue;
      ops.push({
        updateOne: {
          filter: { _id: b._id },
          update: { $set: { ...(needsAddress ? { address: nextAddress } : {}), ...(needsZip ? { zipCode } : {}) } },
        },
      });
    }
    if (!ops.length) return res.json({ success: true, updated: 0 });
    const result = await Branch.collection.bulkWrite(ops, { ordered: false });
    return res.json({ success: true, updated: result.modifiedCount ?? 0 });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to backfill branch addresses.' });
  }
});

/**
 * POST /api/settings/import-legacy-data
 * Admin-only: import legacy rows that include customer + package + membership fields.
 *
 * Accepts PHPMyAdmin JSON exports or plain arrays.
 * Upserts:
 * - Branches by name (row.branch)
 * - Packages by name (row.package_name)
 * - Customers by phone (row.contact)
 * - Memberships by (customerId + packageName + purchaseDate) to prevent duplicates on re-run
 */
router.post('/import-legacy-data', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only.' });

    const rows = extractRows((req.body || {}).data);
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No rows found in JSON.' });
    }

    const BATCH_SIZE = 1000;
    const LEGACY_SETTLEMENT_REASON_PREFIX = 'Legacy membership import';

    // Ensure re-importing the same legacy file doesn't keep duplicating settlement rows.
    await InternalSettlement.deleteMany({
      reason: { $regex: `^${LEGACY_SETTLEMENT_REASON_PREFIX}` },
    });

    // 1) Branches (by name)
    const branchNames = new Set();
    const branchMeta = new Map(); // normName -> { name, address?, zipCode? }
    for (const r of rows) {
      const name = String(r.branch || r.sold_at || r.soldAt || '').trim();
      if (name) {
        branchNames.add(name);
        const norm = normalizeBranchName(name);
        if (norm && !branchMeta.has(norm)) {
          const address = String(r.street_address || r.address || '').trim() || undefined;
          const zipCode = parseZipCode(address);
          branchMeta.set(norm, { name, address, zipCode });
        }
      }
    }
    const existingBranches = await Branch.find({ name: { $in: Array.from(branchNames) } }).select('_id name').lean();
    const branchIdByNorm = new Map(existingBranches.map((b) => [normalizeBranchName(b.name), b._id]));
    const newBranchOps = [];
    for (const n of branchNames) {
      const norm = normalizeBranchName(n);
      if (!norm || branchIdByNorm.has(norm)) continue;
      const meta = branchMeta.get(norm) || { name: n };
      newBranchOps.push({ insertOne: { document: { name: meta.name, address: meta.address, zipCode: meta.zipCode, isActive: true } } });
    }
    if (newBranchOps.length) {
      await Branch.collection.bulkWrite(newBranchOps, { ordered: false });
      const refreshed = await Branch.find({ name: { $in: Array.from(branchNames) } }).select('_id name').lean();
      refreshed.forEach((b) => branchIdByNorm.set(normalizeBranchName(b.name), b._id));
    }

    // Backfill address/zip for existing branches when missing (best-effort from file).
    const existingBranchDocs = await Branch.find({ _id: { $in: Array.from(branchIdByNorm.values()) } }).select('_id name address zipCode').lean();
    const branchUpdateOps = [];
    for (const b of existingBranchDocs) {
      const norm = normalizeBranchName(b.name);
      const meta = branchMeta.get(norm);
      if (!meta) continue;
      const needsAddress = !b.address && meta.address;
      const needsZip = !b.zipCode && meta.zipCode;
      if (!needsAddress && !needsZip) continue;
      branchUpdateOps.push({
        updateOne: {
          filter: { _id: b._id },
          update: { $set: { ...(needsAddress ? { address: meta.address } : {}), ...(needsZip ? { zipCode: meta.zipCode } : {}) } },
        },
      });
    }
    if (branchUpdateOps.length) await Branch.collection.bulkWrite(branchUpdateOps, { ordered: false });

    // 2) Packages (by name)
    const pkgNameSet = new Set();
    for (const r of rows) {
      const pkgName = String(r.package_name || r.packageName || '').trim();
      if (pkgName) pkgNameSet.add(pkgName);
    }
    const pkgNames = Array.from(pkgNameSet);
    const existingPkgs = await Package.find({ name: { $in: pkgNames } }).select('_id name').lean();
    const existingPkgSet = new Set(existingPkgs.map((p) => p.name));
    const pkgOps = [];
    for (const r of rows) {
      const name = String(r.package_name || r.packageName || '').trim();
      if (!name || existingPkgSet.has(name)) continue;
      const price = toNumber(r.price || r.package_price || r.packagePrice, 0);
      const discountAmount = Math.max(0, toNumber(r.discount || r.discountAmount, 0));
      const totalSessions = Math.max(1, toNumber(r.total_sessions || r.totalSessions || r.totalCredits, 1));
      pkgOps.push({
        updateOne: {
          filter: { name },
          update: { $set: { name, price, discountAmount, totalSessions, isActive: true } },
          upsert: true,
        },
      });
      existingPkgSet.add(name);
    }
    if (pkgOps.length) await Package.collection.bulkWrite(pkgOps, { ordered: false });

    // 3) Customers by phone (bulk upsert)
    const legacyIdMap = {};
    let customersImported = 0;
    let customersUpdated = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const ops = [];
      const phoneToLegacyId = new Map();
      const phones = [];

      for (const r of batch) {
        const legacyId = String(r.customer_id || r.customerId || r.id || '').trim();
        const name = String(r.customer_name || r.name || r.customer || '').trim();
        const phone = cleanPhone(r.contact || r.phone || r.mobile || r.phoneNumber || r.contact_no);
        const emailRaw = String(r.email || '').trim();
        const email = emailRaw ? emailRaw.toLowerCase() : undefined;
        if (!name || !phone) continue;

        const membershipCardId = legacyId || undefined;
        const branchName = String(r.branch || r.primaryBranch || '').trim();
        const primaryBranchId = branchName ? branchIdByNorm.get(normalizeBranchName(branchName)) : undefined;
        const notesParts = [];
        if (r.street_address) notesParts.push(`Address: ${String(r.street_address).trim()}`);
        else if (r.address) notesParts.push(`Address: ${String(r.address).trim()}`);
        const notes = notesParts.length ? notesParts.join('\n') : undefined;

        ops.push({
          updateOne: {
            filter: { phone },
            update: {
              $set: {
                name,
                phone,
                ...(email ? { email } : {}),
                ...(membershipCardId ? { membershipCardId } : {}),
                ...(notes ? { notes } : {}),
                ...(primaryBranchId ? { primaryBranchId } : {}),
              },
            },
            upsert: true,
          },
        });
        phones.push(phone);
        if (legacyId) phoneToLegacyId.set(phone, legacyId);
      }

      if (ops.length === 0) continue;
      const existingPhones = await Customer.distinct('phone', { phone: { $in: phones } });
      const existingSet = new Set(existingPhones);

      await Customer.collection.bulkWrite(ops, { ordered: false });
      customersImported += phones.filter((p) => !existingSet.has(p)).length;
      customersUpdated += phones.filter((p) => existingSet.has(p)).length;

      const docs = await Customer.find({ phone: { $in: phones } }).select('_id phone').lean();
      for (const d of docs) {
        const legacyId = phoneToLegacyId.get(d.phone);
        if (legacyId) legacyIdMap[String(legacyId)] = String(d._id);
      }
    }

    // 4) Memberships (upsert)
    const defaultTypeId = await getDefaultMembershipTypeId();
    let membershipsUpserted = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const ops = [];
      const legacyInternalSettlementDocs = [];

      for (const r of batch) {
        const legacyCustomerId = String(r.customer_id || '').trim();
        const customerIdStr = legacyCustomerId ? legacyIdMap[legacyCustomerId] : null;
        if (!customerIdStr || !mongoose.Types.ObjectId.isValid(customerIdStr)) continue;
        const customerId = new mongoose.Types.ObjectId(customerIdStr);

        const pkgName = String(r.package_name || '').trim();
        if (!pkgName) continue;

        const totalCredits = Math.max(1, toNumber(r.total_sessions, 1));
        const usedCredits = Math.max(0, toNumber(r.used_sessions, 0));
        const remainingCredits = toNumber(r.remaining_sessions, totalCredits - usedCredits);

        const branchName = String(r.branch || '').trim();
        const soldAtBranchId = branchName ? branchIdByNorm.get(normalizeBranchName(branchName)) : null;
        if (!soldAtBranchId) continue;

        const purchaseDateStr = String(r.created_at || '').trim();
        const purchaseDate = purchaseDateStr ? new Date(purchaseDateStr.replace(' ', 'T') + 'Z') : new Date();
        const price = toNumber(r.price, 0);
        const discountAmount = Math.max(0, toNumber(r.discount, 0));
        const settlementAmount = r.settlement_amount != null || r.settlementAmount != null
          ? Math.max(0, toNumber(r.settlement_amount ?? r.settlementAmount, 0))
          : undefined;

        const cappedUsed = Math.min(usedCredits, totalCredits);

        // Optional legacy status override (we still keep the computed fallback based on credits).
        // Expected legacy values might be numeric (0/1/2) or strings (active/used/expired).
        const legacyStatusRaw = r.status ?? r.membership_status ?? r.membershipStatus;
        const computedStatus = (cappedUsed >= totalCredits) ? 'used' : (remainingCredits <= 0 ? 'used' : 'active');
        let importedStatus;
        if (legacyStatusRaw != null && legacyStatusRaw !== '') {
          if (typeof legacyStatusRaw === 'number' || /^[0-9]+$/.test(String(legacyStatusRaw))) {
            const n = Number(legacyStatusRaw);
            importedStatus = n === 0 ? 'active' : (n === 1 ? 'used' : (n === 2 ? 'expired' : undefined));
          } else {
            const s = String(legacyStatusRaw).trim().toLowerCase();
            importedStatus = (s === 'active' || s === 'used' || s === 'expired') ? s : undefined;
          }
        }
        const status = importedStatus ?? computedStatus;

        ops.push({
          updateOne: {
            filter: { customerId, packageName: pkgName, purchaseDate },
            update: {
              $set: {
                customerId,
                membershipTypeId: defaultTypeId,
                totalCredits,
                usedCredits: cappedUsed,
                soldAtBranchId,
                purchaseDate,
                status,
                packageName: pkgName,
                packagePrice: price,
                discountAmount,
                ...(typeof settlementAmount === 'number' ? { settlementAmount } : {}),
              },
            },
            upsert: true,
          },
        });

        // Legacy exports also contain settlement_amount + used_sessions, but the app's
        // Settlement page reads from InternalSettlement. Create InternalSettlement docs
        // so the settlement UI reflects the imported data.
        if (
          typeof settlementAmount === 'number'
          && Number.isFinite(settlementAmount)
          && cappedUsed > 0
          && soldAtBranchId
        ) {
          const amount = round2(settlementAmount * cappedUsed);
          if (amount > 0) {
            legacyInternalSettlementDocs.push({
              fromBranchId: soldAtBranchId,
              toBranchId: soldAtBranchId,
              amount,
              reason: `${LEGACY_SETTLEMENT_REASON_PREFIX}: ${r.membership_id || r.membershipId || 'membership'} - ${pkgName} - ${cappedUsed} credit(s)`,
              status: 'pending',
            });
          }
        }
      }

      if (ops.length) {
        const result = await Membership.collection.bulkWrite(ops, { ordered: false });
        membershipsUpserted += (result.upsertedCount || 0) + (result.modifiedCount || 0);
      }

      if (legacyInternalSettlementDocs.length) {
        await InternalSettlement.collection.insertMany(legacyInternalSettlementDocs, { ordered: false });
      }
    }

    return res.json({
      success: true,
      customers: { imported: customersImported, updated: customersUpdated },
      packages: { upserted: pkgOps.length || 0 },
      branches: { ensured: branchNames.size },
      memberships: { upserted: membershipsUpserted },
      legacyIdMap,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to import legacy data.' });
  }
});

/**
 * POST /api/settings/reset-data
 * Admin-only: deletes ALL operational data but keeps Admin user(s), Branches, Membership Types, and Packages.
 * Also keeps Services, Lead Statuses, Settings, Guidelines (config-like data).
 */
router.post('/reset-data', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only.' });
    const settingsDoc = await Settings.findOne().lean();
    if (settingsDoc?.showResetAllDataButtonToAdmin !== true) {
      return res.status(403).json({ success: false, message: 'Reset is disabled in Settings.' });
    }
    const { confirm } = req.body || {};
    if (confirm !== 'RESET_ALL_DATA') {
      return res.status(400).json({ success: false, message: 'Confirmation required.' });
    }

    const [
      appointments,
      memberships,
      usages,
      customers,
      leads,
      tickets,
      salesImages,
      manualSales,
      loyaltyAccounts,
      loyaltyTxns,
      settlements,
      auditLogs,
      nonAdminUsers,
    ] = await Promise.all([
      Appointment.deleteMany({}),
      Membership.deleteMany({}),
      MembershipUsage.deleteMany({}),
      Customer.deleteMany({}),
      Lead.deleteMany({}),
      Ticket.deleteMany({}),
      SalesImage.deleteMany({}),
      ManualSale.deleteMany({}),
      LoyaltyAccount.deleteMany({}),
      LoyaltyTransaction.deleteMany({}),
      InternalSettlement.deleteMany({}),
      AuditLog.deleteMany({}),
      User.deleteMany({ role: { $ne: 'admin' } }),
    ]);

    return res.json({
      success: true,
      deleted: {
        appointments: appointments.deletedCount ?? 0,
        memberships: memberships.deletedCount ?? 0,
        membershipUsages: usages.deletedCount ?? 0,
        customers: customers.deletedCount ?? 0,
        leads: leads.deletedCount ?? 0,
        tickets: tickets.deletedCount ?? 0,
        salesImages: salesImages.deletedCount ?? 0,
        manualSales: manualSales.deletedCount ?? 0,
        loyaltyAccounts: loyaltyAccounts.deletedCount ?? 0,
        loyaltyTransactions: loyaltyTxns.deletedCount ?? 0,
        internalSettlements: settlements.deletedCount ?? 0,
        auditLogs: auditLogs.deletedCount ?? 0,
        nonAdminUsers: nonAdminUsers.deletedCount ?? 0,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to reset data.' });
  }
});

/** GET /api/settings - get system settings (admin only) */
router.get('/', async (req, res) => {
  try {
    let doc = await Settings.findOne().lean();
    if (!doc) {
      doc = await Settings.create({});
      doc = doc.toObject();
    }
    if (req.user.role === 'admin') {
      return res.json({
        success: true,
        settings: {
          revenuePercentage: doc.revenuePercentage ?? 10,
          settlementPercentage: doc.settlementPercentage ?? 100,
          showGuidelinesInVendorDashboard: doc.showGuidelinesInVendorDashboard !== false,
          showNotificationBellToVendors: doc.showNotificationBellToVendors !== false,
          showNotificationAppointments: doc.showNotificationAppointments !== false,
          showNotificationSettlements: doc.showNotificationSettlements !== false,
          showNotificationTickets: doc.showNotificationTickets !== false,
          showNotificationComments: doc.showNotificationComments !== false,
          showNotificationSalesData: doc.showNotificationSalesData !== false,
          showNotificationBellToAdmins: doc.showNotificationBellToAdmins !== false,
          showAdminNotificationAppointments: doc.showAdminNotificationAppointments !== false,
          showAdminNotificationSettlements: doc.showAdminNotificationSettlements !== false,
          showAdminNotificationTickets: doc.showAdminNotificationTickets !== false,
          showAdminNotificationComments: doc.showAdminNotificationComments !== false,
          showAdminNotificationSalesData: doc.showAdminNotificationSalesData !== false,
          showImportButton: doc.showImportButton !== false,
          showCustomerDeleteToAdmin: doc.showCustomerDeleteToAdmin !== false,
          showCustomerDeleteToVendor: doc.showCustomerDeleteToVendor !== false,
          showCustomerDeleteToStaff: doc.showCustomerDeleteToStaff !== false,
          showDeleteAllCustomersButtonToAdmin: doc.showDeleteAllCustomersButtonToAdmin === true,
          showResetAllDataButtonToAdmin: doc.showResetAllDataButtonToAdmin === true,
          showBulkDeleteBranchesToAdmin: doc.showBulkDeleteBranchesToAdmin === true,
          showBulkDeletePackagesToAdmin: doc.showBulkDeletePackagesToAdmin === true,
          showBulkDeleteMembershipsToAdmin: doc.showBulkDeleteMembershipsToAdmin === true,
          showBulkSettleSettlementsToAdmin: doc.showBulkSettleSettlementsToAdmin === true,
          showPackageActionsToVendor: doc.showPackageActionsToVendor === true,
        },
      });
    }
    // Non-admin: only return fields they are allowed to see (vendor experience + notification bell + import)
    return res.json({
      success: true,
      settings: {
        showGuidelinesInVendorDashboard: doc.showGuidelinesInVendorDashboard !== false,
        showNotificationBellToVendors: doc.showNotificationBellToVendors !== false,
        showNotificationAppointments: doc.showNotificationAppointments !== false,
        showNotificationSettlements: doc.showNotificationSettlements !== false,
        showNotificationTickets: doc.showNotificationTickets !== false,
        showNotificationComments: doc.showNotificationComments !== false,
        showNotificationSalesData: doc.showNotificationSalesData !== false,
        showImportButton: doc.showImportButton !== false,
        showCustomerDeleteToAdmin: doc.showCustomerDeleteToAdmin !== false,
        showCustomerDeleteToVendor: doc.showCustomerDeleteToVendor !== false,
        showCustomerDeleteToStaff: doc.showCustomerDeleteToStaff !== false,
        showDeleteAllCustomersButtonToAdmin: doc.showDeleteAllCustomersButtonToAdmin === true,
        showResetAllDataButtonToAdmin: doc.showResetAllDataButtonToAdmin === true,
        showBulkDeleteBranchesToAdmin: doc.showBulkDeleteBranchesToAdmin === true,
        showBulkDeletePackagesToAdmin: doc.showBulkDeletePackagesToAdmin === true,
        showBulkDeleteMembershipsToAdmin: doc.showBulkDeleteMembershipsToAdmin === true,
        showBulkSettleSettlementsToAdmin: doc.showBulkSettleSettlementsToAdmin === true,
        showPackageActionsToVendor: doc.showPackageActionsToVendor === true,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch settings.' });
  }
});

/** PATCH /api/settings - update system settings (admin only) */
router.patch('/', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only.' });
    }
    const {
      revenuePercentage,
      settlementPercentage,
      showGuidelinesInVendorDashboard,
      showNotificationBellToVendors,
      showNotificationAppointments,
      showNotificationSettlements,
      showNotificationTickets,
      showNotificationComments,
      showNotificationSalesData,
      showNotificationBellToAdmins,
      showAdminNotificationAppointments,
      showAdminNotificationSettlements,
      showAdminNotificationTickets,
      showAdminNotificationComments,
      showAdminNotificationSalesData,
      showImportButton,
      showCustomerDeleteToAdmin,
      showCustomerDeleteToVendor,
      showCustomerDeleteToStaff,
      showDeleteAllCustomersButtonToAdmin,
      showResetAllDataButtonToAdmin,
      showBulkDeleteBranchesToAdmin,
      showBulkDeletePackagesToAdmin,
      showBulkDeleteMembershipsToAdmin,
      showBulkSettleSettlementsToAdmin,
      showPackageActionsToVendor,
    } = req.body;
    const update = {};
    if (typeof revenuePercentage === 'number' && revenuePercentage >= 0 && revenuePercentage <= 100) {
      update.revenuePercentage = revenuePercentage;
    } else if (typeof revenuePercentage === 'string') {
      const n = parseFloat(revenuePercentage);
      if (!Number.isNaN(n) && n >= 0 && n <= 100) update.revenuePercentage = n;
    }
    if (typeof settlementPercentage === 'number' && settlementPercentage >= 0 && settlementPercentage <= 100) {
      update.settlementPercentage = settlementPercentage;
    } else if (typeof settlementPercentage === 'string') {
      const n = parseFloat(settlementPercentage);
      if (!Number.isNaN(n) && n >= 0 && n <= 100) update.settlementPercentage = n;
    }
    if (typeof showGuidelinesInVendorDashboard === 'boolean') {
      update.showGuidelinesInVendorDashboard = showGuidelinesInVendorDashboard;
    }
    if (typeof showNotificationBellToVendors === 'boolean') {
      update.showNotificationBellToVendors = showNotificationBellToVendors;
    }
    if (typeof showNotificationAppointments === 'boolean') {
      update.showNotificationAppointments = showNotificationAppointments;
    }
    if (typeof showNotificationSettlements === 'boolean') {
      update.showNotificationSettlements = showNotificationSettlements;
    }
    if (typeof showNotificationTickets === 'boolean') {
      update.showNotificationTickets = showNotificationTickets;
    }
    if (typeof showNotificationComments === 'boolean') {
      update.showNotificationComments = showNotificationComments;
    }
    if (typeof showNotificationSalesData === 'boolean') {
      update.showNotificationSalesData = showNotificationSalesData;
    }
    if (typeof showNotificationBellToAdmins === 'boolean') {
      update.showNotificationBellToAdmins = showNotificationBellToAdmins;
    }
    if (typeof showAdminNotificationAppointments === 'boolean') {
      update.showAdminNotificationAppointments = showAdminNotificationAppointments;
    }
    if (typeof showAdminNotificationSettlements === 'boolean') {
      update.showAdminNotificationSettlements = showAdminNotificationSettlements;
    }
    if (typeof showAdminNotificationTickets === 'boolean') {
      update.showAdminNotificationTickets = showAdminNotificationTickets;
    }
    if (typeof showAdminNotificationComments === 'boolean') {
      update.showAdminNotificationComments = showAdminNotificationComments;
    }
    if (typeof showAdminNotificationSalesData === 'boolean') {
      update.showAdminNotificationSalesData = showAdminNotificationSalesData;
    }
    if (typeof showImportButton === 'boolean') {
      update.showImportButton = showImportButton;
    }
    if (typeof showCustomerDeleteToAdmin === 'boolean') {
      update.showCustomerDeleteToAdmin = showCustomerDeleteToAdmin;
    }
    if (typeof showCustomerDeleteToVendor === 'boolean') {
      update.showCustomerDeleteToVendor = showCustomerDeleteToVendor;
    }
    if (typeof showCustomerDeleteToStaff === 'boolean') {
      update.showCustomerDeleteToStaff = showCustomerDeleteToStaff;
    }
    if (typeof showDeleteAllCustomersButtonToAdmin === 'boolean') {
      update.showDeleteAllCustomersButtonToAdmin = showDeleteAllCustomersButtonToAdmin;
    }
    if (typeof showResetAllDataButtonToAdmin === 'boolean') {
      update.showResetAllDataButtonToAdmin = showResetAllDataButtonToAdmin;
    }
    if (typeof showBulkDeleteBranchesToAdmin === 'boolean') {
      update.showBulkDeleteBranchesToAdmin = showBulkDeleteBranchesToAdmin;
    }
    if (typeof showBulkDeletePackagesToAdmin === 'boolean') {
      update.showBulkDeletePackagesToAdmin = showBulkDeletePackagesToAdmin;
    }
    if (typeof showBulkDeleteMembershipsToAdmin === 'boolean') {
      update.showBulkDeleteMembershipsToAdmin = showBulkDeleteMembershipsToAdmin;
    }
    if (typeof showBulkSettleSettlementsToAdmin === 'boolean') {
      update.showBulkSettleSettlementsToAdmin = showBulkSettleSettlementsToAdmin;
    }
    if (typeof showPackageActionsToVendor === 'boolean') {
      update.showPackageActionsToVendor = showPackageActionsToVendor;
    }
    const doc = await Settings.findOneAndUpdate(
      {},
      { $set: update },
      { new: true, upsert: true }
    ).lean();
    res.json({
      success: true,
      settings: {
        revenuePercentage: doc.revenuePercentage ?? 10,
        settlementPercentage: doc.settlementPercentage ?? 100,
        showGuidelinesInVendorDashboard: doc.showGuidelinesInVendorDashboard !== false,
        showNotificationBellToVendors: doc.showNotificationBellToVendors !== false,
        showNotificationAppointments: doc.showNotificationAppointments !== false,
        showNotificationSettlements: doc.showNotificationSettlements !== false,
        showNotificationTickets: doc.showNotificationTickets !== false,
        showNotificationComments: doc.showNotificationComments !== false,
        showNotificationSalesData: doc.showNotificationSalesData !== false,
        showNotificationBellToAdmins: doc.showNotificationBellToAdmins !== false,
        showAdminNotificationAppointments: doc.showAdminNotificationAppointments !== false,
        showAdminNotificationSettlements: doc.showAdminNotificationSettlements !== false,
        showAdminNotificationTickets: doc.showAdminNotificationTickets !== false,
        showAdminNotificationComments: doc.showAdminNotificationComments !== false,
        showAdminNotificationSalesData: doc.showAdminNotificationSalesData !== false,
        showImportButton: doc.showImportButton !== false,
        showCustomerDeleteToAdmin: doc.showCustomerDeleteToAdmin !== false,
        showCustomerDeleteToVendor: doc.showCustomerDeleteToVendor !== false,
        showCustomerDeleteToStaff: doc.showCustomerDeleteToStaff !== false,
        showDeleteAllCustomersButtonToAdmin: doc.showDeleteAllCustomersButtonToAdmin === true,
        showResetAllDataButtonToAdmin: doc.showResetAllDataButtonToAdmin === true,
        showBulkDeleteBranchesToAdmin: doc.showBulkDeleteBranchesToAdmin === true,
        showBulkDeletePackagesToAdmin: doc.showBulkDeletePackagesToAdmin === true,
        showBulkDeleteMembershipsToAdmin: doc.showBulkDeleteMembershipsToAdmin === true,
        showBulkSettleSettlementsToAdmin: doc.showBulkSettleSettlementsToAdmin === true,
        showPackageActionsToVendor: doc.showPackageActionsToVendor === true,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update settings.' });
  }
});

module.exports = router;
