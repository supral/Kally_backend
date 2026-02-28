import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getTickets, createTicket } from '../../../api/tickets';
import { getBranches } from '../../../api/branches';
import { useAuth } from '../../../auth/hooks/useAuth';
import type { Ticket } from '../../../api/tickets';
import type { Branch } from '../../../types/common';

export default function TicketsPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [targetBranchId, setTargetBranchId] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.role === 'admin';
  const basePath = isAdmin ? '/admin' : '/vendor';

  const fetchTickets = () => {
    setLoading(true);
    getTickets().then((r) => {
      setLoading(false);
      if (r.success) setTickets(r.tickets || []);
      else setError(r.message || 'Failed to load');
    });
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  useEffect(() => {
    if (isAdmin) getBranches({ all: true }).then((r) => r.success && r.branches && setBranches(r.branches || []));
  }, [isAdmin]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!subject.trim()) {
      setFormError('Subject is required.');
      return;
    }
    if (!body.trim()) {
      setFormError('Message is required.');
      return;
    }
    if (isAdmin && !targetBranchId) {
      setFormError('Select a branch or "All branches" to send the ticket to.');
      return;
    }

    let imageBase64: string | undefined;
    if (imageFile) {
      imageBase64 = await new Promise<string | undefined>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string) || undefined);
        reader.readAsDataURL(imageFile);
      });
    }

    setSubmitting(true);
    const r = await createTicket({
      subject: subject.trim(),
      body: body.trim(),
      targetBranchId: isAdmin ? (targetBranchId === '__all__' ? undefined : targetBranchId || undefined) : undefined,
      imageBase64,
    });
    setSubmitting(false);

    if (r.success) {
      setShowForm(false);
      setSubject('');
      setBody('');
      setTargetBranchId('');
      setImageFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchTickets();
    } else setFormError(r.message || 'Failed to create ticket');
  }

  const openTickets = tickets.filter((t) => t.status === 'open');
  const closedTickets = tickets.filter((t) => t.status === 'closed');

  return (
    <div className="dashboard-content tickets-page">
      <header className="tickets-hero">
        <div>
          <h1 className="tickets-hero-title">Tickets</h1>
          <p className="tickets-hero-subtitle">
            Communication channel between admin and branches. Create tickets, reply in thread, and attach images (screenshots, photos) to messages.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary tickets-create-btn"
          onClick={() => {
            setShowForm(!showForm);
            setFormError('');
          }}
        >
          + New ticket
        </button>
      </header>

      {showForm && (
        <section className="tickets-form-section content-card">
          <h2 className="tickets-form-title">Create ticket</h2>
          <form onSubmit={handleCreate} className="tickets-form">
            {isAdmin && (
              <div className="tickets-field">
                <label htmlFor="t-target">To branch</label>
                <select
                  id="t-target"
                  value={targetBranchId}
                  onChange={(e) => setTargetBranchId(e.target.value)}
                  required
                >
                  <option value="">— Select branch —</option>
                  <option value="__all__">All branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="tickets-field">
              <label htmlFor="t-subject">Subject</label>
              <input
                id="t-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief subject"
                required
              />
            </div>
            <div className="tickets-field">
              <label htmlFor="t-body">Message</label>
              <textarea
                id="t-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Describe the issue or question..."
                rows={4}
                required
              />
            </div>
            <div className="tickets-field">
              <label>Image <span className="tickets-field-hint">— Attach screenshots or photos (optional but recommended)</span></label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                aria-label="Attach image"
              />
              {imageFile && (
                <span className="tickets-file-name">
                  {imageFile.name}
                  <button type="button" onClick={() => { setImageFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                    ×
                  </button>
                </span>
              )}
            </div>
            {formError && <div className="alert alert-error">{formError}</div>}
            <div className="tickets-form-actions">
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create ticket'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="tickets-loading">Loading tickets…</div>
      ) : tickets.length === 0 ? (
        <div className="tickets-empty content-card">
          <p>No tickets yet. Create one to start the conversation.</p>
        </div>
      ) : (
        <div className="tickets-list">
          {openTickets.length > 0 && (
            <section className="content-card">
              <h2 className="tickets-section-title">Open</h2>
              <div className="tickets-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Replies</th>
                      <th>Date</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {openTickets.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <Link to={`${basePath}/tickets/${t.id}`} className="ticket-subject-link">
                            {t.subject}
                            {t.hasImage && <span className="ticket-has-image" title="Has image">🖼</span>}
                          </Link>
                        </td>
                        <td>{t.createdByBranch || t.createdBy || '—'}</td>
                        <td>{t.targetBranch || 'All'}</td>
                        <td>{t.replyCount}</td>
                        <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                        <td>
                          <Link to={`${basePath}/tickets/${t.id}`} className="btn-secondary btn-sm">
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {closedTickets.length > 0 && (
            <section className="content-card">
              <h2 className="tickets-section-title">Closed</h2>
              <div className="tickets-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Replies</th>
                      <th>Date</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {closedTickets.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <Link to={`${basePath}/tickets/${t.id}`} className="ticket-subject-link">
                            {t.subject}
                            {t.hasImage && <span className="ticket-has-image" title="Has image">🖼</span>}
                          </Link>
                        </td>
                        <td>{t.createdByBranch || t.createdBy || '—'}</td>
                        <td>{t.targetBranch || 'All'}</td>
                        <td>{t.replyCount}</td>
                        <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                        <td>
                          <Link to={`${basePath}/tickets/${t.id}`} className="btn-secondary btn-sm">
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
