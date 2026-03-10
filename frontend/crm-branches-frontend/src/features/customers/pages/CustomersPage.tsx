import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCustomers, createCustomer, deleteCustomer } from '../../../api/customers';
import { getBranches } from '../../../api/branches';
import { getSettings } from '../../../api/settings';
import { useAuth } from '../../../auth/hooks/useAuth';
import type { Customer, Branch } from '../../../types/common';

export default function CustomersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [primaryBranchId, setPrimaryBranchId] = useState('');
  const [notes, setNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilterId, setBranchFilterId] = useState('');
  const [page, setPage] = useState(1);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: number; fail: number; skipped: number } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [showImportButton, setShowImportButton] = useState(true);
  const [showExportButton, setShowExportButton] = useState(true);
  const [showCustomerDeleteToAdmin, setShowCustomerDeleteToAdmin] = useState(true);
  const [showCustomerDeleteToVendor, setShowCustomerDeleteToVendor] = useState(true);
  const [showCustomerDeleteToStaff, setShowCustomerDeleteToStaff] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isAdmin = user?.role === 'admin';
  const role = user?.role;
  const showDeleteButton =
    (role === 'admin' && showCustomerDeleteToAdmin) ||
    (role === 'vendor' && showCustomerDeleteToVendor) ||
    ((role as string) === 'staff' && showCustomerDeleteToStaff);
  const PAGE_SIZE = 10;
  const basePath = isAdmin ? '/admin' : '/vendor';

  const { filteredCustomers, totalFiltered, totalPages, currentPage, paginatedCustomers } = useMemo(() => {
    const selectedBranchName = branchFilterId ? branches.find((b) => b.id === branchFilterId)?.name : null;
    const byBranch = branchFilterId
      ? customers.filter((c) => c.primaryBranch === selectedBranchName)
      : customers;
    const searchLower = searchQuery.trim().toLowerCase();
    const filtered = searchLower
      ? byBranch.filter((c) => {
          const card = (c.membershipCardId || '').toLowerCase();
          const n = (c.name || '').toLowerCase();
          const p = (c.phone || '').toLowerCase();
          const e = (c.email || '').toLowerCase();
          return card.includes(searchLower) || n.includes(searchLower) || p.includes(searchLower) || e.includes(searchLower);
        })
      : byBranch;
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const current = Math.min(Math.max(1, page), pages);
    const paginated = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
    return {
      filteredCustomers: filtered,
      totalFiltered: total,
      totalPages: pages,
      currentPage: current,
      paginatedCustomers: paginated,
    };
  }, [customers, branches, branchFilterId, searchQuery, page, PAGE_SIZE]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, branchFilterId]);

  const fetchCustomers = useCallback(() => {
    getCustomers().then((r) => {
      setLoading(false);
      if (r.success && r.customers) setCustomers(r.customers);
      else setError(r.message || 'Failed to load');
    });
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchCustomers();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [fetchCustomers]);

  useEffect(() => {
    getBranches({ all: true }).then((r) => r.success && r.branches && setBranches(r.branches || []));
  }, []);

  useEffect(() => {
    getSettings().then((r) => {
      if (r.success && r.settings) {
        if (typeof r.settings.showImportButton === 'boolean') setShowImportButton(r.settings.showImportButton);
        if (typeof r.settings.showExportButton === 'boolean') setShowExportButton(r.settings.showExportButton);
        if (typeof r.settings.showCustomerDeleteToAdmin === 'boolean') setShowCustomerDeleteToAdmin(r.settings.showCustomerDeleteToAdmin);
        if (typeof r.settings.showCustomerDeleteToVendor === 'boolean') setShowCustomerDeleteToVendor(r.settings.showCustomerDeleteToVendor);
        if (typeof r.settings.showCustomerDeleteToStaff === 'boolean') setShowCustomerDeleteToStaff(r.settings.showCustomerDeleteToStaff);
      }
    });
  }, []);

  async function handleDeleteCustomer(customerId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm('Delete this customer? This cannot be undone.')) return;
    setError('');
    setDeletingId(customerId);
    const res = await deleteCustomer(customerId);
    setDeletingId(null);
    if (res.success) fetchCustomers();
    else setError(res.message || 'Failed to delete customer.');
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await createCustomer({
      name,
      phone,
      email: email || undefined,
      primaryBranchId: primaryBranchId || (user?.branchId || undefined),
      notes: notes || undefined,
    });
    if (res.success) {
      setName('');
      setPhone('');
      setEmail('');
      setPrimaryBranchId('');
      setNotes('');
      setShowForm(false);
      getCustomers().then((r) => r.success && r.customers && setCustomers(r.customers));
    } else setError((res as { message?: string }).message || 'Failed to create');
  }

  function escapeCsvCell(value: string): string {
    const s = String(value ?? '').replace(/"/g, '""');
    return /[,"\n\r]/.test(s) ? `"${s}"` : s;
  }

  type ImportRow = Record<string, unknown>;

  function extractCustomerRows(parsed: unknown): ImportRow[] {
    if (Array.isArray(parsed)) {
      const tableObj = parsed.find((item) => item && typeof item === 'object' && (item as { type?: string; name?: string }).type === 'table' && Array.isArray((item as { data?: unknown[] }).data));
      if (tableObj) return (tableObj as { data: ImportRow[] }).data;
      return parsed;
    }
    if (parsed && typeof parsed === 'object') {
      const o = parsed as Record<string, unknown>;
      if (Array.isArray(o.customers)) return o.customers as ImportRow[];
      if (Array.isArray(o.data)) return o.data as ImportRow[];
    }
    return [];
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setImportResult(null);
    setImporting(true);
    let ok = 0, fail = 0, skipped = 0;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const rows = extractCustomerRows(parsed);
      if (rows.length === 0) { setError('No customer data found. Expected array, { customers: [...] }, { data: [...] }, or PHPMyAdmin table export.'); setImporting(false); return; }

      const str = (v: unknown) => (v != null && v !== '' ? String(v).trim() : '');
      const legacyMap: Record<string, string> = JSON.parse(localStorage.getItem('customerLegacyIdMap') || '{}');
      for (const row of rows) {
        const name = str(row.customer_name ?? row.name ?? row.customerName);
        const phone = str(row.contact ?? row.phone ?? row.Phone ?? row.Contact);
        if (!name || !phone) { skipped++; continue; }
        const res = await createCustomer({
          name,
          phone,
          email: str(row.email) || undefined,
          notes: str(row.address ?? row.notes) || undefined,
          primaryBranchId: user?.branchId || undefined,
        });
        if (res.success) {
          ok++;
          const oldId = str(row.id);
          if (oldId && (res as unknown as { customer?: { id?: string } }).customer?.id) {
            legacyMap[oldId] = (res as unknown as { customer: { id: string } }).customer.id;
          }
        } else fail++;
      }
      if (Object.keys(legacyMap).length > 0) localStorage.setItem('customerLegacyIdMap', JSON.stringify(legacyMap));
      setImportResult({ ok, fail, skipped });
      if (ok > 0) fetchCustomers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON file');
    }
    setImporting(false);
  }

  function exportToCsv() {
    const headers = ['Card ID', 'Name', 'Phone', 'Email', 'Branch'];
    const rows = filteredCustomers.map((c) =>
      [c.membershipCardId ?? '—', c.name ?? '—', c.phone ?? '—', c.email ?? '—', c.primaryBranch ?? '—'].map(escapeCsvCell)
    );
    const csv = [headers.map(escapeCsvCell).join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="dashboard-content">
        <div className="vendors-loading"><div className="spinner" /><span>Loading customers...</span></div>
      </div>
    );
  }

  return (
    <div className="dashboard-content customers-page">
      <header className="page-hero">
        <h1 className="page-hero-title">Customers</h1>
        <p className="page-hero-subtitle">Customer list. Add customers here; assign package and membership from the Memberships page.</p>
      </header>
      <section className="content-card">
        <div className="customers-top-actions">
          <button type="button" className="auth-submit" style={{ width: 'auto' }} onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'Add customer'}
          </button>
          {showImportButton && (
            <label className="customers-import-btn">
              <input
                ref={importInputRef}
                type="file"
                accept=".json,application/json"
                className="customers-import-input"
                aria-label="Import customers from JSON"
                onChange={handleImportFile}
                disabled={importing}
              />
              {importing ? 'Importing…' : 'Import from JSON'}
            </label>
          )}
        </div>
        {importResult && (
          <p className="customers-import-result">
            Import complete: {importResult.ok} created, {importResult.fail} failed, {importResult.skipped} skipped (missing name/phone).
          </p>
        )}
        {showForm && (
          <form onSubmit={handleCreate} className="auth-form" style={{ marginBottom: '1rem', maxWidth: '400px' }}>
            <label><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} required /></label>
            <label><span>Phone</span><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required /></label>
            <label><span>Email (optional)</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label><span>Notes (optional)</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></label>
            <p className="form-hint">Card ID is auto-generated from the branch (e.g. tes-00001) after you create the customer.</p>
            {isAdmin && (
              <label>
                <span>Primary branch</span>
                <select value={primaryBranchId} onChange={(e) => setPrimaryBranchId(e.target.value)}>
                  <option value="">—</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
            )}
            <button type="submit" className="auth-submit">Create customer</button>
          </form>
        )}
        {error && <div className="auth-error vendors-error">{error}</div>}
        {customers.length > 0 ? (
          <>
            <div className="customers-filters">
              {isAdmin && (
                <label>
                  <span>Branch</span>
                  <select
                    value={branchFilterId}
                    onChange={(e) => setBranchFilterId(e.target.value)}
                    aria-label="Filter customers by branch"
                  >
                    <option value="">All customers</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </label>
              )}
              <div className="customers-search-group">
                <label className="customers-search-label">
                  <span>Search by Card ID, name, phone or email</span>
                  <input
                    type="search"
                    className="customers-search-input"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Search customers by card ID, name, phone or email"
                  />
                </label>
                <button type="button" className="customers-search-btn" onClick={() => document.querySelector<HTMLInputElement>('.customers-search-input')?.focus()}>
                  Search
                </button>
              </div>
              {showExportButton && (
                <button
                  type="button"
                  className="customers-export-btn"
                  onClick={exportToCsv}
                  disabled={totalFiltered === 0}
                  title={totalFiltered === 0 ? 'No data to export' : 'Export filtered customers to CSV/Excel'}
                >
                  Export to CSV / Excel
                </button>
              )}
              {showImportButton && (
                <label className="customers-import-btn customers-import-btn-inline">
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="customers-import-input"
                    aria-label="Import customers from JSON"
                    onChange={handleImportFile}
                    disabled={importing}
                  />
                  {importing ? 'Importing…' : 'Import from JSON'}
                </label>
              )}
            </div>
            {totalFiltered > 0 && (
              <p className="customers-showing-count text-muted">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalFiltered)} of {totalFiltered} customer{totalFiltered !== 1 ? 's' : ''}
              </p>
            )}
            {/* Mobile: card list */}
            <div className="customers-mobile-cards">
              {paginatedCustomers.map((c) => (
                <div
                  key={c.id}
                  className="customer-mobile-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`${basePath}/customers/${c.id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`${basePath}/customers/${c.id}`); } }}
                >
                  <div className="customer-mobile-card-main">
                    <div className="customer-mobile-card-row">
                      <span className="customer-mobile-label">Card ID</span>
                      <span className="customer-mobile-value">{c.membershipCardId || '—'}</span>
                    </div>
                    <div className="customer-mobile-card-row">
                      <span className="customer-mobile-label">Name</span>
                      <span className="customer-mobile-value"><strong>{c.name}</strong></span>
                    </div>
                    <div className="customer-mobile-card-row">
                      <span className="customer-mobile-label">Phone</span>
                      <span className="customer-mobile-value">{c.phone}</span>
                    </div>
                    <div className="customer-mobile-card-row">
                      <span className="customer-mobile-label">Email</span>
                      <span className="customer-mobile-value">{c.email || '—'}</span>
                    </div>
                    <div className="customer-mobile-card-row">
                      <span className="customer-mobile-label">Branch</span>
                      <span className="customer-mobile-value">{c.primaryBranch || '—'}</span>
                    </div>
                  </div>
                  <div className="customer-mobile-card-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="filter-btn"
                      onClick={() => navigate(`${basePath}/customers/${c.id}`)}
                      title="View customer"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="filter-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`${basePath}/memberships?customerId=${c.id}`);
                      }}
                      title="Create membership"
                    >
                      Create membership
                    </button>
                    {showDeleteButton && (
                      <button
                        type="button"
                        className="filter-btn btn-danger btn-sm"
                        onClick={(e) => handleDeleteCustomer(c.id, e)}
                        disabled={deletingId === c.id}
                        title="Delete customer"
                      >
                        {deletingId === c.id ? 'Deleting…' : 'Delete'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop: table */}
            <div className="data-table-wrap customers-table-wrap">
              <table className="data-table customers-table">
                <thead>
                  <tr>
                    <th>Card ID</th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Branch</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCustomers.map((c) => (
                      <tr
                        key={c.id}
                        className="customers-row-clickable"
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`${basePath}/customers/${c.id}`)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`${basePath}/customers/${c.id}`); } }}
                      >
                        <td>{c.membershipCardId || '—'}</td>
                        <td><strong>{c.name}</strong></td>
                        <td>{c.phone}</td>
                        <td>{c.email || '—'}</td>
                        <td>{c.primaryBranch || '—'}</td>
                        <td>
                          <button
                            type="button"
                            className="filter-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`${basePath}/memberships?customerId=${c.id}`);
                            }}
                          >
                            Create membership
                          </button>
                          {showDeleteButton && (
                            <button
                              type="button"
                              className="filter-btn btn-danger btn-sm"
                              onClick={(e) => handleDeleteCustomer(c.id, e)}
                              disabled={deletingId === c.id}
                            >
                              {deletingId === c.id ? 'Deleting…' : 'Delete'}
                            </button>
                          )}
                        </td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="customers-pagination">
                <button
                  type="button"
                  className="pagination-btn"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  aria-label="Previous page"
                >
                  Previous
                </button>
                <span className="pagination-info">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  className="pagination-btn"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  aria-label="Next page"
                >
                  Next
                </button>
              </div>
            )}
            {filteredCustomers.length === 0 && (
              <p className="vendors-empty">
                {searchQuery.trim()
                  ? `No customers match "${searchQuery.trim()}".`
                  : branchFilterId
                    ? `No customers in this branch.`
                    : 'No customers.'}
              </p>
            )}
          </>
        ) : !showForm && <p className="vendors-empty">No customers. Add a customer, then assign package and membership from the Memberships page.</p>}
      </section>
    </div>
  );
}
