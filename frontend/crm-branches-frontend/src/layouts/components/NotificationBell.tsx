import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../config/constants';
import { getSettings } from '../../api/settings';
import { getAppointments } from '../../api/appointments';
import { getSettlements } from '../../api/reports';
import { getTicketCount, getTickets } from '../../api/tickets';
import { getSalesImages } from '../../api/salesImages';
import type { Appointment } from '../../types/crm';

function BellIcon() {
  return (
    <svg className="notification-bell-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

const NOTIFICATION_SEEN_KEY = 'vendor_notification_seen';

function loadSeenFromStorage(): { appointments: number; settlements: number; tickets: number; comments: number; sales: number } {
  try {
    const raw = localStorage.getItem(NOTIFICATION_SEEN_KEY);
    if (!raw) return { appointments: 0, settlements: 0, tickets: 0, comments: 0, sales: 0 };
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (o && typeof o === 'object') {
      return {
        appointments: Number(o.appointments) || 0,
        settlements: Number(o.settlements) || 0,
        tickets: Number(o.tickets) || 0,
        comments: Number(o.comments) || 0,
        sales: Number(o.sales) || 0,
      };
    }
  } catch {
    /* ignore */
  }
  return { appointments: 0, settlements: 0, tickets: 0, comments: 0, sales: 0 };
}

function formatAppointmentTime(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const datePart = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const timePart = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${datePart} ${timePart}`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [pendingSettlementsCount, setPendingSettlementsCount] = useState(0);
  const [openTicketsCount, setOpenTicketsCount] = useState(0);
  const [ticketsWithRepliesCount, setTicketsWithRepliesCount] = useState(0);
  const [salesImagesCount, setSalesImagesCount] = useState(0);
  const [showAppointments, setShowAppointments] = useState(true);
  const [showSettlements, setShowSettlements] = useState(true);
  const [showTickets, setShowTickets] = useState(true);
  const [showComments, setShowComments] = useState(true);
  const [showSalesData, setShowSalesData] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [seenAppointments, setSeenAppointments] = useState(() => loadSeenFromStorage().appointments);
  const [seenSettlements, setSeenSettlements] = useState(() => loadSeenFromStorage().settlements);
  const [seenTickets, setSeenTickets] = useState(() => loadSeenFromStorage().tickets);
  const [seenComments, setSeenComments] = useState(() => loadSeenFromStorage().comments);
  const [seenSales, setSeenSales] = useState(() => loadSeenFromStorage().sales);

  const fetchNotificationData = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const from = today.toISOString();
    const to = nextWeek.toISOString();

    return Promise.all([
      getAppointments({ from, to }),
      getSettlements(),
      getTicketCount(),
      getTickets(),
      getSalesImages(),
    ]).then(([appRes, setRes, tickCountRes, tickListRes, salesRes]) => {
      if (appRes.success && appRes.appointments) {
        const upcoming = appRes.appointments
          .filter((a) => a.status !== 'cancelled' && a.status !== 'completed')
          .slice(0, 10);
        setAppointments(upcoming);
      } else {
        setAppointments([]);
      }
      if (setRes.success && setRes.settlements) {
        const pending = setRes.settlements.filter((s) => String(s.status).toLowerCase() === 'pending');
        setPendingSettlementsCount(pending.length);
      } else {
        setPendingSettlementsCount(0);
      }
      if (tickCountRes.success && tickCountRes.openCount != null) {
        setOpenTicketsCount(tickCountRes.openCount);
      } else {
        setOpenTicketsCount(0);
      }
      if (tickListRes.success && tickListRes.tickets) {
        const withReplies = tickListRes.tickets.filter((t) => (t.replyCount ?? 0) > 0);
        setTicketsWithRepliesCount(withReplies.length);
      } else {
        setTicketsWithRepliesCount(0);
      }
      if (salesRes.success && salesRes.images) {
        setSalesImagesCount(salesRes.images.length);
      } else {
        setSalesImagesCount(0);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    getSettings().then((r) => {
      if (r.success && r.settings) {
        setShowAppointments(r.settings.showNotificationAppointments !== false);
        setShowSettlements(r.settings.showNotificationSettlements !== false);
        setShowTickets(r.settings.showNotificationTickets !== false);
        setShowComments(r.settings.showNotificationComments !== false);
        setShowSalesData(r.settings.showNotificationSalesData !== false);
      }
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchNotificationData();
  }, [fetchNotificationData]);

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetchNotificationData();
    }
  }, [open, fetchNotificationData]);

  const markAllAsRead = useCallback(() => {
    const next = {
      appointments: appointments.length,
      settlements: pendingSettlementsCount,
      tickets: openTicketsCount,
      comments: ticketsWithRepliesCount,
      sales: salesImagesCount > 0 ? 1 : 0,
    };
    setSeenAppointments(next.appointments);
    setSeenSettlements(next.settlements);
    setSeenTickets(next.tickets);
    setSeenComments(next.comments);
    setSeenSales(next.sales);
    try {
      localStorage.setItem(NOTIFICATION_SEEN_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, [appointments.length, pendingSettlementsCount, openTicketsCount, ticketsWithRepliesCount, salesImagesCount]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [open]);

  const rawCount =
    (showAppointments ? appointments.length : 0) +
    (showSettlements ? pendingSettlementsCount : 0) +
    (showTickets ? openTicketsCount : 0) +
    (showComments ? ticketsWithRepliesCount : 0) +
    (showSalesData && salesImagesCount > 0 ? 1 : 0);
  const unseenAppointments = showAppointments ? Math.max(0, appointments.length - seenAppointments) : 0;
  const unseenSettlements = showSettlements ? Math.max(0, pendingSettlementsCount - seenSettlements) : 0;
  const unseenTickets = showTickets ? Math.max(0, openTicketsCount - seenTickets) : 0;
  const unseenComments = showComments ? Math.max(0, ticketsWithRepliesCount - seenComments) : 0;
  const unseenSales = showSalesData ? Math.max(0, (salesImagesCount > 0 ? 1 : 0) - seenSales) : 0;
  const totalCount = unseenAppointments + unseenSettlements + unseenTickets + unseenComments + unseenSales;

  const hasUnread = totalCount > 0;

  return (
    <div className="notification-bell-wrap" ref={dropdownRef}>
      <button
        type="button"
        className="notification-bell-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <span className="notification-bell-icon" aria-hidden><BellIcon /></span>
        {totalCount > 0 && (
          <span className="notification-bell-badge">{totalCount > 99 ? '99+' : totalCount}</span>
        )}
      </button>
      {open && (
        <div className="notification-dropdown" role="dialog" aria-label="Notifications">
          <div className="notification-dropdown-header">Notifications</div>
          {loading ? (
            <div className="notification-dropdown-loading">Loading…</div>
          ) : (
            <div className="notification-dropdown-body">
              {showAppointments && (
                <div className={`notification-section${unseenAppointments > 0 ? ' notification-section-unread' : ''}`}>
                  <span className="notification-section-title">📅 Appointments</span>
                  {appointments.length === 0 ? (
                    <p className="notification-empty">No upcoming appointments</p>
                  ) : (
                    <>
                      <ul className="notification-list">
                        {appointments.slice(0, 1).map((a) => (
                          <li key={a.id}>
                            <Link
                              to={ROUTES.vendor.appointments}
                              onClick={() => setOpen(false)}
                              className="notification-item"
                            >
                              <span className="notification-item-title">
                                {a.customer?.name ?? 'Customer'} – {a.service ?? 'Appointment'}
                              </span>
                              <span className="notification-item-meta">{formatAppointmentTime(a.scheduledAt)}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                      <Link
                        to={ROUTES.vendor.appointments}
                        className="notification-view-all"
                        onClick={() => setOpen(false)}
                      >
                        View all
                      </Link>
                    </>
                  )}
                </div>
              )}

              {showSettlements && (
                <div className={`notification-section${unseenSettlements > 0 ? ' notification-section-unread' : ''}`}>
                  <span className="notification-section-title">📋 Settlements</span>
                  {pendingSettlementsCount === 0 ? (
                    <p className="notification-empty">No pending settlements</p>
                  ) : (
                    <>
                      <Link
                        to={ROUTES.vendor.settlements}
                        onClick={() => setOpen(false)}
                        className="notification-item notification-item-highlight"
                      >
                        <span className="notification-item-title">
                          {pendingSettlementsCount} pending settlement{pendingSettlementsCount !== 1 ? 's' : ''}
                        </span>
                      </Link>
                      <Link
                        to={ROUTES.vendor.settlements}
                        className="notification-view-all"
                        onClick={() => setOpen(false)}
                      >
                        View all
                      </Link>
                    </>
                  )}
                </div>
              )}

              {showTickets && (
                <div className={`notification-section${unseenTickets > 0 ? ' notification-section-unread' : ''}`}>
                  <span className="notification-section-title">🎫 Tickets</span>
                  {openTicketsCount === 0 ? (
                    <p className="notification-empty">No open tickets</p>
                  ) : (
                    <>
                      <Link
                        to={ROUTES.vendor.tickets}
                        onClick={() => setOpen(false)}
                        className="notification-item"
                      >
                        <span className="notification-item-title">
                          {openTicketsCount} open ticket{openTicketsCount !== 1 ? 's' : ''}
                        </span>
                      </Link>
                      <Link
                        to={ROUTES.vendor.tickets}
                        className="notification-view-all"
                        onClick={() => setOpen(false)}
                      >
                        View all
                      </Link>
                    </>
                  )}
                </div>
              )}

              {showComments && (
                <div className={`notification-section${unseenComments > 0 ? ' notification-section-unread' : ''}`}>
                  <span className="notification-section-title">💬 Comments</span>
                  {ticketsWithRepliesCount === 0 ? (
                    <p className="notification-empty">No ticket replies</p>
                  ) : (
                    <>
                      <Link
                        to={ROUTES.vendor.tickets}
                        onClick={() => setOpen(false)}
                        className="notification-item"
                      >
                        <span className="notification-item-title">
                          {ticketsWithRepliesCount} ticket{ticketsWithRepliesCount !== 1 ? 's' : ''} with replies
                        </span>
                      </Link>
                      <Link
                        to={ROUTES.vendor.tickets}
                        className="notification-view-all"
                        onClick={() => setOpen(false)}
                      >
                        View all
                      </Link>
                    </>
                  )}
                </div>
              )}

              {showSalesData && (
                <div className={`notification-section${unseenSales > 0 ? ' notification-section-unread' : ''}`}>
                  <span className="notification-section-title">🖼️ Sales Data</span>
                  {salesImagesCount === 0 ? (
                    <p className="notification-empty">No sales data entries</p>
                  ) : (
                    <>
                      <Link
                        to={ROUTES.vendor.salesImages}
                        onClick={() => setOpen(false)}
                        className="notification-item"
                      >
                        <span className="notification-item-title">
                          {salesImagesCount} sales data entr{salesImagesCount !== 1 ? 'ies' : 'y'}
                        </span>
                      </Link>
                      <Link
                        to={ROUTES.vendor.salesImages}
                        className="notification-view-all"
                        onClick={() => setOpen(false)}
                      >
                        View all
                      </Link>
                    </>
                  )}
                </div>
              )}

              {!showAppointments && !showSettlements && !showTickets && !showComments && !showSalesData && (
                <p className="notification-empty" style={{ padding: '1rem' }}>No notification categories enabled. Ask your admin to enable some in Settings.</p>
              )}

              {hasUnread && (
                <div className="notification-dropdown-footer">
                  <button
                    type="button"
                    className="notification-mark-read-all"
                    onClick={markAllAsRead}
                  >
                    Mark as read all
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
