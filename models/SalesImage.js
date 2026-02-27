const mongoose = require('mongoose');

const salesImageSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    title: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    imageBase64: { type: String, required: true },
  },
  { timestamps: true }
);

salesImageSchema.index({ branchId: 1, date: -1 });
salesImageSchema.index({ createdAt: 1 });

module.exports = mongoose.model('SalesImage', salesImageSchema);
