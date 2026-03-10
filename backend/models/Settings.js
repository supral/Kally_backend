const mongoose = require('mongoose');

/** Single-document system settings (admin-configured). */
const settingsSchema = new mongoose.Schema(
  {
    revenuePercentage: {
      type: Number,
      default: 10,
      min: 0,
      max: 100,
    },
    settlementPercentage: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },
    /** When true, vendors see the Guidelines link in the sidebar and can open the Guidelines page. */
    showGuidelinesInVendorDashboard: {
      type: Boolean,
      default: true,
    },
    /** When true, vendors see the notification bell in the top bar. */
    showNotificationBellToVendors: {
      type: Boolean,
      default: true,
    },
    /** Which categories to show in the vendor notification dropdown (admin-controlled). */
    showNotificationAppointments: { type: Boolean, default: true },
    showNotificationSettlements: { type: Boolean, default: true },
    showNotificationTickets: { type: Boolean, default: true },
    showNotificationComments: { type: Boolean, default: true },
    showNotificationSalesData: { type: Boolean, default: true },
    /** When true, Import buttons (branches, packages, customers, memberships, appointments) are visible. */
    showImportButton: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
