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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
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
    const res = await createPackage({ name: name.trim(), price: num });
    if (res.success) {
      setName('');
      setPrice('');
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
    const res = await updatePackage(editingId, { name: editName.trim(), price: num });
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
    <div className="dashboard-content">
      <header className="page-hero">
        <h1 className="page-hero-title">Customer packages</h1>
        <p className="page-hero-subtitle">Add and manage packages and prices. Vendors can only choose from this list when creating customers.</p>
      </header>
      <section className="content-card">
        <button type="button" className="auth-submit" style={{ marginBottom: '1rem', width: 'auto' }} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Add package'}
        </button>
        {showForm && (
          <form onSubmit={handleCreate} className="auth-form" style={{ marginBottom: '1rem', maxWidth: '400px' }}>
            <label><span>Package name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Basic, Premium" required /></label>
            <label>
              <span>Price</span>
              <span className="input-prefix-dollar">
                <span className="input-prefix-symbol" aria-hidden>$</span>
                <input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" required />
              </span>
            </label>
            <button type="submit" className="auth-submit">Create package</button>
          </form>
        )}
        {error && <div className="auth-error vendors-error">{error}</div>}
        {packages.length > 0 ? (
          <>
            <p className="customers-showing-count text-muted">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, packages.length)} of {packages.length} package{packages.length !== 1 ? 's' : ''}
            </p>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPackages.map((p) => (
                  <tr key={p.id}>
                    {editingId === p.id ? (
                      <>
                        <td colSpan={4}>
                          <form onSubmit={handleUpdate} className="auth-form" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
                            <label style={{ margin: 0 }}><span>Name</span><input value={editName} onChange={(e) => setEditName(e.target.value)} required /></label>
                            <label style={{ margin: 0 }}>
                              <span>Price</span>
                              <span className="input-prefix-dollar">
                                <span className="input-prefix-symbol" aria-hidden>$</span>
                                <input type="number" min={0} step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} required />
                              </span>
                            </label>
                            <button type="submit" className="auth-submit">Save</button>
                            <button type="button" className="auth-submit" style={{ background: 'var(--theme-bg)' }} onClick={() => setEditingId(null)}>Cancel</button>
                          </form>
                        </td>
                      </>
                    ) : (
                      <>
                        <td><strong>{p.name}</strong></td>
                        <td>{formatCurrency(p.price)}</td>
                        <td>{p.isActive === false ? 'Inactive' : 'Active'}</td>
                        <td>
                          {p.isActive !== false && (
                            <>
                              <button type="button" className="auth-submit" style={{ marginRight: '0.5rem', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }} onClick={() => { setEditingId(p.id); setEditName(p.name); setEditPrice(String(p.price)); setError(''); }}>Edit</button>
                              {deleteConfirmId === p.id ? (
                                <>
                                  <button type="button" className="auth-submit" style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', background: '#ef4444' }} onClick={() => handleDelete(p.id)}>Confirm delete</button>
                                  <button type="button" className="auth-submit" style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', marginLeft: '0.25rem' }} onClick={() => setDeleteConfirmId(null)}>Cancel</button>
                                </>
                              ) : (
                                <button type="button" className="auth-submit" style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', background: 'rgba(239,68,68,0.2)', color: '#fca5a5' }} onClick={() => setDeleteConfirmId(p.id)}>Delete</button>
                              )}
                            </>
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
        ) : !showForm && <p className="vendors-empty">No packages. Add one so vendors can assign packages to customers.</p>}
      </section>
    </div>
  );
}
