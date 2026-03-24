const express = require('express');
const Lead = require('../models/Lead');
const LeadStatus = require('../models/LeadStatus');
const Settings = require('../models/Settings');
const { protect, authorize } = require('../middleware/auth');
const { getBranchId, branchFilterForLead } = require('../middleware/branchFilter');
const { createActivityLog } = require('../utils/activityLog');
const { validateBulkIds } = require('../utils/validateBulkIds');

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
    const { valid, ids: objectIds, message } = validateBulkIds(req.body?.ids);
    if (!valid) return res.status(400).json({ success: false, message: message || 'Invalid ids.' });
    const result = await Lead.deleteMany({ _id: { $in: objectIds } });
    const deleted = result.deletedCount ?? 0;
    if (deleted > 0) {
      createActivityLog({
        userId: req.user._id,
        description: `Bulk deleted ${deleted} lead(s)`,
        entity: 'lead',
        details: { count: deleted },
      }).catch(() => {});
    }
    res.json({ success: true, deleted });
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
    createActivityLog({
      userId: req.user._id,
      branchId: l.branchId?._id || l.branchId,
      description: `Created lead: ${l.name}`,
      entity: 'lead',
      entityId: lead._id,
      details: { branch: l.branchId?.name, source: l.source, service: l.serviceId?.name },
    }).catch(() => {});
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
    if (req.user.role !== 'admin') {
      const settingsDoc = await Settings.findOne().lean();
      if (settingsDoc?.showEditDeleteActionsToVendor !== true) {
        return res.status(403).json({ success: false, message: 'Lead edit is disabled for staff in Settings.' });
      }
    }
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
    createActivityLog({
      userId: req.user._id,
      branchId: l.branchId?._id || l.branchId,
      description: `Updated lead: ${l.name}`,
      entity: 'lead',
      entityId: lead._id,
      details: { branch: l.branchId?.name, status: l.status },
    }).catch(() => {});
    res.json({ success: true, lead: { id: l._id, status: l.status, notes: l.notes, service: l.serviceId?.name, serviceId: l.serviceId?._id } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update lead.' });
  }
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id).populate('branchId', 'name').lean();
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found.' });
    await Lead.findByIdAndDelete(req.params.id);
    createActivityLog({
      userId: req.user._id,
      branchId: lead.branchId?._id || lead.branchId,
      description: `Deleted lead: ${lead.name}`,
      entity: 'lead',
      entityId: lead._id,
      details: { branch: lead.branchId?.name },
    }).catch(() => {});
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

    const l = await Lead.findById(lead._id).populate('branchId', 'name').lean();
    createActivityLog({
      userId: req.user._id,
      branchId: l.branchId?._id || l.branchId,
      description: `Added follow-up to lead: ${l.name}`,
      entity: 'lead',
      entityId: lead._id,
      details: { branch: l.branchId?.name },
    }).catch(() => {});
    res.json({ success: true, followUps: lead.followUps });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to add follow-up.' });
  }
});

module.exports = router;
