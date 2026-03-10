import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { getPackages, createPackage, updatePackage, deletePackage } from '../../../api/packages';
import { getSettings } from '../../../api/settings';
import { useAuth } from '../../../auth/hooks/useAuth';
import { formatCurrency } from '../../../utils/money';
import type { PackageItem } from '../../../api/packages';

function computeSettlementAmount(price: number, discountAmount: number, totalSessions: number): number | undefined {
  if (!totalSessions || totalSessions <= 0) return undefined;
  return (price + discountAmount) / (2 * totalSessions);
}

export default function AdminPackagesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [totalSessions, setTotalSessions] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDiscountAmount, setEditDiscountAmount] = useState('');
  const [editTotalSessions, setEditTotalSessions] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: number; fail: number; skipped: number } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [showImportButton, setShowImportButton] = useState(true);
  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(packages.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const paginatedPackages = packages.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const loadPackages = useCallback(() => {
    getPackages(isAdmin).then((r) => {
      setLoading(false);
      if (r.success && r.packages) setPackages(r.packages);
      else setError(r.message || 'Failed to load packages');
    });
  }, [isAdmin]);

  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  useEffect(() => {
    getSettings().then((r) => {
      if (r.success && r.settings && typeof r.settings.showImportButton === 'boolean') {
        setShowImportButton(r.settings.showImportButton);
      }
    });
  }, []);

  const calculatedSettlement = useMemo(() => {
    const p = parseFloat(price);
    const d = discountAmount.trim() ? parseFloat(discountAmount) : 0;
    const s = parseInt(totalSessions, 10);
    if (isNaN(p) || p < 0 || isNaN(d) || d < 0 || !s || s < 1) return undefined;
    return computeSettlementAmount(p, d, s);
  }, [price, discountAmount, totalSessions]);

  const editCalculatedSettlement = useMemo(() => {
    if (!editingId) return undefined;
    const p = parseFloat(editPrice);
    const d = editDiscountAmount.trim() ? parseFloat(editDiscountAmount) : 0;
    const s = parseInt(editTotalSessions, 10);
    if (isNaN(p) || p < 0 || isNaN(d) || d < 0 || !s || s < 1) return undefined;
    return computeSettlementAmount(p, d, s);
  }, [editingId, editPrice, editDiscountAmount, editTotalSessions]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const numPrice = parseFloat(price);
    const numDiscount = discountAmount.trim() ? parseFloat(discountAmount) : 0;
    const numSessions = parseInt(totalSessions, 10);
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (isNaN(numPrice) || numPrice < 0) {
      setError('Price must be a non-negative number.');
      return;
    }
    if (isNaN(numDiscount) || numDiscount < 0) {
      setError('Discount amount must be 0 or greater.');
      return;
    }
    if (!numSessions || numSessions < 1) {
      setError('No. of sessions is required and must be at least 1.');
      return;
    }
    const res = await createPackage({ name: name.trim(), price: numPrice, discountAmount: numDiscount, totalSessions: numSessions });
    if (res.success) {
      setName('');
      setPrice('');
      setDiscountAmount('');
      setTotalSessions('');
      setShowForm(false);
      loadPackages();
    } else setError((res as { message?: string }).message || 'Failed to create');
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setError('');
    const numPrice = parseFloat(editPrice);
    const numDiscount = editDiscountAmount.trim() ? parseFloat(editDiscountAmount) : 0;
    const numSessions = parseInt(editTotalSessions, 10);
    if (!editName.trim()) {
      setError('Name is required.');
      return;
    }
    if (isNaN(numPrice) || numPrice < 0) {
      setError('Price must be a non-negative number.');
      return;
    }
    if (isNaN(numDiscount) || numDiscount < 0) {
      setError('Discount amount must be 0 or greater.');
      return;
    }
    if (!numSessions || numSessions < 1) {
      setError('No. of sessions must be at least 1.');
      return;
    }
    const res = await updatePackage(editingId, { name: editName.trim(), price: numPrice, discountAmount: numDiscount, totalSessions: numSessions });
    if (res.success) {
      setEditingId(null);
      loadPackages();
    } else setError((res as { message?: string }).message || 'Failed to update');
  }

  async function handleDelete(id: string) {
    setError('');
    const res = await deletePackage(id);
    setDeleteConfirmId(null);
    if (res.success) loadPackages();
    else setError((res as { message?: string }).message || 'Failed to delete');
  }

  function extractPackageRows(parsed: unknown): Record<string, unknown>[] {
    if (Array.isArray(parsed)) {
      const tableObj = parsed.find(
        (item) => item && typeof item === 'object' && (item as { type?: string; name?: string }).type === 'table' && (item as { name?: string }).name === 'packages'
          && Array.isArray((item as { data?: unknown[] }).data)
      );
      if (tableObj) return (tableObj as { data: Record<string, unknown>[] }).data;
      return parsed;
    }
    if (parsed && typeof parsed === 'object') {
      const o = parsed as Record<string, unknown>;
      if (Array.isArray(o.data)) return o.data as Record<string, unknown>[];
      if (Array.isArray(o.packages)) return o.packages as Record<string, unknown>[];
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
    const legacyMap: Record<string, string> = JSON.parse(localStorage.getItem('packageLegacyIdMap') || '{}');
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const rows = extractPackageRows(parsed);
      if (rows.length === 0) {
        setError('No package data found. Expected PHPMyAdmin export for "packages" or { data: [...] }.');
        setImporting(false);
        return;
      }
      const str = (v: unknown) => (v != null && v !== '' ? String(v).trim() : '');
      for (const row of rows) {
        const name = str(row.package_name ?? row.name);
        const priceStr = str(row.price);
        const discountStr = str(row.discount ?? row.discountAmount);
        const sessionsStr = str(row.total_sessions ?? row.totalSessions);
        if (!name || !priceStr || !sessionsStr) { skipped++; continue; }
        const numPrice = parseFloat(priceStr);
        const numDiscount = discountStr ? parseFloat(discountStr) : 0;
        const numSessions = parseInt(sessionsStr, 10);
        if (Number.isNaN(numPrice) || numPrice < 0 || Number.isNaN(numSessions) || numSessions < 1 || Number.isNaN(numDiscount) || numDiscount < 0) {
          skipped++;
          continue;
        }
        const res = await createPackage({ name: name.trim(), price: numPrice, discountAmount: numDiscount, totalSessions: numSessions });
        if (res.success) {
          ok++;
          const oldId = str(row.id);
          if (oldId && (res as unknown as { package?: { id?: string } }).package?.id) {
            legacyMap[oldId] = (res as unknown as { package: { id: string } }).package.id;
          }
        } else fail++;
      }
      if (Object.keys(legacyMap).length > 0) localStorage.setItem('packageLegacyIdMap', JSON.stringify(legacyMap));
      setImportResult({ ok, fail, skipped });
      if (ok > 0) loadPackages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON file');
    }
    setImporting(false);
  }

  if (loading) {
    return (
      <div className="dashboard-content">
        <div className="vendors-loading"><div className="spinner" /><span>Loading packages...</span></div>
      </div>
    );
  }

  return (
    <div className="dashboard-content packages-page">
      <header className="page-hero packages-page-hero">
        <div className="packages-page-hero-top">
          <div>
            <h1 className="page-hero-title">Customer packages</h1>
            <p className="page-hero-subtitle">Add and manage packages and prices. Vendors can only choose from this list when creating customers.</p>
          </div>
          <div className="packages-hero-actions">
            <button
              type="button"
              className={`packages-page-cta ${showForm ? 'packages-page-cta-secondary' : ''}`}
              onClick={() => { setShowForm(!showForm); setError(''); }}
            >
              {showForm ? 'Cancel' : 'Add package'}
            </button>
            {isAdmin && showImportButton && (
              <label className="packages-import-btn">
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="packages-import-input"
                  aria-label="Import packages from JSON"
                  onChange={handleImportFile}
                  disabled={importing}
                />
                {importing ? 'Importing…' : 'Import from JSON'}
              </label>
            )}
          </div>
        </div>
      </header>

      {showForm && (
        <section className="content-card packages-page-form-card">
          <h2 className="packages-page-form-title">New package</h2>
          <form onSubmit={handleCreate} className="packages-page-form">
            <label>
              <span>Package name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Basic, Premium" required />
            </label>
            <label>
              <span>Price</span>
              <input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" required />
            </label>
            <label>
              <span>Discount amount</span>
              <input type="number" min={0} step="0.01" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} placeholder="0.00" />
            </label>
            <label>
              <span>No. of sessions</span>
              <input type="number" min={1} step={1} value={totalSessions} onChange={(e) => setTotalSessions(e.target.value)} placeholder="e.g. 5" required />
            </label>
            <label>
              <span>Settlement amount (calculated)</span>
              <input type="text" value={calculatedSettlement != null ? formatCurrency(calculatedSettlement) : '—'} readOnly className="readonly-input" aria-readonly />
            </label>
            <button type="submit" className="auth-submit packages-page-submit">Create package</button>
          </form>
        </section>
      )}

      {error && <div className="auth-error packages-page-error" role="alert">{error}</div>}

      {importResult && (
        <section className="content-card packages-import-result-card">
          <p className="packages-import-result">
            Import complete: {importResult.ok} created, {importResult.fail} failed, {importResult.skipped} skipped (missing or invalid fields).
          </p>
        </section>
      )}

      <section className="content-card packages-page-table-card">
        {packages.length > 0 ? (
          <>
            <p className="packages-page-count text-muted">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, packages.length)} of {packages.length} package{packages.length !== 1 ? 's' : ''}
            </p>
            {/* Mobile: card list */}
            <div className="packages-mobile-cards">
              {editingId && isAdmin && (
                <div className="packages-mobile-edit-form">
                  <h3 className="packages-mobile-edit-title">Edit package</h3>
                  <form onSubmit={handleUpdate} className="packages-page-inline-form">
                    <label><span>Name</span><input value={editName} onChange={(e) => setEditName(e.target.value)} required /></label>
                    <label><span>Price</span><input type="number" min={0} step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} required /></label>
                    <label><span>Discount amount</span><input type="number" min={0} step="0.01" value={editDiscountAmount} onChange={(e) => setEditDiscountAmount(e.target.value)} placeholder="0" /></label>
                    <label><span>No. of sessions</span><input type="number" min={1} step={1} value={editTotalSessions} onChange={(e) => setEditTotalSessions(e.target.value)} required /></label>
                    <label><span>Settlement (calculated)</span><input type="text" value={editCalculatedSettlement != null ? formatCurrency(editCalculatedSettlement) : '—'} readOnly className="readonly-input" /></label>
                    <div className="packages-page-inline-actions">
                      <button type="submit" className="filter-btn packages-btn-save">Save</button>
                      <button type="button" className="filter-btn" onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  </form>
                </div>
              )}
              {paginatedPackages.map((p) => (
                <div key={p.id} className="package-mobile-card">
                  <div className="package-mobile-card-main">
                    <div className="package-mobile-card-row">
                      <span className="package-mobile-label">Name</span>
                      <span className="package-mobile-value"><strong>{p.name}</strong></span>
                    </div>
                    <div className="package-mobile-card-row">
                      <span className="package-mobile-label">Price</span>
                      <span className="package-mobile-value">{formatCurrency(p.price)}</span>
                    </div>
                    <div className="package-mobile-card-row">
                      <span className="package-mobile-label">Discount</span>
                      <span className="package-mobile-value">{(p.discountAmount ?? 0) > 0 ? formatCurrency(p.discountAmount!) : '—'}</span>
                    </div>
                    <div className="package-mobile-card-row">
                      <span className="package-mobile-label">Sessions</span>
                      <span className="package-mobile-value">{p.totalSessions ?? '—'}</span>
                    </div>
                    <div className="package-mobile-card-row">
                      <span className="package-mobile-label">Settlement</span>
                      <span className="package-mobile-value">{p.settlementAmount != null ? formatCurrency(p.settlementAmount) : '—'}</span>
                    </div>
                    <div className="package-mobile-card-row">
                      <span className="package-mobile-label">Status</span>
                      <span className="package-mobile-value">
                        <span className={`status-badge status-${p.isActive === false ? 'rejected' : 'approved'}`}>
                          {p.isActive === false ? 'Inactive' : 'Active'}
                        </span>
                      </span>
                    </div>
                  </div>
                  {p.isActive !== false && isAdmin && (
                    <div className="package-mobile-card-actions">
                      <button
                        type="button"
                        className="filter-btn"
                        onClick={() => { setEditingId(p.id); setEditName(p.name); setEditPrice(String(p.price)); setEditDiscountAmount((p.discountAmount ?? 0) > 0 ? String(p.discountAmount) : ''); setEditTotalSessions(String(p.totalSessions ?? 1)); setError(''); }}
                      >
                        Edit
                      </button>
                      {deleteConfirmId === p.id ? (
                        <>
                          <button type="button" className="filter-btn packages-btn-delete-confirm" onClick={() => handleDelete(p.id)}>Confirm delete</button>
                          <button type="button" className="filter-btn" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
                        </>
                      ) : (
                        <button type="button" className="filter-btn packages-btn-delete" onClick={() => setDeleteConfirmId(p.id)}>Delete</button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* Desktop: table */}
            <div className="data-table-wrap packages-table-wrap">
              <table className="data-table packages-table">
                <thead>
                  <tr>
                    <th className="packages-table-name">Name</th>
                    <th className="packages-table-price">Price</th>
                    <th className="packages-table-discount">Discount</th>
                    <th className="packages-table-sessions">Sessions</th>
                    <th className="packages-table-settlement">Settlement</th>
                    <th className="packages-table-status">Status</th>
                    <th className="packages-table-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPackages.map((p) => (
                    <tr key={p.id}>
                      {editingId === p.id && isAdmin ? (
                        <td colSpan={7} className="packages-table-edit-cell">
                          <form onSubmit={handleUpdate} className="packages-page-inline-form">
                            <label><span>Name</span><input value={editName} onChange={(e) => setEditName(e.target.value)} required /></label>
                            <label>
                              <span>Price</span>
                              <input type="number" min={0} step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} required />
                            </label>
                            <label>
                              <span>Discount amount</span>
                              <input type="number" min={0} step="0.01" value={editDiscountAmount} onChange={(e) => setEditDiscountAmount(e.target.value)} placeholder="0" />
                            </label>
                            <label>
                              <span>No. of sessions</span>
                              <input type="number" min={1} step={1} value={editTotalSessions} onChange={(e) => setEditTotalSessions(e.target.value)} required />
                            </label>
                            <label>
                              <span>Settlement (calculated)</span>
                              <input type="text" value={editCalculatedSettlement != null ? formatCurrency(editCalculatedSettlement) : '—'} readOnly className="readonly-input" />
                            </label>
                            <div className="packages-page-inline-actions">
                              <button type="submit" className="filter-btn packages-btn-save">Save</button>
                              <button type="button" className="filter-btn" onClick={() => setEditingId(null)}>Cancel</button>
                            </div>
                          </form>
                        </td>
                      ) : (
                        <>
                          <td className="packages-table-name"><strong>{p.name}</strong></td>
                          <td className="packages-table-price num">{formatCurrency(p.price)}</td>
                          <td className="packages-table-discount num">{(p.discountAmount ?? 0) > 0 ? formatCurrency(p.discountAmount!) : '—'}</td>
                          <td className="packages-table-sessions num">{p.totalSessions ?? '—'}</td>
                          <td className="packages-table-settlement num">{p.settlementAmount != null ? formatCurrency(p.settlementAmount) : '—'}</td>
                          <td className="packages-table-status">
                            <span className={`status-badge status-${p.isActive === false ? 'rejected' : 'approved'}`}>
                              {p.isActive === false ? 'Inactive' : 'Active'}
                            </span>
                          </td>
                          <td className="packages-table-actions">
                            {p.isActive !== false && isAdmin && (
                              <div className="packages-table-action-btns">
                                <button type="button" className="filter-btn" onClick={() => { setEditingId(p.id); setEditName(p.name); setEditPrice(String(p.price)); setEditDiscountAmount((p.discountAmount ?? 0) > 0 ? String(p.discountAmount) : ''); setEditTotalSessions(String(p.totalSessions ?? 1)); setError(''); }}>Edit</button>
                                {deleteConfirmId === p.id ? (
                                  <>
                                    <button type="button" className="filter-btn packages-btn-delete-confirm" onClick={() => handleDelete(p.id)}>Confirm delete</button>
                                    <button type="button" className="filter-btn" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
                                  </>
                                ) : (
                                  <button type="button" className="filter-btn packages-btn-delete" onClick={() => setDeleteConfirmId(p.id)}>Delete</button>
                                )}
                              </div>
                            )}
                          </td>
                        </>
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
        ) : !showForm && (
          <p className="packages-page-empty text-muted">
            {isAdmin ? 'No packages yet. Add one so vendors can assign packages to customers.' : 'No packages yet.'}
          </p>
        )}
      </section>
    </div>
  );
}
