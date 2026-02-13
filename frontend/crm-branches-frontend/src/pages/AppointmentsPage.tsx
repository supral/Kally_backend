import { useCallback, useEffect, useState } from 'react';
import { getAppointments, createAppointment, updateAppointment } from '../api/appointments';
import { getBranches } from '../api/branches';
import { getCustomers } from '../api/customers';
import { getServices } from '../api/services';
import { useBranch } from '../hooks/useBranch';
import type { Appointment, Branch, Customer, Service } from '../types/crm';

function loadList(
  setLoading: (v: boolean) => void,
  setError: (v: string) => void,
  setAppointments: (a: Appointment[]) => void,
  effectiveBranchId: string | undefined,
  date: string
) {
  setLoading(true);
  setError('');
  getAppointments({ branchId: effectiveBranchId, date }).then((r) => {
    setLoading(false);
    if (r.success && r.appointments != null) setAppointments(r.appointments);
    else setError(r.message || 'Failed to load appointments');
  });
}

export default function AppointmentsPage() {
  const { branchId: userBranchId, isAdmin } = useBranch();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [branchId, setBranchId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bookOpen, setBookOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const effectiveBranchId = isAdmin ? (branchId || undefined) : (userBranchId || undefined);
  const totalPages = Math.max(1, Math.ceil(appointments.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const paginatedAppointments = appointments.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const refetch = useCallback(() => {
    loadList(setLoading, setError, setAppointments, effectiveBranchId, date);
  }, [effectiveBranchId, date]);

  useEffect(() => {
    if (isAdmin) {
      getBranches().then((r) => { if (r.success && r.branches) setBranches(r.branches); });
    } else if (userBranchId) {
      setBranchId(userBranchId);
    }
  }, [isAdmin, userBranchId]);

  useEffect(() => {
    loadList(setLoading, setError, setAppointments, effectiveBranchId, date);
  }, [effectiveBranchId, date]);

  useEffect(() => {
    setPage(1);
  }, [date, effectiveBranchId]);

  useEffect(() => {
    if (!bookOpen) return;
    getCustomers().then((r) => { if (r.success && r.customers) setCustomers(r.customers); });
    getServices(effectiveBranchId || undefined).then((r) => { if (r.success && r.services) setServices(r.services || []); });
  }, [bookOpen, effectiveBranchId]);

  const [formCustomerId, setFormCustomerId] = useState('');
  const [formBranchId, setFormBranchId] = useState('');
  const [formServiceId, setFormServiceId] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formTime, setFormTime] = useState('09:00');
  const [formNotes, setFormNotes] = useState('');

  const openBook = () => {
    setFormError('');
    setFormCustomerId('');
    setFormBranchId(effectiveBranchId || '');
    setFormServiceId('');
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormTime('09:00');
    setFormNotes('');
    setBookOpen(true);
  };

  const closeBook = () => {
    setBookOpen(false);
    setFormError('');
  };

  const handleBookSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerId.trim()) {
      setFormError('Please select a customer.');
      return;
    }
    const scheduledAt = new Date(`${formDate}T${formTime}:00`).toISOString();
    const branchIdToUse = isAdmin ? (formBranchId || undefined) : (userBranchId || undefined);
    if (!branchIdToUse && isAdmin) {
      setFormError('Please select a branch.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    createAppointment({
      customerId: formCustomerId,
      branchId: branchIdToUse,
      serviceId: formServiceId || undefined,
      scheduledAt,
      notes: formNotes || undefined,
    }).then((r) => {
      setSubmitting(false);
      if (r.success) {
        closeBook();
        refetch();
      } else {
        setFormError(r.message || 'Failed to book appointment');
      }
    });
  };

  const handleStatusChange = useCallback((appointmentId: string, newStatus: string) => {
    setUpdatingId(appointmentId);
    setAppointments((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, status: newStatus } : a))
    );
    updateAppointment(appointmentId, { status: newStatus }).then((r) => {
      setUpdatingId(null);
      if (r.success) refetch();
    });
  }, [refetch]);

  const completed = appointments.filter((a) => a.status === 'completed').length;
  const pending = appointments.filter((a) => ['pending', 'scheduled', 'confirmed', 'accepted'].includes(a.status)).length;
  const canChangeStatus = isAdmin;

  return (
    <div className="dashboard-content">
      <header className="page-hero" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <h1 className="page-hero-title">Appointments</h1>
          <p className="page-hero-subtitle">
            {isAdmin ? 'Book appointments, accept, reject, or mark as completed.' : 'Create and view appointments for your branch.'}
          </p>
        </div>
        <button type="button" className="btn-primary appointments-book-btn" onClick={openBook}>
          Book appointment
        </button>
      </header>
      <section className="content-card">
        <div className="appointments-filters">
          {isAdmin && (
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="filter-btn appointments-select"
              aria-label="Filter by branch"
            >
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          <label className="appointments-date-label">
            <span className="appointments-date-label-text">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="filter-btn appointments-date-input"
              aria-label="Appointment date"
            />
          </label>
        </div>
        {!loading && appointments.length > 0 && (
          <p className="appointments-stats">
            <span className="appointments-stat">{appointments.length} total</span>
            {pending > 0 && <span className="appointments-stat">{pending} pending</span>}
            {completed > 0 && <span className="appointments-stat">{completed} completed</span>}
          </p>
        )}
        {error && <div className="auth-error vendors-error">{error}</div>}
        {loading ? (
          <div className="vendors-loading">
            <div className="spinner" />
            <span>Loading appointments…</span>
          </div>
        ) : appointments.length === 0 ? (
          <p className="vendors-empty">No appointments for this date. Click “Book appointment” to add one.</p>
        ) : (
          <>
            <p className="customers-showing-count text-muted">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, appointments.length)} of {appointments.length} appointment{appointments.length !== 1 ? 's' : ''}
            </p>
            <div className="data-table-wrap">
              <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Branch</th>
                  <th>Service</th>
                  <th>Time</th>
                  <th>Status</th>
                  {canChangeStatus && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {paginatedAppointments.map((a) => (
                  <tr key={a.id}>
                    <td>{a.customer?.name || '—'}{a.customer?.phone ? ` (${a.customer.phone})` : ''}</td>
                    <td>{a.branch || '—'}</td>
                    <td>{a.service || '—'}</td>
                    <td>{a.scheduledAt ? new Date(a.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td>
                      <span className={`status-badge status-${a.status === 'completed' ? 'approved' : a.status === 'rejected' || a.status === 'no-show' || a.status === 'cancelled' ? 'rejected' : 'pending'}`}>
                        {a.status}
                      </span>
                    </td>
                    {canChangeStatus && (
                      <td>
                        {['pending', 'scheduled', 'confirmed', 'accepted'].includes(a.status) && (
                          <div className="appointments-row-actions">
                            <button
                              type="button"
                              className="btn-approve appointments-action-btn"
                              onClick={() => handleStatusChange(a.id, 'accepted')}
                              disabled={updatingId !== null}
                              title="Accept"
                            >
                              {updatingId === a.id ? '…' : 'Accept'}
                            </button>
                            <button
                              type="button"
                              className="btn-primary appointments-action-btn"
                              onClick={() => handleStatusChange(a.id, 'completed')}
                              disabled={updatingId !== null}
                              title="Mark completed"
                            >
                              Complete
                            </button>
                            <button
                              type="button"
                              className="btn-reject appointments-action-btn"
                              onClick={() => handleStatusChange(a.id, 'rejected')}
                              disabled={updatingId !== null}
                              title="Reject"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="customers-pagination">
                <button type="button" className="pagination-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1} aria-label="Previous page">Previous</button>
                <span className="pagination-info">Page {currentPage} of {totalPages}</span>
                <button type="button" className="pagination-btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} aria-label="Next page">Next</button>
              </div>
            )}
          </>
        )}
      </section>

      {bookOpen && (
        <div
          className="vendor-modal-backdrop appointment-modal-backdrop"
          onClick={closeBook}
          role="presentation"
        >
          <div
            className="vendor-modal appointment-book-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="appointment-book-title"
          >
            <div className="vendor-modal-header">
              <h2 id="appointment-book-title">Book appointment</h2>
              <button type="button" className="vendor-modal-close" onClick={closeBook} aria-label="Close">×</button>
            </div>
            <form onSubmit={handleBookSubmit} className="appointment-book-form">
              {formError && <div className="auth-error vendors-error">{formError}</div>}
              <label className="auth-form-label">
                <span>Customer *</span>
                <select
                  value={formCustomerId}
                  onChange={(e) => setFormCustomerId(e.target.value)}
                  className="appointments-select appointment-form-input"
                  required
                >
                  <option value="">Select customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
                  ))}
                </select>
              </label>
              {isAdmin && (
                <label className="auth-form-label">
                  <span>Branch *</span>
                  <select
                    value={formBranchId}
                    onChange={(e) => setFormBranchId(e.target.value)}
                    className="appointments-select appointment-form-input"
                    required
                  >
                    <option value="">Select branch</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="auth-form-label">
                <span>Service (optional)</span>
                <select
                  value={formServiceId}
                  onChange={(e) => setFormServiceId(e.target.value)}
                  className="appointments-select appointment-form-input"
                >
                  <option value="">No service</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}{s.durationMinutes ? ` (${s.durationMinutes} min)` : ''}</option>
                  ))}
                </select>
              </label>
              <div className="appointment-form-datetime">
                <label className="auth-form-label">
                  <span>Date *</span>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="appointment-form-input"
                    required
                  />
                </label>
                <label className="auth-form-label">
                  <span>Time *</span>
                  <input
                    type="time"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="appointment-form-input"
                    required
                  />
                </label>
              </div>
              <label className="auth-form-label">
                <span>Notes (optional)</span>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="appointment-form-input appointment-form-notes"
                  rows={2}
                  placeholder="Customer request or notes"
                />
              </label>
              <div className="appointment-form-actions">
                <button type="button" className="filter-btn" onClick={closeBook}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Booking…' : 'Book appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
