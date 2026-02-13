import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getLead, updateLead, addFollowUp } from '../../../api/leads';
import { getLeadStatuses } from '../../../api/leadStatuses';
import { useAuth } from '../../../auth/hooks/useAuth';
import type { Lead } from '../../../types/common';
import type { LeadStatusItem } from '../../../api/leadStatuses';

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
  const basePath = user?.role === 'admin' ? '/admin' : '/vendor';

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
        <h2>Lead: {lead!.name}</h2>
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
    </div>
  );
}
