const mongoose = require('mongoose');

const replySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    message: { type: String, required: true, trim: true },
    imageBase64: { type: String },
  },
  { timestamps: true, _id: true }
);

const ticketSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    imageBase64: { type: String },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdByBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    targetBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    replies: [replySchema],
  },
  { timestamps: true }
);

ticketSchema.index({ createdByBranchId: 1, createdAt: -1 });
ticketSchema.index({ targetBranchId: 1, createdAt: -1 });
ticketSchema.index({ status: 1 });

module.exports = mongoose.model('Ticket', ticketSchema);
