const express = require('express');
const Guidelines = require('../models/Guidelines');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

/** GET /api/guidelines - get guidelines content (all authenticated users) */
router.get('/', async (req, res) => {
  try {
    let doc = await Guidelines.findOne().lean();
    if (!doc) {
      doc = await Guidelines.create({ content: '' });
      doc = doc.toObject();
    }
    res.json({
      success: true,
      content: doc.content ?? '',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch guidelines.' });
  }
});

/** PATCH /api/guidelines - update guidelines content (admin only) */
router.patch('/', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only.' });
    }
    const { content } = req.body;
    const contentStr = typeof content === 'string' ? content : '';
    const doc = await Guidelines.findOneAndUpdate(
      {},
      { $set: { content: contentStr } },
      { new: true, upsert: true }
    ).lean();
    res.json({
      success: true,
      content: doc.content ?? '',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update guidelines.' });
  }
});

module.exports = router;
