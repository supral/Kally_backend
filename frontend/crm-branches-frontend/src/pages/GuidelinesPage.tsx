import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SimpleRichEditor } from '../components/ui/SimpleRichEditor';
import { getGuidelines, updateGuidelines } from '../api/guidelines';
import { getSettings } from '../api/settings';
import { useAuthStore } from '../auth/auth.store';
import { ROUTES } from '../config/constants';

export default function GuidelinesPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      getGuidelines().then((r) => {
        setLoading(false);
        if (r.success && r.content != null) setContent(r.content);
        else if (!r.success) setMessage({ type: 'error', text: r.message || 'Failed to load guidelines.' });
      });
      return;
    }
    getSettings().then((r) => {
      if (r.success && r.settings && r.settings.showGuidelinesInVendorDashboard === false) {
        navigate(ROUTES.vendor.root, { replace: true });
        return;
      }
      getGuidelines().then((g) => {
        setLoading(false);
        if (g.success && g.content != null) setContent(g.content);
        else if (!g.success) setMessage({ type: 'error', text: g.message || 'Failed to load guidelines.' });
      });
    }).catch(() => {
      getGuidelines().then((g) => {
        setLoading(false);
        if (g.success && g.content != null) setContent(g.content);
        else if (!g.success) setMessage({ type: 'error', text: g.message || 'Failed to load guidelines.' });
      });
    });
  }, [isAdmin, navigate]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const r = await updateGuidelines(content);
    setSaving(false);
    if (r.success) {
      setMessage({ type: 'success', text: 'Guidelines saved.' });
      if (r.content != null) setContent(r.content);
    } else {
      setMessage({ type: 'error', text: r.message || 'Failed to save guidelines.' });
    }
  };

  if (loading) {
    return (
      <div className="dashboard-content guidelines-page">
        <header className="page-hero">
          <h1 className="page-hero-title">Guidelines</h1>
          <p className="page-hero-subtitle">Loading...</p>
        </header>
        <section className="content-card">
          <div className="vendors-loading"><div className="spinner" /><span>Loading guidelines...</span></div>
        </section>
      </div>
    );
  }

  return (
    <div className="dashboard-content guidelines-page">
      <header className="page-hero">
        <h1 className="page-hero-title">Guidelines</h1>
        <p className="page-hero-subtitle">
          {isAdmin
            ? 'How to use the system. Edit the content below and click Save to update for all users.'
            : 'How to use the system. Read-only for branch users.'}
        </p>
      </header>

      <section className="content-card guidelines-card">
        {message && (
          <p
            className={`guidelines-message ${message.type === 'error' ? 'guidelines-message-error' : 'guidelines-message-success'}`}
            role="status"
          >
            {message.text}
          </p>
        )}

        {isAdmin ? (
          <>
            <div className="guidelines-editor-wrap">
              <SimpleRichEditor
                value={content}
                onChange={setContent}
                placeholder="Enter guidelines content…"
                minHeight="320px"
                className="guidelines-quill"
              />
            </div>
            <div className="guidelines-actions">
              <button
                type="button"
                className="auth-submit"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save guidelines'}
              </button>
            </div>
          </>
        ) : (
          <div
            className="guidelines-content"
            dangerouslySetInnerHTML={{ __html: content || '<p>No guidelines content yet. Ask your admin to add guidelines from the Guidelines page.</p>' }}
          />
        )}
      </section>
    </div>
  );
}
