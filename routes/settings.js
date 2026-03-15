const express = require('express');
const Settings = require('../models/Settings');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Appointment = require('../models/Appointment');
const Membership = require('../models/Membership');
const MembershipUsage = require('../models/MembershipUsage');
const Lead = require('../models/Lead');
const Ticket = require('../models/Ticket');
const SalesImage = require('../models/SalesImage');
const ManualSale = require('../models/ManualSale');
const LoyaltyAccount = require('../models/LoyaltyAccount');
const LoyaltyTransaction = require('../models/LoyaltyTransaction');
const InternalSettlement = require('../models/InternalSettlement');
const AuditLog = require('../models/AuditLog');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

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
