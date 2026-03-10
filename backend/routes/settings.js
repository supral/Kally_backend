const express = require('express');
const Settings = require('../models/Settings');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

/** GET /api/settings - get system settings. Admin gets full settings; vendor gets only showGuidelinesInVendorDashboard. */
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
          showImportButton: doc.showImportButton !== false,
          showExportButton: doc.showExportButton !== false,
          showCustomerDeleteToAdmin: doc.showCustomerDeleteToAdmin !== false,
          showCustomerDeleteToVendor: doc.showCustomerDeleteToVendor !== false,
          showCustomerDeleteToStaff: doc.showCustomerDeleteToStaff !== false,
        },
      });
    }
    // Vendor/branch: only return fields they are allowed to see (sidebar + notification bell + import)
    res.json({
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
        showExportButton: doc.showExportButton !== false,
        showCustomerDeleteToAdmin: doc.showCustomerDeleteToAdmin !== false,
        showCustomerDeleteToVendor: doc.showCustomerDeleteToVendor !== false,
        showCustomerDeleteToStaff: doc.showCustomerDeleteToStaff !== false,
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
      showImportButton,
      showExportButton,
      showCustomerDeleteToAdmin,
      showCustomerDeleteToVendor,
      showCustomerDeleteToStaff,
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
    if (typeof showImportButton === 'boolean') {
      update.showImportButton = showImportButton;
    }
    if (typeof showExportButton === 'boolean') {
      update.showExportButton = showExportButton;
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
        showImportButton: doc.showImportButton !== false,
        showExportButton: doc.showExportButton !== false,
        showCustomerDeleteToAdmin: doc.showCustomerDeleteToAdmin !== false,
        showCustomerDeleteToVendor: doc.showCustomerDeleteToVendor !== false,
        showCustomerDeleteToStaff: doc.showCustomerDeleteToStaff !== false,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update settings.' });
  }
});

module.exports = router;
