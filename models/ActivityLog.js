const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    /** When set, vendor/staff can see this activity if it matches their branch (vendor-related). */
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    description: { type: String, required: true },
    entity: { type: String },
    entityId: { type: mongoose.Schema.Types.Mixed },
    details: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ branchId: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
