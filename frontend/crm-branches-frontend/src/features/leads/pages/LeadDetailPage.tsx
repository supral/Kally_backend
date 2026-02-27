import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getLead, updateLead, addFollowUp } from '../../../api/leads';
import { getLeadStatuses } from '../../../api/leadStatuses';
import { getCustomers, createCustomer } from '../../../api/customers';
import { getBranches } from '../../../api/branches';
import { getServices } from '../../../api/services';
import { createAppointment } from '../../../api/appointments';
import { useAuth } from '../../../auth/hooks/useAuth';
import type { Lead } from '../../../types/common';
import type { LeadStatusItem } from '../../../api/leadStatuses';
import type { Service } from '../../../types/crm';

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [leadStatuses, setLeadStatuses] = useState<LeadStatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [followUpNote, setFollowUpNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notesEdit, setNotesEdit] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [bookCustomerId, setBookCustomerId] = useState<string | null>(null);
  const [bookResolving, setBookResolving] = useState(false);
  const [bookSubmitting, setBookSubmitting] = useState(false);
  const [bookError, setBookError] = useState('');
  const [bookBranches, setBookBranches] = useState<{ id: string; name: string }[]>([]);
  const [bookServices, setBookServices] = useState<Service[]>([]);
  const [bookBranchId, setBookBranchId] = useState('');
  const [bookDate, setBookDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [bookTime, setBookTime] = useState('09:00');
  const [bookServiceId, setBookServiceId] = useState('');
  const [bookNotes, setBookNotes] = useState('');
  const basePath = user?.role === 'admin' ? '/admin' : '/vendor';
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    getLeadStatuses().then((r) => r.success && r.leadStatuses && setLeadStatuses(r.leadStatuses));
  }, []);

  useEffect(() => {
    if (!id) return;
    getLead(id).then((r) => {
      setLoading(false);
      if (r.success && 'lead' in r) {
        const l = (r as { lead: Lead }).lead;
        setLead(l);
        setNotesEdit(l.notes ?? '');
      } else setError(r.message || 'Failed to load');
    });
  }, [id]);

  useEffect(() => {
    if (lead) setNotesEdit(lead.notes ?? '');
  }, [lead?.id]);

  const openBookModal = useCallback(() => {
    if (!lead) return;
    setBookModalOpen(true);
    setBookError('');
    setBookCustomerId(null);
    setBookResolving(true);
    setBookBranchId(lead.branchId || '');
    setBookDate(new Date().toISOString().slice(0, 10));
    setBookTime('09:00');
    setBookServiceId('');
    setBookNotes('');
    getCustomers().then((r) => {
      const customers = r.success ? r.customers || [] : [];
      const existing = lead.phone ? customers.find((c) => (c.phone || '').trim() === (lead.phone || '').trim()) : null;
      if (existing) {
        setBookCustomerId(existing.id);
        setBookResolving(false);
      } else {
        createCustomer({
          name: lead.name.trim(),
          phone: (lead.phone || '').trim() || '—',
          email: lead.email?.trim(),
          primaryBranchId: lead.branchId,
        }).then((cr) => {
          setBookResolving(false);
          if (cr.success) {
            const created = cr as unknown as { customer?: { id: string } };
            if (created.customer) setBookCustomerId(created.customer.id);
            else setBookError(cr.message || 'Could not create customer for this lead.');
          } else setBookError(cr.message || 'Could not create customer for this lead.');
        });
      }
    });
    if (isAdmin) getBranches().then((br) => { if (br.success && br.branches) setBookBranches(br.branches); });
    getServices(lead.branchId || undefined).then((sr) => sr.success && sr.services && setBookServices(sr.services || []));
  }, [lead, isAdmin]);

  useEffect(() => {
    if (bookModalOpen && (lead?.branchId || bookBranchId)) {
      getServices(isAdmin ? bookBranchId || undefined : (lead?.branchId || undefined)).then((r) => r.success && r.services && setBookServices(r.services || []));
    }
  }, [bookModalOpen, lead?.branchId, bookBranchId, isAdmin]);

  async function handleBookAppointment(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !lead || !bookCustomerId) return;
    const branchIdToUse = isAdmin ? bookBranchId : (user?.branchId ?? '');
    if (!branchIdToUse) {
      setBookError('Branch is required.');
      return;
    }
    const scheduledAt = new Date(`${bookDate}T${bookTime}:00`).toISOString();
    setBookSubmitting(true);
    setBookError('');
    const res = await createAppointment({
      customerId: bookCustomerId,
      branchId: branchIdToUse,
      serviceId: bookServiceId || undefined,
      scheduledAt,
      notes: bookNotes.trim() || undefined,
    });
    setBookSubmitting(false);
    if (res.success) {
      await updateLead(id, { status: 'Booked' });
      getLead(id).then((r) => r.success && 'lead' in r && setLead((r as { lead: Lead }).lead));
      setBookModalOpen(false);
    } else setBookError((res as { message?: string }).message || 'Failed to book appointment.');
  }

  async function handleAddFollowUp(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !followUpNote.trim()) return;
    setSubmitting(true);
    const res = await addFollowUp(id, followUpNote.trim());
    setSubmitting(false);
    if (res.success) {
      setFollowUpNote('');
      getLead(id).then((r) => r.success && 'lead' in r && setLead((r as { lead: Lead }).lead));
    } else setError((res as { message?: string }).message || 'Failed to add follow-up');
  }

  async function handleStatusChange(newStatus: string) {
    if (!id) return;
    const res = await updateLead(id, { status: newStatus });
    if (res.success) getLead(id).then((r) => r.success && 'lead' in r && setLead((r as { lead: Lead }).lead));
  }

  async function handleSaveNotes(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSavingNotes(true);
    const res = await updateLead(id, { notes: notesEdit.trim() || undefined });
    setSavingNotes(false);
    if (res.success) getLead(id).then((r) => r.success && 'lead' in r && setLead((r as { lead: Lead }).lead));
  }

  if (loading || !id) {
    return (
      <div className="dashboard-content">
        <div className="vendors-loading"><div className="spinner" /><span>Loading...</span></div>
      </div>
    );
  }

  if (error && !lead) {
    return (
      <div className="dashboard-content">
        <div className="auth-error">{error}</div>
        <button type="button" className="auth-submit" style={{ marginTop: '1rem' }} onClick={() => navigate(`${basePath}/leads`)}>Back to leads</button>
      </div>
    );
  }

  return (
    <div className="dashboard-content">
      <section className="content-card">
        <button type="button" className="vendor-name-btn" style={{ marginBottom: '0.5rem' }} onClick={() => navigate(`${basePath}/leads`)}>← Back to leads</button>
        <div className="lead-detail-header-row">
          <h2>Lead: {lead!.name}</h2>
          <button type="button" className="auth-submit lead-book-appointment-btn" onClick={openBookModal} disabled={!lead}>
            Book Appointment
          </button>
        </div>
        <dl className="vendor-detail-dl">
          <dt>Phone</dt>
          <dd>{lead!.phone || '—'}</dd>
          <dt>Email</dt>
          <dd>{lead!.email || '—'}</dd>
          <dt>Source</dt>
          <dd>{lead!.source}</dd>
          <dt>Branch</dt>
          <dd>{lead!.branch || '—'}</dd>
          <dt>Created</dt>
          <dd>{lead!.createdAt ? new Date(lead!.createdAt).toLocaleString() : '—'}</dd>
          <dt>Status</dt>
          <dd>
            <span className={`status-badge status-${lead!.status === 'Booked' ? 'approved' : lead!.status === 'Lost' ? 'rejected' : 'pending'}`}>{lead!.status}</span>
            {' '}
            <select value={lead!.status} onChange={(e) => handleStatusChange(e.target.value)} className="filter-btn" style={{ marginLeft: '0.5rem' }}>
              {leadStatuses.length > 0
                ? leadStatuses.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)
                : ['New', 'Contacted', 'Call not Connected', 'Follow up', 'Booked', 'Lost'].map((name) => <option key={name} value={name}>{name}</option>)}
              {leadStatuses.length > 0 && !leadStatuses.some((s) => s.name === lead!.status) && (
                <option value={lead!.status}>{lead!.status}</option>
              )}
            </select>
          </dd>
          <dt>Notes</dt>
          <dd>
            <form onSubmit={handleSaveNotes} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '400px' }}>
              <textarea value={notesEdit} onChange={(e) => setNotesEdit(e.target.value)} rows={3} placeholder="Notes" style={{ width: '100%', resize: 'vertical' }} />
              <button type="submit" className="filter-btn" style={{ width: 'auto' }} disabled={savingNotes}>{savingNotes ? 'Saving…' : 'Save notes'}</button>
            </form>
          </dd>
        </dl>
        <section className="follow-up-section">
          <h3 className="follow-up-section-title">Follow-ups</h3>
          <form onSubmit={handleAddFollowUp} className="follow-up-form">
            <textarea
              value={followUpNote}
              onChange={(e) => setFollowUpNote(e.target.value)}
              placeholder="Add a follow-up note..."
              rows={2}
              className="follow-up-input"
              disabled={submitting}
            />
            <button type="submit" className="auth-submit follow-up-submit" disabled={submitting || !followUpNote.trim()}>
              {submitting ? 'Adding…' : 'Add'}
            </button>
          </form>
          {(!lead!.followUps || lead!.followUps.length === 0) ? (
            <div className="follow-up-history-box">
              <p className="follow-up-empty text-muted">No follow-ups yet. Add one above.</p>
            </div>
          ) : (
            <div className="follow-up-history-box">
              <h4 className="follow-up-history-title">History</h4>
              <div className="follow-up-list">
                {(lead!.followUps || []).map((f, i) => (
                  <div key={i} className="follow-up-item">
                    <time className="follow-up-date" dateTime={f.at}>
                      {new Date(f.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </time>
                    <p className="follow-up-note">{f.note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </section>

      {bookModalOpen && (
        <>
          <div className="vendor-modal-backdrop appointment-modal-backdrop" onClick={() => !bookSubmitting && setBookModalOpen(false)} aria-hidden />
          <div className="vendor-modal appointment-book-modal lead-book-modal" role="dialog" aria-labelledby="lead-book-appointment-title">
            <div className="vendor-modal-inner">
              <h2 id="lead-book-appointment-title">Book appointment for {lead!.name}</h2>
              {bookResolving ? (
                <p className="text-muted">Preparing form…</p>
              ) : !bookCustomerId ? (
                <p className="auth-error">{bookError || 'Could not find or create customer.'}</p>
              ) : (
                <form onSubmit={handleBookAppointment} className="appointment-book-form">
                  {bookError && <div className="auth-error">{bookError}</div>}
                  <p className="lead-book-customer-info">
                    Customer: <strong>{lead!.name}</strong> {lead!.phone && `(${lead!.phone})`}
                  </p>
                  {isAdmin && bookBranches.length > 0 && (
                    <label className="auth-form-label">
                      <span>Branch</span>
                      <select value={bookBranchId} onChange={(e) => setBookBranchId(e.target.value)} className="appointment-form-input" required>
                        <option value="">Select branch</option>
                        {bookBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </label>
                  )}
                  <div className="appointment-form-datetime">
                    <label className="auth-form-label">
                      <span>Date</span>
                      <input type="date" value={bookDate} onChange={(e) => setBookDate(e.target.value)} className="appointment-form-input" required />
                    </label>
                    <label className="auth-form-label">
                      <span>Time</span>
                      <input type="time" value={bookTime} onChange={(e) => setBookTime(e.target.value)} className="appointment-form-input" required />
                    </label>
                  </div>
                  {bookServices.length > 0 && (
                    <label className="auth-form-label">
                      <span>Service (optional)</span>
                      <select value={bookServiceId} onChange={(e) => setBookServiceId(e.target.value)} className="appointment-form-input">
                        <option value="">— None</option>
                        {bookServices.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </label>
                  )}
                  <label className="auth-form-label">
                    <span>Notes (optional)</span>
                    <textarea value={bookNotes} onChange={(e) => setBookNotes(e.target.value)} className="appointment-form-input appointment-form-notes" rows={2} placeholder="Notes" />
                  </label>
                  <div className="appointment-form-actions">
                    <button type="button" className="filter-btn" onClick={() => setBookModalOpen(false)} disabled={bookSubmitting}>Cancel</button>
                    <button type="submit" className="auth-submit" disabled={bookSubmitting}>{bookSubmitting ? 'Booking…' : 'Book appointment'}</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
