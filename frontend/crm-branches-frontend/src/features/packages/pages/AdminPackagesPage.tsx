import { useEffect, useState } from 'react';
import { getPackages, createPackage, updatePackage, deletePackage } from '../../../api/packages';
import { formatCurrency } from '../../../utils/money';
import type { PackageItem } from '../../../api/packages';

export default function AdminPackagesPage() {
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [settlementAmount, setSettlementAmount] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editSettlementAmount, setEditSettlementAmount] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(packages.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const paginatedPackages = packages.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function loadPackages() {
    getPackages(true).then((r) => {
      setLoading(false);
      if (r.success && r.packages) setPackages(r.packages);
      else setError(r.message || 'Failed to load packages');
    });
  }

  useEffect(() => {
    loadPackages();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const num = parseFloat(price);
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (isNaN(num) || num < 0) {
      setError('Price must be a non-negative number.');
      return;
    }
    const settlement = settlementAmount.trim() ? parseFloat(settlementAmount) : undefined;
    if (settlement !== undefined && (isNaN(settlement) || settlement < 0)) {
      setError('Settlement amount must be 0 or greater.');
      return;
    }
    const res = await createPackage({ name: name.trim(), price: num, settlementAmount: settlement });
    if (res.success) {
      setName('');
      setPrice('');
      setSettlementAmount('');
      setShowForm(false);
      loadPackages();
    } else setError((res as { message?: string }).message || 'Failed to create');
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setError('');
    const num = parseFloat(editPrice);
    if (!editName.trim()) {
      setError('Name is required.');
      return;
    }
    if (isNaN(num) || num < 0) {
      setError('Price must be a non-negative number.');
      return;
    }
    const settlement = editSettlementAmount.trim() ? parseFloat(editSettlementAmount) : null;
    if (editSettlementAmount.trim() && (isNaN(settlement!) || settlement! < 0)) {
      setError('Settlement amount must be 0 or greater.');
      return;
    }
    const res = await updatePackage(editingId, { name: editName.trim(), price: num, settlementAmount: editSettlementAmount.trim() ? settlement! : null });
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
          <button
            type="button"
            className={`packages-page-cta ${showForm ? 'packages-page-cta-secondary' : ''}`}
            onClick={() => { setShowForm(!showForm); setError(''); }}
          >
            {showForm ? 'Cancel' : 'Add package'}
          </button>
        </div>
      </header>

      {showForm && (
        <section className="content-card packages-page-form-card">
          <h2 className="packages-page-form-title">New package</h2>
          <form onSubmit={handleCreate} className="packages-page-form">
            <label className="packages-page-name-field">
              <span>Package name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Basic, Premium" required />
            </label>
            <label className="packages-page-price-field">
              <span>Price</span>
              <input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" required />
            </label>
            <label className="packages-page-settlement-field">
              <span>Settlement price (per credit)</span>
              <input type="number" min={0} step="0.01" value={settlementAmount} onChange={(e) => setSettlementAmount(e.target.value)} placeholder="e.g. 5.00 (optional)" title="Amount paid per credit when used at another branch. Overrides Settings % if set." />
              <span className="packages-page-field-hint">Amount per credit at another branch. Overrides Settings % if set.</span>
            </label>
            <button type="submit" className="auth-submit packages-page-submit">Create package</button>
          </form>
        </section>
      )}

      {error && <div className="auth-error packages-page-error" role="alert">{error}</div>}

      <section className="content-card packages-page-table-card">
        {packages.length > 0 ? (
          <>
            <p className="packages-page-count text-muted">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, packages.length)} of {packages.length} package{packages.length !== 1 ? 's' : ''}
            </p>
            <div className="data-table-wrap">
              <table className="data-table packages-table">
                <thead>
                  <tr>
                    <th className="packages-table-name">Name</th>
                    <th className="packages-table-price">Price</th>
                    <th className="packages-table-settlement">Settlement price</th>
                    <th className="packages-table-status">Status</th>
                    <th className="packages-table-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPackages.map((p) => (
                    <tr key={p.id}>
                      {editingId === p.id ? (
                        <td colSpan={5} className="packages-table-edit-cell">
                          <form onSubmit={handleUpdate} className="packages-page-inline-form">
                            <label><span>Name</span><input value={editName} onChange={(e) => setEditName(e.target.value)} required /></label>
                            <label>
                              <span>Price</span>
                              <input type="number" min={0} step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} required />
                            </label>
                            <label>
                              <span>Settlement price</span>
                              <input type="number" min={0} step="0.01" value={editSettlementAmount} onChange={(e) => setEditSettlementAmount(e.target.value)} placeholder="—" title="Per credit at another branch" />
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
                          <td className="packages-table-settlement num">{p.settlementAmount != null ? formatCurrency(p.settlementAmount) : '—'}</td>
                          <td className="packages-table-status">
                            <span className={`status-badge status-${p.isActive === false ? 'rejected' : 'approved'}`}>
                              {p.isActive === false ? 'Inactive' : 'Active'}
                            </span>
                          </td>
                          <td className="packages-table-actions">
                            {p.isActive !== false && (
                              <div className="packages-table-action-btns">
                                <button type="button" className="filter-btn" onClick={() => { setEditingId(p.id); setEditName(p.name); setEditPrice(String(p.price)); setEditSettlementAmount(p.settlementAmount != null ? String(p.settlementAmount) : ''); setError(''); }}>Edit</button>
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
          <p className="packages-page-empty text-muted">No packages yet. Add one so vendors can assign packages to customers.</p>
        )}
      </section>
    </div>
  );
}
