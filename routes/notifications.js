const express = require('express');
const { protect } = require('../middleware/auth');
const { getBranchId } = require('../middleware/branchFilter');

const Appointment = require('../models/Appointment');
const InternalSettlement = require('../models/InternalSettlement');
const Ticket = require('../models/Ticket');
const SalesImage = require('../models/SalesImage');

const router = express.Router();

const RETENTION_DAYS = 7;

router.use(protect);

function parseDateParam(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

function getRetentionCutoff() {
  // Notifications should respect the same retention window as the Sales Images list UI.
  // Sales Images purge uses `createdAt`, so we filter by `createdAt` here too.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  cutoff.setHours(0, 0, 0, 0);
  return cutoff;
}

function getVendorBranchFilterForTickets(reqUser) {
  const bid = getBranchId(reqUser);
  const isAdmin = reqUser.role === 'admin';

  let filter = { status: 'open' };
  if (!isAdmin && bid) {
    filter.$or = [
      { createdByBranchId: bid },
      { targetBranchId: bid },
      { targetBranchId: null, createdByBranchId: null },
    ];
  }
  return filter;
}

function getVendorBranchFilterForSettlements(reqUser) {
  const bid = getBranchId(reqUser);
  const filter = {};
  if (bid && reqUser.role !== 'admin') {
    filter.$or = [{ fromBranchId: bid }, { toBranchId: bid }];
  }
  return filter;
}

/**
 * GET /api/notifications/summary
 * Returns lightweight counts + small previews for the top navigation bell.
 */
router.get('/summary', async (req, res) => {
  try {
    const from = parseDateParam(req.query.from);
    const to = parseDateParam(req.query.to);
    const fromDate = from ?? new Date(new Date().setDate(new Date().getDate() - 7));
    const toDate = to ?? new Date();

    const bid = getBranchId(req.user);
    const isAdmin = req.user.role === 'admin';

    // 1) Upcoming appointments preview (top 10, excluding cancelled/completed)
    const appointmentFilter = {};
    if (!isAdmin && bid) appointmentFilter.branchId = bid;
    if (!isAdmin && !bid) appointmentFilter.branchId = null; // matches nothing
    appointmentFilter.scheduledAt = { $gte: fromDate, $lte: toDate };
    appointmentFilter.status = { $nin: ['cancelled', 'completed'] };

    const upcomingAppointments = await Appointment.find(appointmentFilter)
      .populate('customerId', 'name phone')
      .populate('serviceId', 'name')
      .sort({ scheduledAt: 1 })
      .limit(10)
      .lean();

    const appointmentsPreview = upcomingAppointments.map((a) => ({
      id: a._id,
      customer: a.customerId
        ? {
            id: a.customerId._id,
            name: a.customerId.name,
            phone: a.customerId.phone,
          }
        : null,
      service: a.serviceId?.name,
      scheduledAt: a.scheduledAt,
      status: a.status,
    }));

    // 2) Pending settlements count
    const settlementFilter = getVendorBranchFilterForSettlements(req.user);
    settlementFilter.status = 'pending';
    const pendingSettlementsCount = await InternalSettlement.countDocuments(settlementFilter);

    // 3) Tickets open count + tickets-with-replies count
    const ticketFilter = getVendorBranchFilterForTickets(req.user);
    const openTicketsCount = await Ticket.countDocuments(ticketFilter);
    const ticketsWithRepliesCount = await Ticket.countDocuments({
      ...ticketFilter,
      'replies.0': { $exists: true },
    });

    // 4) Sales images count within retention window
    const cutoff = getRetentionCutoff();
    const salesImageFilter = { createdAt: { $gte: cutoff } };
    if (!isAdmin) {
      salesImageFilter.branchId = bid ?? null; // matches nothing if bid null
    }
    const salesImagesCount = await SalesImage.countDocuments(salesImageFilter);

    res.json({
      success: true,
      summary: {
        appointments: appointmentsPreview,
        pendingSettlementsCount,
        openTicketsCount,
        ticketsWithRepliesCount,
        salesImagesCount,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to build notifications summary.' });
  }
});

module.exports = router;

