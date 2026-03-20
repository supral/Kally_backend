const express = require('express');
const Customer = require('../models/Customer');
const Membership = require('../models/Membership');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/customers-memberships', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || String(q).trim().length < 2) {
      return res.json({ success: true, customers: [], memberships: [] });
    }
    const term = String(q).trim();
    // Normalize phone searches: allow "+", spaces, "-" etc by matching digits only.
    const digitsOnly = term.replace(/[^\d]/g, '');
    // If the user typed a card id like "tes-00001", don't treat it as a phone search.
    const looksLikePhone = digitsOnly.length >= 3 && !/[a-zA-Z]/.test(term);
    // Universal: all branches can search all customers and memberships
    const customerFilter = {};

    // Escape regex special chars to prevent ReDoS
    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const safePattern = escapeRegex(term);
    const makeDigitsRegex = (digits) => new RegExp(String(digits).split('').join('\\D*'), 'i');

    let customers = [];
    if (looksLikePhone) {
      const phoneRegex = makeDigitsRegex(digitsOnly);
      customers = await Customer.find({ ...customerFilter, phone: phoneRegex })
        .limit(20)
        .lean();
    } else {
      const rx = new RegExp(safePattern, 'i');
      customers = await Customer.find({
        ...customerFilter,
        $or: [
          { name: rx },
          { membershipCardId: rx },
          { email: rx },
        ],
      })
        .limit(20)
        .lean();
    }

    const customerIds = customers.map((c) => c._id);
    const memberships = await Membership.find({ customerId: { $in: customerIds }, status: 'active' })
      .populate('membershipTypeId', 'name totalCredits')
      .populate('soldAtBranchId', 'name')
      .lean();

    res.json({
      success: true,
      customers: customers.map((c) => ({
        id: c._id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        membershipCardId: c.membershipCardId,
      })),
      memberships: memberships.map((m) => ({
        id: m._id,
        customerId: m.customerId,
        typeName: m.membershipTypeId?.name,
        totalCredits: m.totalCredits,
        usedCredits: m.usedCredits,
        remainingCredits: m.totalCredits - m.usedCredits,
        soldAtBranch: m.soldAtBranchId?.name,
        expiryDate: m.expiryDate,
        status: m.status,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Search failed.' });
  }
});

module.exports = router;
