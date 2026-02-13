import { useEffect, useState } from 'react';
import { getBranches, createBranch, updateBranch, deleteBranch } from '../api/branches';
import { useAuth } from '../auth/hooks/useAuth';
import type { Branch } from '../types/crm';

export default function BranchesPage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [viewingBranch, setViewingBranch] = useState<Branch | null>(null);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editZipCode, setEditZipCode] = useState('');
  const [deletingBranchId, setDeletingBranchId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const isAdmin = user?.role === 'admin';
  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(branches.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const paginatedBranches = branches.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const loadBranches = () => {
    getBranches().then((r) => {
      setLoading(false);
      if (r.success && r.branches) setBranches(r.branches);
      else setError(r.message || 'Failed to load branches');
    });
  };

  useEffect(() => {
    loadBranches();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await createBranch({
      name,
      address: address || undefined,
      zipCode: zipCode || undefined,
    });
    if (res.success) {
      setName('');
      setAddress('');
      setZipCode('');
      setShowForm(false);
      loadBranches();
    } else setError((res as { message?: string }).message || 'Failed to create');
  }

  function openEdit(b: Branch) {
    setEditingBranch(b);
    setEditName(b.name);
    setEditAddress(b.address || '');
    setEditZipCode(b.zipCode || '');
    setError('');
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBranch) return;
    setError('');
    const res = await updateBranch(editingBranch.id, {
      name: editName,
      address: editAddress || undefined,
      zipCode: editZipCode || undefined,
    });
    if (res.success) {
      setEditingBranch(null);
      loadBranches();
    } else setError((res as { message?: string }).message || 'Failed to update');
  }

  async function handleDelete(id: string) {
    setError('');
    const res = await deleteBranch(id);
    if (res.success) {
      setDeletingBranchId(null);
      loadBranches();
    } else setError(res.message || 'Failed to delete');
  }

  if (loading) {
    return (
      <div className="dashboard-content">
        <div className="vendors-loading"><div className="spinner" /><span>Loading branches...</span></div>
      </div>
    );
  }

  return (
    <div className="dashboard-content">
      <header className="page-hero">
        <h1 className="page-hero-title">{isAdmin ? 'Branches' : 'My branch'}</h1>
        <p className="page-hero-subtitle">{isAdmin ? 'Manage all branches. View, edit, or delete a branch.' : 'Your assigned branch.'}</p>
      </header>
      <section className="content-card">
        {isAdmin && (
          <button type="button" className="auth-submit" style={{ marginBottom: '1rem', width: 'auto' }} onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'Add branch'}
          </button>
        )}
        {showForm && (
          <form onSubmit={handleCreate} className="auth-form" style={{ marginBottom: '1rem', maxWidth: '420px' }}>
            <label><span>Branch name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tacoma" required /></label>
            <label><span>Branch address</span><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city" /></label>
            <label><span>Zip code</span><input value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="e.g. 98401" /></label>
            <button type="submit" className="auth-submit">Create branch</button>
          </form>
        )}
        {error && <div className="auth-error vendors-error">{error}</div>}
        {branches.length > 0 ? (
          <>
            <p className="customers-showing-count text-muted">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, branches.length)} of {branches.length} branch{branches.length !== 1 ? 'es' : ''}
            </p>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Address</th>
                    <th>Zip code</th>
                    {isAdmin && <th className="th-actions">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {paginatedBranches.map((b) => (
                  <tr key={b.id}>
                    <td><strong>{b.name}</strong></td>
                    <td>{b.address || '—'}</td>
                    <td>{b.zipCode || '—'}</td>
                    {isAdmin && (
                      <td className="branch-actions">
                        <button type="button" className="branch-action-btn branch-action-view" onClick={() => setViewingBranch(b)} title="View">View</button>
                        <button type="button" className="branch-action-btn branch-action-edit" onClick={() => openEdit(b)} title="Edit">Edit</button>
                        <button type="button" className="branch-action-btn branch-action-delete" onClick={() => setDeletingBranchId(b.id)} title="Delete">Delete</button>
                      </td>
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
        ) : (
          <p className="vendors-empty">
            {isAdmin ? 'No branches.' : 'You don’t have a branch assigned yet. Contact your admin to get assigned to a branch.'}
          </p>
        )}
      </section>

      {viewingBranch && (
        <div className="branch-modal-overlay" onClick={() => setViewingBranch(null)} role="dialog" aria-modal="true" aria-label="View branch">
          <div className="branch-modal" onClick={(e) => e.stopPropagation()}>
            <div className="branch-modal-header">
              <h3>Branch details</h3>
              <button type="button" className="branch-modal-close" onClick={() => setViewingBranch(null)} aria-label="Close">×</button>
            </div>
            <dl className="branch-view-dl">
              <dt>Name</dt>
              <dd>{viewingBranch.name}</dd>
              <dt>Address</dt>
              <dd>{viewingBranch.address || '—'}</dd>
              <dt>Zip code</dt>
              <dd>{viewingBranch.zipCode || '—'}</dd>
            </dl>
            <div className="branch-modal-footer">
              <button type="button" className="auth-submit" style={{ width: 'auto' }} onClick={() => setViewingBranch(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {editingBranch && (
        <div className="branch-modal-overlay" onClick={() => setEditingBranch(null)} role="dialog" aria-modal="true" aria-label="Edit branch">
          <div className="branch-modal" onClick={(e) => e.stopPropagation()}>
            <div className="branch-modal-header">
              <h3>Edit branch</h3>
              <button type="button" className="branch-modal-close" onClick={() => setEditingBranch(null)} aria-label="Close">×</button>
            </div>
            <form onSubmit={handleUpdate} className="auth-form">
              <label><span>Branch name</span><input value={editName} onChange={(e) => setEditName(e.target.value)} required /></label>
              <label><span>Address</span><input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} /></label>
              <label><span>Zip code</span><input value={editZipCode} onChange={(e) => setEditZipCode(e.target.value)} /></label>
              <div className="branch-modal-footer">
                <button type="button" className="branch-action-btn branch-action-cancel" onClick={() => setEditingBranch(null)}>Cancel</button>
                <button type="submit" className="auth-submit" style={{ width: 'auto' }}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingBranchId && (
        <div className="branch-modal-overlay" onClick={() => setDeletingBranchId(null)} role="dialog" aria-modal="true" aria-label="Confirm delete">
          <div className="branch-modal branch-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="branch-modal-header">
              <h3>Delete branch?</h3>
              <button type="button" className="branch-modal-close" onClick={() => setDeletingBranchId(null)} aria-label="Close">×</button>
            </div>
            <p className="branch-delete-message">This will deactivate the branch. You can no longer assign vendors or new data to it.</p>
            <div className="branch-modal-footer">
              <button type="button" className="branch-action-btn branch-action-cancel" onClick={() => setDeletingBranchId(null)}>Cancel</button>
              <button type="button" className="branch-action-btn branch-action-delete-confirm" onClick={() => handleDelete(deletingBranchId)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
