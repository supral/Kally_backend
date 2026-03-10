import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getTicket, addTicketReply, updateTicketStatus } from '../../../api/tickets';
import { useAuth } from '../../../auth/hooks/useAuth';
import type { TicketDetail, TicketReply } from '../../../api/tickets';

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [replyImage, setReplyImage] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [replyError, setReplyError] = useState('');
  const [viewImage, setViewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const basePath = isAdmin ? '/admin' : '/vendor';

  const fetchTicket = () => {
    if (!id) return;
    setLoading(true);
    getTicket(id).then((r) => {
      setLoading(false);
      if (r.success) setTicket(r.ticket || null);
      else setError(r.message || 'Failed to load');
    });
  };

  useEffect(() => {
    fetchTicket();
  }, [id]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !replyMessage.trim()) return;
    setReplyError('');

    let imageBase64: string | undefined;
    if (replyImage) {
      imageBase64 = await new Promise<string | undefined>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string)?.split(',')[1] || undefined);
        reader.readAsDataURL(replyImage);
      });
    }

    setSubmitting(true);
    const r = await addTicketReply(id, { message: replyMessage.trim(), imageBase64 });
    setSubmitting(false);

    if (r.success) {
      setReplyMessage('');
      setReplyImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchTicket();
    } else setReplyError(r.message || 'Failed to add reply');
  }

  async function handleStatusChange(status: 'open' | 'closed') {
    if (!id) return;
    const r = await updateTicketStatus(id, status);
    if (r.success) {
      if (status === 'closed') {
        navigate(`${basePath}/tickets`);
      } else {
        fetchTicket();
      }
    }
  }

  if (loading) return <div className="tickets-loading">Loading ticket…</div>;
  if (error || !ticket) return <div className="alert alert-error">{error || 'Ticket not found'}</div>;

  return (
    <div className="dashboard-content ticket-detail-page">
      <div className="ticket-detail-header">
        <Link to={`${basePath}/tickets`} className="ticket-back-link">← Back to tickets</Link>
        <div className="ticket-detail-meta">
          <h1 className="ticket-detail-title">{ticket.subject}</h1>
          <span className={`ticket-status-badge ticket-status-${ticket.status}`}>{ticket.status}</span>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => handleStatusChange(ticket.status === 'open' ? 'closed' : 'open')}
          >
            Mark {ticket.status === 'open' ? 'closed' : 'open'}
          </button>
        </div>
        <p className="ticket-detail-from">
          From: {ticket.createdByBranch || ticket.createdBy || '—'} → To: {ticket.targetBranch || 'All branches'}
        </p>
      </div>

      <div className="ticket-thread">
        <div className="ticket-message ticket-message-initial">
          <div className="ticket-message-header">
            <strong>{ticket.createdBy}</strong>
            <span className="ticket-message-meta">
              {ticket.createdByBranch && `${ticket.createdByBranch} · `}
              {new Date(ticket.createdAt).toLocaleString()}
            </span>
          </div>
          <div className="ticket-message-body">{ticket.body}</div>
          {ticket.imageBase64 && (
            <div className="ticket-message-image">
              <button
                type="button"
                onClick={() => setViewImage(ticket.imageBase64!)}
                className="ticket-image-thumb"
              >
                <img src={`data:image/jpeg;base64,${ticket.imageBase64}`} alt="Attachment" />
              </button>
            </div>
          )}
        </div>

        {(ticket.replies || []).map((r: TicketReply) => (
          <div key={r.id} className="ticket-message ticket-message-reply">
            <div className="ticket-message-header">
              <strong>{r.userName}</strong>
              <span className="ticket-message-meta">
                {r.branchName && `${r.branchName} · `}
                {new Date(r.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="ticket-message-body">{r.message}</div>
            {r.imageBase64 && (
              <div className="ticket-message-image">
                <button
                  type="button"
                  onClick={() => setViewImage(r.imageBase64!)}
                  className="ticket-image-thumb"
                >
                  <img src={`data:image/jpeg;base64,${r.imageBase64}`} alt="Attachment" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {ticket.status === 'open' && (
        <form onSubmit={handleReply} className="ticket-reply-form content-card">
          <h3 className="ticket-reply-title">Add reply</h3>
          <div className="ticket-reply-field">
            <label htmlFor="reply-msg">Message</label>
            <textarea
              id="reply-msg"
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              placeholder="Type your reply..."
              rows={3}
              required
            />
          </div>
          <div className="ticket-reply-field">
            <label>Image (optional)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => setReplyImage(e.target.files?.[0] || null)}
            />
            {replyImage && (
              <span className="tickets-file-name">
                {replyImage.name}
                <button type="button" onClick={() => { setReplyImage(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                  ×
                </button>
              </span>
            )}
          </div>
          {replyError && <div className="alert alert-error">{replyError}</div>}
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send reply'}
          </button>
        </form>
      )}

      {viewImage && (
        <div
          className="sales-images-modal-overlay"
          onClick={() => setViewImage(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Escape' && setViewImage(null)}
        >
          <div className="sales-images-modal" onClick={(e) => e.stopPropagation()}>
            <img src={`data:image/jpeg;base64,${viewImage}`} alt="Attachment" className="sales-images-modal-img" />
            <button type="button" className="sales-images-modal-close" onClick={() => setViewImage(null)} aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
