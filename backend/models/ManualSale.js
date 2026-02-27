const mongoose = require('mongoose');

const manualSaleSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    date: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0 },
    /** Base64-encoded image data (data URL or raw base64) */
    imageBase64: { type: String },
  },
  { timestamps: true }
);

manualSaleSchema.index({ branchId: 1, date: 1 });

module.exports = mongoose.model('ManualSale', manualSaleSchema);
