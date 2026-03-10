const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    /** Discount amount (flat, not percentage). */
    discountAmount: { type: Number, default: 0, min: 0 },
    /** Number of sessions in this package. Default 1 for backward compatibility. */
    totalSessions: { type: Number, default: 1, min: 1 },
    /** Per-session settlement amount. Calculated: (price + discountAmount) / (2 * totalSessions). */
    settlementAmount: { type: Number, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

packageSchema.index({ name: 1 });
packageSchema.index({ isActive: 1 });

module.exports = mongoose.model('Package', packageSchema);
