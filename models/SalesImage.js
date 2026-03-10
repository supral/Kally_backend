const mongoose = require('mongoose');

const salesImageSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    date: { type: Date, required: true },
    /** @deprecated Use imageBase64s. Kept for backward compatibility. */
    imageBase64: { type: String, default: null },
    /** Array of base64 image strings. Supports multiple images per receipt. */
    imageBase64s: { type: [String], default: [] },
    /** Manual sales count for this day (local record). When set, used instead of computed count. */
    manualSalesCount: { type: Number, default: null, min: 0 },
    /** Daily sales amount (revenue) for this day. */
    salesAmount: { type: Number, default: null, min: 0 },
  },
  { timestamps: true }
);

salesImageSchema.index({ branchId: 1, date: -1 });
salesImageSchema.index({ createdAt: 1 });

module.exports = mongoose.model('SalesImage', salesImageSchema);
