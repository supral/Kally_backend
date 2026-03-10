import { useEffect, useState } from 'react';
import { getLeads, createLead, bulkDeleteLeads } from '../../../api/leads';
import { getLeadStatuses } from '../../../api/leadStatuses';
import { getBranches } from '../../../api/branches';
import { getServices } from '../../../api/services';
import { useAuth } from '../../../auth/hooks/useAuth';
import { Link } from 'react-router-dom';
import type { Lead, Branch } from '../../../types/common';
import type { LeadStatusItem } from '../../../api/leadStatuses';
import type { Service } from '../../../types/crm';

const SOURCE_OPTIONS = [
  { value: 'walk-in', label: 'Walk-in' },
  { value: 'call', label: 'Call' },
  { value: 'website', label: 'Website' },
  { value: 'ad', label: 'Ad' },
  { value: 'other', label: 'Other' },
];

export default function LeadsPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [leadStatuses, setLeadStatuses] = useState<LeadStatusItem[]>([]);
  const [branchId, setBranchId] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addSource, setAddSource] = useState('other');
  const [addBranchId, setAddBranchId] = useState('');
  const [addServiceId, setAddServiceId] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addMessage, setAddMessage] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const basePath = user?.role === 'admin' ? '/admin' : '/vendor';
  const isAdmin = user?.role === 'admin';
  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(leads.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const paginatedLeads = leads.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [branchId, status, source, serviceId, search, dateFrom, dateTo]);

  useEffect(() => {
    getBranches({ all: true }).then((r) => r.success && r.branches && setBranches(r.branches || []));
    getLeadStatuses().then((r) => r.success && r.leadStatuses && setLeadStatuses(r.leadStatuses || []));
    getServices().then((r) => r.success && r.services && setServices(r.services || []));
  }, []);

  useEffect(() => {
    setLoading(true);
    getLeads({
      branchId: branchId || undefined,
      status: status || undefined,
      source: source || undefined,
      serviceId: serviceId || undefined,
      search: search.trim() || undefined,
      from: dateFrom || undefined,
      to: dateTo || undefined,
    }).then((r) => {
      setLoading(false);
      if (r.success && r.leads) setLeads(r.leads);
      else setError(r.message || 'Failed to load');
    });
  }, [branchId, status, source, serviceId, search, dateFrom, dateTo]);

  async function handleAddLead(e: React.FormEvent) {
    e.preventDefault();
    if (!addName.trim()) {
      setAddMessage('Name is required.');
      return;
    }
    if (isAdmin && !addBranchId) {
      setAddMessage('Branch is required.');
      return;
    }
    setAddSubmitting(true);
    setAddMessage('');
    const res = await createLead({
      name: addName.trim(),
      phone: addPhone.trim() || undefined,
      email: addEmail.trim() || undefined,
      source: addSource,
      branchId: isAdmin ? addBranchId || undefined : undefined,
      serviceId: addServiceId || undefined,
      notes: addNotes.trim() || undefined,
    });
    setAddSubmitting(false);
    if (res.success) {
      setAddName('');
      setAddPhone('');
      setAddEmail('');
      setAddSource('other');
      setAddBranchId('');
      setAddServiceId('');
      setAddNotes('');
      setShowForm(false);
      setSelectedIds(new Set());
      getLeads({ branchId: branchId || undefined, status: status || undefined, source: source || undefined, serviceId: serviceId || undefined, search: search.trim() || undefined, from: dateFrom || undefined, to: dateTo || undefined }).then((r) => r.success && r.leads && setLeads(r.leads));
    } else setAddMessage((res as { message?: string }).message || 'Failed to add lead.');
  }

  const refetch = () => {
    getLeads({
      branchId: branchId || undefined,
      status: status || undefined,
      source: source || undefined,
      serviceId: serviceId || undefined,
      search: search.trim() || undefined,
      from: dateFrom || undefined,
      to: dateTo || undefined,
    }).then((r) => r.success && r.leads && setLeads(r.leads || []));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedLeads.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(paginatedLeads.map((l) => l.id)));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected lead(s)? This cannot be undone.`)) return;
    setDeleteSubmitting(true);
    const res = await bulkDeleteLeads(Array.from(selectedIds));
    setDeleteSubmitting(false);
    if (res.success) {
      setSelectedIds(new Set());
      refetch();
    } else setError(res.message || 'Failed to delete leads.');
  };

  return (
    <div className="dashboard-content">
      <section className="content-card">
        <header className="page-hero" style={{ marginBottom: '1rem' }}>
          <h1 className="page-hero-title">Lead inbox</h1>
          <p className="page-hero-subtitle">{isAdmin ? 'All leads by branch. Filter and add new leads.' : 'Your branch leads and follow-ups.'}</p>
        </header>
        <div className="vendors-filters" style={{ marginTop: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem', display: 'flex', alignItems: 'center' }}>
          <input type="text" placeholder="Search name, phone, email..." value={search} onChange={(e) => setSearch(e.target.value)} className="filter-btn" style={{ minWidth: '180px' }} />
          {isAdmin && (
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="filter-btn">
              <option value="">All branches</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <select value={source} onChange={(e) => setSource(e.target.value)} className="filter-btn">
            <option value="">All sources</option>
            {SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="filter-btn">
            <option value="">All statuses</option>
            {leadStatuses.length > 0
              ? leadStatuses.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)
              : ['New', 'Contacted', 'Call not Connected', 'Follow up', 'Booked', 'Lost'].map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="filter-btn">
            <option value="">All services</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span className="text-muted" style={{ fontSize: '0.9rem' }}>From</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="filter-btn" />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span className="text-muted" style={{ fontSize: '0.9rem' }}>To</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="filter-btn" />
          </label>
          <button type="button" className="auth-submit" style={{ width: 'auto', marginLeft: '0.5rem' }} onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'Add lead'}
          </button>
          {isAdmin && selectedIds.size > 0 && (
            <button type="button" className="btn-reject" style={{ marginLeft: '0.5rem' }} onClick={handleBulkDelete} disabled={deleteSubmitting}>
              {deleteSubmitting ? 'Deleting…' : `Delete ${selectedIds.size} selected`}
            </button>
          )}
        </div>
        {showForm && (
          <form onSubmit={handleAddLead} className="auth-form" style={{ maxWidth: '480px', marginBottom: '1.5rem', padding: '1rem', border: '1px solid var(--theme-border)', borderRadius: '8px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>New lead</h3>
            <label><span>Name (required)</span><input value={addName} onChange={(e) => setAddName(e.target.value)} required placeholder="Lead name" /></label>
            <label><span>Phone</span><input type="tel" value={addPhone} onChange={(e) => setAddPhone(e.target.value)} placeholder="Phone" /></label>
            <label><span>Email</span><input type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="Email" /></label>
            <label>
              <span>Source</span>
              <select value={addSource} onChange={(e) => setAddSource(e.target.value)}>
                {SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            {isAdmin && (
              <label>
                <span>Branch (required)</span>
                <select value={addBranchId} onChange={(e) => setAddBranchId(e.target.value)} required>
                  <option value="">— Select branch —</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
            )}
            <label>
              <span>Service</span>
              <select value={addServiceId} onChange={(e) => setAddServiceId(e.target.value)}>
                <option value="">— None —</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <label><span>Notes</span><textarea value={addNotes} onChange={(e) => setAddNotes(e.target.value)} rows={2} placeholder="Notes" /></label>
            {addMessage && <p className="text-muted" style={{ marginBottom: '0.5rem' }}>{addMessage}</p>}
            <button type="submit" className="auth-submit" disabled={addSubmitting}>{addSubmitting ? 'Adding…' : 'Add lead'}</button>
          </form>
        )}
        {error && <div className="auth-error vendors-error">{error}</div>}
        {loading ? (
          <div className="vendors-loading"><div className="spinner" /><span>Loading leads...</span></div>
        ) : leads.length === 0 ? (
          <p className="vendors-empty">No leads.</p>
        ) : (
          <>
            <p className="customers-showing-count text-muted">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, leads.length)} of {leads.length} lead{leads.length !== 1 ? 's' : ''}
            </p>
            <div className="vendors-table-wrap" style={{ marginTop: '1rem' }}>
              <table className="vendors-table">
                <thead>
                  <tr>
                    {isAdmin && (
                      <th>
                        <input type="checkbox" checked={paginatedLeads.length > 0 && selectedIds.size === paginatedLeads.length} onChange={toggleSelectAll} aria-label="Select all" />
                      </th>
                    )}
                    <th>Name</th><th>Phone</th><th>Source</th>{isAdmin && <th>Branch</th>}<th>Service</th><th>Status</th><th>Follow-ups</th><th>Created</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLeads.map((l) => (
                  <tr key={l.id}>
                    {isAdmin && (
                      <td>
                        <input type="checkbox" checked={selectedIds.has(l.id)} onChange={() => toggleSelect(l.id)} aria-label={`Select ${l.name}`} />
                      </td>
                    )}
                    <td>{l.name}</td>
                    <td>{l.phone || '—'}</td>
                    <td>{l.source}</td>
                    {isAdmin && <td>{l.branch || '—'}</td>}
                    <td>{l.service || '—'}</td>
                    <td><span className={`status-badge status-${l.status === 'Booked' ? 'approved' : l.status === 'Lost' ? 'rejected' : 'pending'}`}>{l.status}</span></td>
                    <td>{l.followUpsCount ?? 0}</td>
                    <td>{new Date(l.createdAt).toLocaleDateString()}</td>
                    <td><Link to={`${basePath}/leads/${l.id}`}>View</Link></td>
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
    </div>
  );
}
