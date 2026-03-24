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

    /** When true, admins see the notification bell in the top bar. */
    showNotificationBellToAdmins: {
      type: Boolean,
      default: true,
    },
    /** Which categories to show in the admin notification dropdown (admin-controlled). */
    showAdminNotificationAppointments: { type: Boolean, default: true },
    showAdminNotificationSettlements: { type: Boolean, default: true },
    showAdminNotificationTickets: { type: Boolean, default: true },
    showAdminNotificationComments: { type: Boolean, default: true },
    showAdminNotificationSalesData: { type: Boolean, default: true },

    /** When true, Import buttons (branches, packages, customers, memberships, appointments) are visible. */
    showImportButton: {
      type: Boolean,
      default: true,
    },
    /** When true, Admin sees the delete button(s) on the Customers page. */
    showCustomerDeleteToAdmin: { type: Boolean, default: true },
    /** When true, Vendor sees the delete button(s) on the Customers page. */
    showCustomerDeleteToVendor: { type: Boolean, default: true },
    /** When true, Staff sees the delete button(s) on the Customers page. */
    showCustomerDeleteToStaff: { type: Boolean, default: true },
    /** When true, Admin sees the "Delete all customers" button (dangerous). */
    showDeleteAllCustomersButtonToAdmin: { type: Boolean, default: false },
    /** When true, Admin sees the "Reset all data" button (dangerous). */
    showResetAllDataButtonToAdmin: { type: Boolean, default: false },
    /** When true, Admin sees bulk delete controls on Branches page. */
    showBulkDeleteBranchesToAdmin: { type: Boolean, default: false },
    /** When true, Admin sees bulk delete controls on Packages page. */
    showBulkDeletePackagesToAdmin: { type: Boolean, default: false },
    /** When true, Admin sees bulk delete controls on Memberships page. */
    showBulkDeleteMembershipsToAdmin: { type: Boolean, default: false },
    /** When true, Admin sees bulk select + mark settled controls on Settlements page. */
    showBulkSettleSettlementsToAdmin: { type: Boolean, default: false },
    /** When true, Vendor/Staff see Edit, Activate, Inactive, Delete buttons on the Packages page. */
    showPackageActionsToVendor: { type: Boolean, default: false },
    /** When true, Vendor/Staff can edit and delete memberships. */
    showMembershipActionsToVendor: { type: Boolean, default: false },
    /** When true, Vendor/Staff can see and use edit/delete actions across dashboard pages. */
    showEditDeleteActionsToVendor: { type: Boolean, default: false },
    /** Service-specific override. When true, Vendor/Staff can add/edit/delete services. */
    showServiceActionsToVendor: { type: Boolean },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
