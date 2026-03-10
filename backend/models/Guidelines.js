const mongoose = require('mongoose');

/** Single-document guidelines content (HTML). */
const guidelinesSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Guidelines', guidelinesSchema);
