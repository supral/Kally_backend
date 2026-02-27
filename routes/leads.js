const express = require('express');
const Lead = require('../models/Lead');
const LeadStatus = require('../models/LeadStatus');
const { protect, authorize } = require('../middleware/auth');
const { getBranchId, branchFilterForLead } = require('../middleware/branchFilter');

const router = express.Router();

router.use(protect);

function leadFilter(req) {
  return branchFilterForLead(req.user);
}

const DEFAULT_LEADS_LIMIT = 200;
const MAX_LEADS_LIMIT = 500;

router.get('/', async (req, res) => {
  try {
    const { status, branchId, source, serviceId, search, from, to, limit: limitParam } = req.query;
    const filter = leadFilter(req);
    if (req.user.role === 'admin' && branchId) filter.branchId = branchId;
    if (status) filter.status = status;
    if (source) filter.source = source;
    if (serviceId) filter.serviceId = serviceId;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = toDate;
      }
    }
    if (search && String(search).trim()) {
      const term = String(search).trim();
      const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { name: re },
        { phone: re },
        { email: re },
      ];
    }

    const limit = Math.min(MAX_LEADS_LIMIT, Math.max(1, parseInt(limitParam, 10) || DEFAULT_LEADS_LIMIT));
    const leads = await Lead.find(filter)
      .populate('branchId', 'name')
      .populate('serviceId', 'name')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({
      success: true,
      leads: leads.map((l) => ({
        id: l._id,
        name: l.name,
        phone: l.phone,
        email: l.email,
        source: l.source,
        branch: l.branchId?.name,
        branchId: l.branchId?._id,
        service: l.serviceId?.name,
        serviceId: l.serviceId?._id,
        status: l.status,
        followUpsCount: l.followUps?.length || 0,
        notes: l.notes,
        createdAt: l.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch leads.' });
  }
});

router.post('/bulk-delete', authorize('admin'), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'ids array is required.' });
    }
    const result = await Lead.deleteMany({ _id: { $in: ids } });
    res.json({ success: true, deleted: result.deletedCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to delete leads.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, phone, email, source, branchId, serviceId, notes } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Lead name is required.' });
    const bid = getBranchId(req.user) || branchId;
    if (!bid) return res.status(400).json({ success: false, message: 'Branch is required.' });

    const lead = await Lead.create({
      name,
      phone: phone || undefined,
      email: email || undefined,
      source: source || 'other',
      branchId: bid,
      serviceId: serviceId || undefined,
      notes: notes || undefined,
    });

    const l = await Lead.findById(lead._id).populate('branchId', 'name').populate('serviceId', 'name').lean();
    res.status(201).json({
      success: true,
      lead: {
        id: l._id,
        name: l.name,
        phone: l.phone,
        email: l.email,
        source: l.source,
        branch: l.branchId?.name,
        branchId: l.branchId?._id,
        service: l.serviceId?.name,
        serviceId: l.serviceId?._id,
        status: l.status,
        createdAt: l.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create lead.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id).populate('branchId', 'name').populate('serviceId', 'name').lean();
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found.' });
    const filter = leadFilter(req);
    if (filter.branchId && String(lead.branchId?._id) !== String(filter.branchId))
      return res.status(404).json({ success: false, message: 'Lead not found.' });

    res.json({
      success: true,
      lead: {
        id: lead._id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        source: lead.source,
        branch: lead.branchId?.name,
        branchId: lead.branchId?._id,
        service: lead.serviceId?.name,
        serviceId: lead.serviceId?._id,
        status: lead.status,
        followUps: lead.followUps || [],
        notes: lead.notes,
        createdAt: lead.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch lead.' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found.' });
    const filter = leadFilter(req);
    if (filter.branchId && String(lead.branchId) !== String(filter.branchId))
      return res.status(404).json({ success: false, message: 'Lead not found.' });

    const { status, notes, serviceId } = req.body;
    if (serviceId !== undefined) lead.serviceId = serviceId || undefined;
    if (status !== undefined) {
      const statusNames = await LeadStatus.find({ isActive: true }).distinct('name');
      if (statusNames.length && !statusNames.includes(String(status).trim())) {
        return res.status(400).json({ success: false, message: `Status must be one of: ${statusNames.join(', ')}` });
      }
      lead.status = String(status).trim();
    }
    if (notes !== undefined) lead.notes = notes;
    await lead.save();

    const l = await Lead.findById(lead._id).populate('branchId', 'name').populate('serviceId', 'name').lean();
    res.json({ success: true, lead: { id: l._id, status: l.status, notes: l.notes, service: l.serviceId?.name, serviceId: l.serviceId?._id } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update lead.' });
  }
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to delete lead.' });
  }
});

router.post('/:id/follow-up', async (req, res) => {
  try {
    const { note } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found.' });
    const filter = leadFilter(req);
    if (filter.branchId && String(lead.branchId) !== String(filter.branchId))
      return res.status(404).json({ success: false, message: 'Lead not found.' });

    lead.followUps = lead.followUps || [];
    lead.followUps.push({ note: note || '', byUserId: req.user._id });
    await lead.save();

    res.json({ success: true, followUps: lead.followUps });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to add follow-up.' });
  }
});

module.exports = router;
