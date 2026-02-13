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
    /** Membership renewal price (default $0). Used when vendor/admin renews an expired membership. */
    membershipRenewalCost: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
