import { useEffect, useState, useCallback } from 'react';
import { getVendors, getVendor, approveVendor, rejectVendor, updateVendor, blockVendor, setVendorActive } from '../api/vendors';
import { getBranches } from '../api/branches';
import type { VendorListItem, ApprovalStatus } from '../types/auth';
import type { Branch } from '../types/crm';

type FilterStatus = 'all' | ApprovalStatus;

export default function AdminVendors() {
  const [vendors, setVendors] = useState<VendorListItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<VendorListItem | null>(null);
  const [vendorDetail, setVendorDetail] = useState<VendorListItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editingVendor, setEditingVendor] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editVendorName, setEditVendorName] = useState('');
  const [editBranchId, setEditBranchId] = useState('');
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [assigningBranchId, setAssigningBranchId] = useState<string | null>(null);
  const [blockingId, setBlockingId] = useState<string | null>(null);
  const [blockConfirmVendorId, setBlockConfirmVendorId] = useState<string | null>(null);
  const [blockConfirmInput, setBlockConfirmInput] = useState('');
  const [blockConfirmError, setBlockConfirmError] = useState('');

  async function loadVendors() {
    setLoading(true);
    setError('');
    const status = filter === 'all' ? undefined : filter;
    const res = await getVendors(status);
    setLoading(false);
    if (res.success && res.vendors) setVendors(res.vendors);
    else setError(res.message || 'Failed to load vendors');
  }

  useEffect(() => {
    loadVendors();
  }, [filter]);

  const closeModal = useCallback(() => {
    setSelectedVendor(null);
    setVendorDetail(null);
    setEditingVendor(false);
    setEditError('');
  }, []);

  useEffect(() => {
    getBranches().then((r) => { if (r.success && r.branches) setBranches(r.branches); });
  }, []);

  useEffect(() => {
    if (!selectedVendor) return;
    setDetailLoading(true);
    setVendorDetail(null);
    getVendor(selectedVendor.id).then((r) => {
      setDetailLoading(false);
      if (r.success && r.vendor) {
        setVendorDetail(r.vendor);
        setEditName(r.vendor.name);
        setEditEmail(r.vendor.email);
        setEditVendorName(r.vendor.vendorName || '');
        setEditBranchId(r.vendor.branchId || '');
      }
    });
  }, [selectedVendor?.id]);

  useEffect(() => {
    if (!selectedVendor) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeModal();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedVendor, closeModal]);

  useEffect(() => {
    if (!blockConfirmVendorId) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeBlockConfirm();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [blockConfirmVendorId]);

  async function handleApprove(id: string) {
    setActioningId(id);
    const res = await approveVendor(id);
    setActioningId(null);
    if (res.success) loadVendors();
    else setError(res.message || 'Failed to approve');
  }

  async function handleReject(id: string) {
    setActioningId(id);
    const res = await rejectVendor(id);
    setActioningId(null);
    if (res.success) {
      loadVendors();
      setSelectedVendor((prev) => (prev && prev.id === id ? { ...prev, approvalStatus: 'rejected' as const } : prev));
    } else setError(res.message || 'Failed to reject');
  }

  function handleApproveFromModal(id: string) {
    setSelectedVendor((prev) => (prev && prev.id === id ? { ...prev, approvalStatus: 'approved' as const } : prev));
    handleApprove(id);
  }

  function handleRejectFromModal(id: string) {
    handleReject(id);
  }

  async function handleAssignBranch(vendorId: string, branchId: string | null) {
    setAssigningBranchId(vendorId);
    setError('');
    const res = await updateVendor(vendorId, { branchId: branchId || null });
    setAssigningBranchId(null);
    if (res.success) loadVendors();
    else setError(res.message || 'Failed to assign branch');
  }

  function openBlockConfirm(id: string) {
    setBlockConfirmVendorId(id);
    setBlockConfirmInput('');
    setBlockConfirmError('');
  }

  function closeBlockConfirm() {
    setBlockConfirmVendorId(null);
    setBlockConfirmInput('');
    setBlockConfirmError('');
  }

  async function handleBlockConfirmOk() {
    if (!blockConfirmVendorId) return;
    if (blockConfirmInput.trim() !== 'CONFIRM') {
      setBlockConfirmError('Type CONFIRM exactly to proceed.');
      return;
    }
    setBlockConfirmError('');
    setBlockingId(blockConfirmVendorId);
    const res = await blockVendor(blockConfirmVendorId);
    setBlockingId(null);
    closeBlockConfirm();
    if (res.success) {
      loadVendors();
      if (selectedVendor?.id === blockConfirmVendorId) {
        setSelectedVendor((prev) => prev ? { ...prev, isActive: false } : null);
        if (res.vendor) setVendorDetail((prev) => prev && prev.id === blockConfirmVendorId ? { ...prev, isActive: false } : prev);
      }
    } else setError(res.message || 'Failed to block');
  }

  async function handleSetActive(id: string) {
    setBlockingId(id);
    setError('');
    const res = await setVendorActive(id);
    setBlockingId(null);
    if (res.success) {
      loadVendors();
      if (selectedVendor?.id === id) {
        setSelectedVendor((prev) => prev ? { ...prev, isActive: true } : null);
        if (res.vendor) setVendorDetail((prev) => prev && prev.id === id ? { ...prev, isActive: true } : prev);
      }
    } else setError(res.message || 'Failed to activate');
  }

  const handleSaveVendorEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendor) return;
    setEditError('');
    setEditSaving(true);
    const res = await updateVendor(selectedVendor.id, {
      name: editName.trim(),
      email: editEmail.trim().toLowerCase(),
      vendorName: editVendorName.trim() || undefined,
      branchId: editBranchId || null,
    });
    setEditSaving(false);
    if (res.success && res.vendor) {
      setVendorDetail(res.vendor);
      setEditingVendor(false);
      loadVendors();
      setSelectedVendor((prev) => prev && prev.id === selectedVendor.id ? { ...prev, ...res.vendor } : prev);
    } else {
      setEditError(res.message || 'Failed to update vendor');
    }
  };

  const pendingCount = filter === 'all' ? vendors.filter((v) => v.approvalStatus === 'pending').length : 0;

  return (
    <div className="dashboard-content">
      <section className="content-card">
        <div className="vendors-header">
          <h2>Vendor management</h2>
          <p className="vendors-subtitle">Approve vendors and assign each vendor to a branch. Vendors only see data for their assigned branch.</p>
        </div>

        <div className="vendors-filters">
          <button
            type="button"
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            type="button"
            className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            Pending {filter === 'all' && pendingCount > 0 ? `(${pendingCount})` : ''}
          </button>
          <button
            type="button"
            className={`filter-btn ${filter === 'approved' ? 'active' : ''}`}
            onClick={() => setFilter('approved')}
          >
            Approved
          </button>
          <button
            type="button"
            className={`filter-btn ${filter === 'rejected' ? 'active' : ''}`}
            onClick={() => setFilter('rejected')}
          >
            Rejected
          </button>
        </div>

        {error && <div className="auth-error vendors-error">{error}</div>}

        {loading ? (
          <div className="vendors-loading">
            <div className="spinner" />
            <span>Loading vendors...</span>
          </div>
        ) : vendors.length === 0 ? (
          <p className="vendors-empty">No vendors found.</p>
        ) : (
          <div className="vendors-table-wrap">
            <table className="vendors-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Vendor name</th>
                  <th>Branch</th>
                  <th>Approval</th>
                  <th>Blocked</th>
                  <th>Registered</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <button
                        type="button"
                        className="vendor-name-btn"
                        onClick={() => setSelectedVendor(v)}
                      >
                        {v.name}
                      </button>
                    </td>
                    <td>{v.email}</td>
                    <td>{v.vendorName || '—'}</td>
                    <td>
                      <select
                        value={v.branchId ?? ''}
                        onChange={(e) => handleAssignBranch(v.id, e.target.value || null)}
                        disabled={assigningBranchId !== null}
                        className="vendor-branch-select"
                        aria-label={`Assign branch for ${v.name}`}
                        title="Assign branch – vendor will only see this branch"
                      >
                        <option value="">No branch assigned</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                      {assigningBranchId === v.id && <span className="vendor-branch-saving"> …</span>}
                    </td>
                    <td>
                      <span className={`status-badge status-${v.approvalStatus}`}>
                        {v.approvalStatus}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge status-${v.isActive === false ? 'rejected' : 'approved'}`}>
                        {v.isActive === false ? 'Blocked' : 'Active'}
                      </span>
                    </td>
                    <td>{new Date(v.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className="vendor-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                        {v.approvalStatus === 'pending' && (
                          <>
                            <button
                              type="button"
                              className="btn-approve"
                              onClick={() => handleApprove(v.id)}
                              disabled={actioningId !== null}
                            >
                              {actioningId === v.id ? '…' : 'Approve'}
                            </button>
                            <button
                              type="button"
                              className="btn-reject"
                              onClick={() => handleReject(v.id)}
                              disabled={actioningId !== null}
                            >
                              {actioningId === v.id ? '…' : 'Reject'}
                            </button>
                          </>
                        )}
                        {v.isActive === false ? (
                          <button
                            type="button"
                            className="btn-approve"
                            onClick={() => handleSetActive(v.id)}
                            disabled={blockingId !== null}
                            title="Activate – user can login again"
                          >
                            {blockingId === v.id ? '…' : 'Active'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-reject"
                            onClick={() => openBlockConfirm(v.id)}
                            disabled={blockingId !== null}
                            title="Block – user cannot login"
                          >
                            {blockingId === v.id ? '…' : 'Block'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedVendor && (
        <div
          className="vendor-modal-backdrop"
          onClick={closeModal}
          role="presentation"
        >
          <div
            className="vendor-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="vendor-modal-title"
          >
            <div className="vendor-modal-header">
              <h2 id="vendor-modal-title">Vendor details</h2>
              <button
                type="button"
                className="vendor-modal-close"
                onClick={closeModal}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {detailLoading ? (
              <div className="vendors-loading" style={{ padding: '1.5rem' }}>
                <div className="spinner" />
                <span>Loading details…</span>
              </div>
            ) : editingVendor ? (
              <form onSubmit={handleSaveVendorEdit} className="vendor-modal-edit-form">
                {editError && <div className="auth-error vendors-error">{editError}</div>}
                <label className="auth-form-label">
                  <span>Name</span>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="appointment-form-input"
                    required
                  />
                </label>
                <label className="auth-form-label">
                  <span>Email</span>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="appointment-form-input"
                    required
                  />
                </label>
                <label className="auth-form-label">
                  <span>Vendor / business name</span>
                  <input
                    type="text"
                    value={editVendorName}
                    onChange={(e) => setEditVendorName(e.target.value)}
                    className="appointment-form-input"
                  />
                </label>
                <label className="auth-form-label">
                  <span>Assign branch</span>
                  <select
                    value={editBranchId}
                    onChange={(e) => setEditBranchId(e.target.value)}
                    className="appointment-form-input"
                    aria-label="Assign branch to vendor"
                  >
                    <option value="">No branch assigned</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  <span className="text-muted" style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.85rem' }}>Vendor will only see data for this branch.</span>
                </label>
                <div className="vendor-modal-actions">
                  <button type="button" className="filter-btn" onClick={() => setEditingVendor(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={editSaving}>
                    {editSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
            ) : vendorDetail ? (
              <>
                <dl className="vendor-detail-dl">
                  <dt>Name</dt>
                  <dd>{vendorDetail.name}</dd>
                  <dt>Email</dt>
                  <dd>{vendorDetail.email}</dd>
                  <dt>Vendor / business name</dt>
                  <dd>{vendorDetail.vendorName || '—'}</dd>
                  <dt>Branch</dt>
                  <dd>{vendorDetail.branchName || '—'}</dd>
                  <dt>Status</dt>
                  <dd>
                    <span className={`status-badge status-${vendorDetail.approvalStatus}`}>
                      {vendorDetail.approvalStatus}
                    </span>
                  </dd>
                  <dt>Account</dt>
                  <dd>
                    <span className={`status-badge status-${vendorDetail.isActive === false ? 'rejected' : 'approved'}`}>
                      {vendorDetail.isActive === false ? 'Blocked' : 'Active'}
                    </span>
                  </dd>
                  <dt>Registered</dt>
                  <dd>{new Date(vendorDetail.createdAt).toLocaleString()}</dd>
                </dl>
                <div className="vendor-modal-actions">
                  <button
                    type="button"
                    className="filter-btn"
                    onClick={() => setEditingVendor(true)}
                  >
                    Edit vendor
                  </button>
                  {vendorDetail.approvalStatus === 'pending' && (
                    <>
                      <button
                        type="button"
                        className="btn-approve"
                        onClick={() => handleApproveFromModal(vendorDetail.id)}
                        disabled={actioningId !== null}
                      >
                        {actioningId === vendorDetail.id ? '…' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        className="btn-reject"
                        onClick={() => handleRejectFromModal(vendorDetail.id)}
                        disabled={actioningId !== null}
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {vendorDetail.isActive === false ? (
                    <button
                      type="button"
                      className="btn-approve"
                      onClick={() => handleSetActive(vendorDetail.id)}
                      disabled={blockingId !== null}
                    >
                      {blockingId === vendorDetail.id ? '…' : 'Active'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-reject"
                      onClick={() => openBlockConfirm(vendorDetail.id)}
                      disabled={blockingId !== null}
                    >
                      {blockingId === vendorDetail.id ? '…' : 'Block'}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p className="vendors-empty">Could not load vendor details.</p>
            )}
          </div>
        </div>
      )}

      {blockConfirmVendorId && (
        <div
          className="vendor-modal-backdrop block-confirm-backdrop"
          onClick={closeBlockConfirm}
          role="presentation"
        >
          <div
            className="vendor-modal block-confirm-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="block-confirm-title"
            aria-describedby="block-confirm-desc"
          >
            <div className="vendor-modal-header block-confirm-header">
              <h2 id="block-confirm-title">Confirm block</h2>
              <button
                type="button"
                className="vendor-modal-close"
                onClick={closeBlockConfirm}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="block-confirm-body">
              <p id="block-confirm-desc" className="block-confirm-message">
                Are you sure you want to block this user? They will not be able to log in. Type <strong>CONFIRM</strong> below to proceed.
              </p>
              <form onSubmit={(e) => { e.preventDefault(); handleBlockConfirmOk(); }}>
                <label className="block-confirm-label">
                  <span className="block-confirm-label-text">Type CONFIRM</span>
                  <input
                    type="text"
                    value={blockConfirmInput}
                    onChange={(e) => { setBlockConfirmInput(e.target.value); setBlockConfirmError(''); }}
                    className={`block-confirm-input ${blockConfirmInput.trim() === 'CONFIRM' ? 'block-confirm-input-valid' : ''} ${blockConfirmError ? 'block-confirm-input-error' : ''}`}
                    placeholder="CONFIRM"
                    autoComplete="off"
                    autoFocus
                    aria-invalid={!!blockConfirmError}
                    aria-describedby={blockConfirmError ? 'block-confirm-err' : undefined}
                  />
                </label>
                {blockConfirmError && (
                  <p id="block-confirm-err" className="block-confirm-error" role="alert">
                    {blockConfirmError}
                  </p>
                )}
                <div className="block-confirm-actions">
                  <button type="button" className="block-confirm-cancel" onClick={closeBlockConfirm}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="block-confirm-ok"
                    disabled={blockConfirmInput.trim() !== 'CONFIRM'}
                  >
                    Block user
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
