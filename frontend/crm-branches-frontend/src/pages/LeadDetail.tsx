import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getLead, updateLead, addFollowUp } from '../api/leads';
import { useAuth } from '../auth/hooks/useAuth';
import type { Lead } from '../types/crm';

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [followUpNote, setFollowUpNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const basePath = user?.role === 'admin' ? '/admin' : '/vendor';

  useEffect(() => {
    if (!id) return;
    getLead(id).then((r) => {
      setLoading(false);
      if (r.success && 'lead' in r) setLead((r as { lead: Lead }).lead);
      else setError(r.message || 'Failed to load');
    });
  }, [id]);

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
          <dt>Status</dt>
          <dd>
            <span className={`status-badge status-${lead!.status === 'booked' ? 'approved' : lead!.status === 'lost' ? 'rejected' : 'pending'}`}>{lead!.status}</span>
            {' '}
            <select value={lead!.status} onChange={(e) => handleStatusChange(e.target.value)} className="filter-btn" style={{ marginLeft: '0.5rem' }}>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="booked">Booked</option>
              <option value="lost">Lost</option>
            </select>
          </dd>
          <dt>Notes</dt>
          <dd>{lead!.notes || '—'}</dd>
        </dl>
        <h3 style={{ marginTop: '1.5rem' }}>Add follow-up</h3>
        <form onSubmit={handleAddFollowUp} className="auth-form" style={{ maxWidth: '400px' }}>
          <label><span>Note</span><input type="text" value={followUpNote} onChange={(e) => setFollowUpNote(e.target.value)} placeholder="Follow-up note" /></label>
          <button type="submit" className="auth-submit" disabled={submitting}>{submitting ? 'Adding...' : 'Add follow-up'}</button>
        </form>
        <h3 style={{ marginTop: '1.5rem' }}>Follow-up history</h3>
        {(!lead!.followUps || lead!.followUps.length === 0) ? <p className="text-muted">No follow-ups yet.</p> : (
          <ul className="report-list">
            {(lead!.followUps || []).map((f, i) => (
              <li key={i}>{new Date(f.at).toLocaleString()} — {f.note}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
