import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../../auth/hooks/useAuth';
import { getCustomer, getCustomerVisitHistory, updateCustomer } from '../../../api/customers';
import { getBranches } from '../../../api/branches';
import type { Customer } from '../../../types/common';
import type { Branch } from '../../../types/common';
import type { VisitHistoryItem } from '../../../api/customers';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEditMode = searchParams.get('edit') === '1';
  const { user } = useAuth();
  const [customer, setCustomer] = useState<(Customer & { primaryBranchId?: string | null }) | null>(null);
  const [visitHistory, setVisitHistory] = useState<VisitHistoryItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const basePath = user?.role === 'admin' ? '/admin' : '/vendor';
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!id) return;
    Promise.all([
      getCustomer(id).then((r) => r.success && 'customer' in r && setCustomer((r as unknown as { customer: Customer & { primaryBranchId?: string | null } }).customer)),
      getCustomerVisitHistory(id).then((r) => r.success && r.visitHistory && setVisitHistory(r.visitHistory || [])),
    ]).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    getBranches({ all: true }).then((r) => r.success && r.branches && setBranches(r.branches || []));
  }, [isAdmin]);

  if (loading || !id) {
    return (
      <div className="dashboard-content">
        <div className="vendors-loading"><div className="spinner" /><span>Loading...</span></div>
      </div>
    );
  }

  if (error && !customer) {
    return (
      <div className="dashboard-content">
        <div className="auth-error">{error}</div>
        <button type="button" className="auth-submit" style={{ marginTop: '1rem' }} onClick={() => navigate(`${basePath}/customers`)}>Back to customers</button>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="dashboard-content">
        <div className="auth-error">Customer not found.</div>
        <button type="button" className="auth-submit" style={{ marginTop: '1rem' }} onClick={() => navigate(`${basePath}/customers`)}>Back to customers</button>
      </div>
    );
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !customer) return;
    setSaveError('');
    setSaving(true);
    const form = e.target as HTMLFormElement;
    const payload: Record<string, unknown> = {
      name: (form.querySelector('[name="name"]') as HTMLInputElement)?.value?.trim(),
      phone: (form.querySelector('[name="phone"]') as HTMLInputElement)?.value?.trim(),
      email: (form.querySelector('[name="email"]') as HTMLInputElement)?.value?.trim() || undefined,
      notes: (form.querySelector('[name="notes"]') as HTMLTextAreaElement)?.value?.trim() || undefined,
    };
    if (isAdmin) {
      const branchVal = (form.querySelector('[name="primaryBranchId"]') as HTMLSelectElement)?.value;
      payload.primaryBranchId = branchVal || null;
    }
    const r = await updateCustomer(id, payload as Parameters<typeof updateCustomer>[1]);
    setSaving(false);
    if (r.success && 'customer' in r) {
      setCustomer({ ...customer, ...(r as unknown as { customer: Customer }).customer });
      navigate(`${basePath}/customers/${id}`, { replace: true });
    } else {
      setSaveError((r as { message?: string }).message || 'Failed to update.');
    }
  }

  return (
    <div className="dashboard-content">
      <section className="content-card">
        <button type="button" className="vendor-name-btn" style={{ marginBottom: '0.5rem' }} onClick={() => navigate(`${basePath}/customers`)}>← Back to customers</button>
        {isEditMode ? (
          <>
            <h2>Edit customer</h2>
            <form onSubmit={handleEditSubmit} className="auth-form" style={{ maxWidth: '420px', marginTop: '1rem' }}>
              <label><span>Name</span><input name="name" defaultValue={customer.name} required /></label>
              <label><span>Phone</span><input name="phone" type="tel" defaultValue={customer.phone} required /></label>
              <label><span>Email (optional)</span><input name="email" type="email" defaultValue={customer.email || ''} /></label>
              <label><span>Notes (optional)</span><textarea name="notes" rows={2} defaultValue={customer.notes || ''} /></label>
              {isAdmin && (
                <label>
                  <span>Primary branch</span>
                  <select name="primaryBranchId" defaultValue={customer.primaryBranchId ?? ''}>
                    <option value="">—</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </label>
              )}
              {saveError && <div className="auth-error vendors-error">{saveError}</div>}
              <button type="submit" className="auth-submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
              <button type="button" className="filter-btn" style={{ marginLeft: '0.5rem' }} onClick={() => navigate(`${basePath}/customers/${id}`, { replace: true })}>Cancel</button>
            </form>
          </>
        ) : (
          <>
            <h2>Customer: {customer.name}</h2>
            <dl className="vendor-detail-dl">
              <dt>Phone</dt>
              <dd>{customer.phone || '—'}</dd>
              <dt>Email</dt>
              <dd>{customer.email || '—'}</dd>
              <dt>Membership card</dt>
              <dd>{customer.membershipCardId || '—'}</dd>
              <dt>Primary branch</dt>
              <dd>{customer.primaryBranch || '—'}</dd>
              <dt>Notes</dt>
              <dd>{customer.notes || '—'}</dd>
            </dl>
            <p style={{ marginTop: '1rem' }}>
              <Link to={`${basePath}/customers/${id}?edit=1`} className="filter-btn">Edit</Link>
              {' '}
              <Link to={`${basePath}/customers/${id}/memberships`} className="filter-btn">View memberships</Link>
              {' '}
              <Link to={`${basePath}/customers/${id}/appointments`} className="filter-btn">View appointments</Link>
            </p>
          </>
        )}
      </section>

      <section className="content-card" style={{ marginTop: '1rem' }}>
        <h3>Visit history & timeline</h3>
        <p className="text-muted">Services, branch, staff, and date for each visit.</p>
        {visitHistory.length === 0 ? (
          <p className="text-muted">No visit history yet.</p>
        ) : (
          <>
            <p className="text-muted" style={{ marginBottom: '0.5rem' }}>{visitHistory.length} visit{visitHistory.length === 1 ? '' : 's'}.</p>
            <ul className="report-list">
              {visitHistory.map((v) => (
                <li key={`${v.type}-${v.id}`}>
                  <strong>{v.date ? new Date(v.date).toLocaleDateString() : '—'}</strong>
                  {' — '}
                  {v.service || '—'}
                  {v.branch ? ` @ ${v.branch}` : ''}
                  {v.staff ? ` (${v.staff})` : ''}
                  {v.creditsUsed != null ? ` · ${v.creditsUsed} credit(s)` : ''}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
