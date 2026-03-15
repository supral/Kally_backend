const mongoose = require('mongoose');

const membershipSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    membershipTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'MembershipType', required: true },
    totalCredits: { type: Number, required: true, min: 1 },
    usedCredits: { type: Number, default: 0, min: 0 },
    soldAtBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    purchaseDate: { type: Date, default: Date.now },
    expiryDate: { type: Date },
    status: { type: String, enum: ['active', 'expired', 'used'], default: 'active' },
    packagePrice: { type: Number },
    discountAmount: { type: Number, default: 0, min: 0 },
    packageName: { type: String },
    /** Per-credit settlement amount when used at different branch. Overrides global percentage if set. */
    settlementAmount: { type: Number, min: 0 },
  },
  { timestamps: true }
);

membershipSchema.index({ customerId: 1 });
membershipSchema.index({ customerId: 1, status: 1 });
membershipSchema.index({ soldAtBranchId: 1 });
membershipSchema.index({ soldAtBranchId: 1, purchaseDate: 1 });
membershipSchema.index({ status: 1, soldAtBranchId: 1 });
membershipSchema.index({ soldAtBranchId: 1, status: 1, expiryDate: 1 });

module.exports = mongoose.model('Membership', membershipSchema);
