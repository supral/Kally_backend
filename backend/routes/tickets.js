const express = require('express');
const Ticket = require('../models/Ticket');
const { protect, authorize } = require('../middleware/auth');
const { getBranchId } = require('../middleware/branchFilter');

const router = express.Router();

router.use(protect);

/** GET /api/tickets - list tickets. Admin: all. Vendor: tickets for their branch */
router.get('/', async (req, res) => {
  try {
    const bid = getBranchId(req.user);
    const isAdmin = req.user.role === 'admin';

    let filter = {};
    if (!isAdmin && bid) {
      filter.$or = [
        { createdByBranchId: bid },
        { targetBranchId: bid },
        { targetBranchId: null, createdByBranchId: null },
      ];
    }

    const tickets = await Ticket.find(filter)
      .populate('createdByUserId', 'name')
      .populate('createdByBranchId', 'name')
      .populate('targetBranchId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      tickets: tickets.map((t) => ({
        id: t._id,
        subject: t.subject,
        body: t.body,
        hasImage: Boolean(t.imageBase64),
        createdBy: t.createdByUserId?.name,
        createdByBranch: t.createdByBranchId?.name,
        targetBranch: t.targetBranchId?.name,
        status: t.status,
        replyCount: (t.replies || []).length,
        createdAt: t.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch tickets.' });
  }
});

/** POST /api/tickets - create ticket */
router.post('/', async (req, res) => {
  try {
    const { subject, body, targetBranchId, imageBase64 } = req.body;
    if (!subject || !String(subject).trim()) return res.status(400).json({ success: false, message: 'Subject is required.' });
    if (!body || !String(body).trim()) return res.status(400).json({ success: false, message: 'Message is required.' });

    const bid = getBranchId(req.user);
    const isAdmin = req.user.role === 'admin';

    const ticket = await Ticket.create({
      subject: String(subject).trim(),
      body: String(body).trim(),
      imageBase64: imageBase64 || undefined,
      createdByUserId: req.user._id,
      createdByBranchId: isAdmin ? undefined : bid,
      targetBranchId: isAdmin ? (targetBranchId || null) : null,
    });

    const t = await Ticket.findById(ticket._id)
      .populate('createdByUserId', 'name')
      .populate('createdByBranchId', 'name')
      .populate('targetBranchId', 'name')
      .lean();

    res.status(201).json({
      success: true,
      ticket: {
        id: t._id,
        subject: t.subject,
        body: t.body,
        createdBy: t.createdByUserId?.name,
        createdByBranch: t.createdByBranchId?.name,
        targetBranch: t.targetBranchId?.name,
        status: t.status,
        replyCount: 0,
        hasImage: Boolean(t.imageBase64),
        imageBase64: t.imageBase64,
        createdAt: t.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create ticket.' });
  }
});

/** GET /api/tickets/:id - get single ticket with replies */
router.get('/:id', async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('createdByUserId', 'name')
      .populate('createdByBranchId', 'name')
      .populate('targetBranchId', 'name')
      .populate('replies.userId', 'name')
      .populate('replies.branchId', 'name')
      .lean();

    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    const bid = getBranchId(req.user);
    const isAdmin = req.user.role === 'admin';
    const canAccess =
      isAdmin ||
      ticket.createdByBranchId?._id?.toString() === bid ||
      ticket.targetBranchId?._id?.toString() === bid ||
      (ticket.targetBranchId == null && bid);

    if (!canAccess) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    res.json({
      success: true,
      ticket: {
        id: ticket._id,
        subject: ticket.subject,
        body: ticket.body,
        imageBase64: ticket.imageBase64,
        createdBy: ticket.createdByUserId?.name,
        createdByBranch: ticket.createdByBranchId?.name,
        targetBranch: ticket.targetBranchId?.name,
        status: ticket.status,
        createdAt: ticket.createdAt,
        replies: (ticket.replies || []).map((r) => ({
          id: r._id,
          message: r.message,
          imageBase64: r.imageBase64,
          userName: r.userId?.name,
          branchName: r.branchId?.name,
          createdAt: r.createdAt,
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch ticket.' });
  }
});

/** POST /api/tickets/:id/reply - add reply */
router.post('/:id/reply', async (req, res) => {
  try {
    const { message, imageBase64 } = req.body;
    if (!message || !String(message).trim()) return res.status(400).json({ success: false, message: 'Message is required.' });

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    const bid = getBranchId(req.user);
    const isAdmin = req.user.role === 'admin';
    const canAccess =
      isAdmin ||
      String(ticket.createdByBranchId) === bid ||
      String(ticket.targetBranchId) === bid ||
      (ticket.targetBranchId == null && bid);

    if (!canAccess) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    ticket.replies = ticket.replies || [];
    ticket.replies.push({
      userId: req.user._id,
      branchId: isAdmin ? undefined : bid,
      message: String(message).trim(),
      imageBase64: imageBase64 || undefined,
    });
    await ticket.save();

    const t = await Ticket.findById(ticket._id)
      .populate('createdByUserId', 'name')
      .populate('createdByBranchId', 'name')
      .populate('targetBranchId', 'name')
      .populate('replies.userId', 'name')
      .populate('replies.branchId', 'name')
      .lean();

    res.json({
      success: true,
      ticket: {
        id: t._id,
        subject: t.subject,
        body: t.body,
        createdBy: t.createdByUserId?.name,
        createdByBranch: t.createdByBranchId?.name,
        targetBranch: t.targetBranchId?.name,
        status: t.status,
        createdAt: t.createdAt,
        replies: (t.replies || []).map((r) => ({
          id: r._id,
          message: r.message,
          imageBase64: r.imageBase64,
          userName: r.userId?.name,
          branchName: r.branchId?.name,
          createdAt: r.createdAt,
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to add reply.' });
  }
});

/** PATCH /api/tickets/:id - update status (open/closed) */
router.patch('/:id', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['open', 'closed'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid status.' });

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    const bid = getBranchId(req.user);
    const isAdmin = req.user.role === 'admin';
    const canAccess =
      isAdmin ||
      String(ticket.createdByBranchId) === bid ||
      String(ticket.targetBranchId) === bid ||
      (ticket.targetBranchId == null && bid);

    if (!canAccess) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    ticket.status = status;
    await ticket.save();

    res.json({ success: true, ticket: { id: ticket._id, status: ticket.status } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update ticket.' });
  }
});

module.exports = router;
