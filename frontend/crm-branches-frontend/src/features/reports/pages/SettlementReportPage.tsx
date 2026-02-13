import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getSettlements, updateSettlement, type SettlementSummaryRow } from '../../../api/reports';
import { createCustomer, getCustomersForDropdown } from '../../../api/customers';
import { getBranches } from '../../../api/branches';
import { useAuth } from '../../../auth/hooks/useAuth';
import { formatCurrency } from '../../../utils/money';
import type { Settlement } from '../../../types/common';
import type { Branch } from '../../../types/common';
import type { Customer } from '../../../types/common';

type CustomerOption = Customer & { primaryBranchId?: string | null };
type StatusFilter = 'all' | 'pending' | 'settled';

export default function SettlementReportPage() {
  const { user } = useAuth();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [summary, setSummary] = useState<SettlementSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [allCustomers, setAllCustomers] = useState<CustomerOption[]>([]);
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const [addPrimaryBranchId, setAddPrimaryBranchId] = useState('');
  const [addServiceTakenBranchId, setAddServiceTakenBranchId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [nameDropdownOpen, setNameDropdownOpen] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addMessage, setAddMessage] = useState('');
  const [addSuccessJustNow, setAddSuccessJustNow] = useState(false);
  const [lastAddedCustomer, setLastAddedCustomer] = useState<{ id: string; name: string; phone?: string; email?: string; primaryBranch?: string; membershipCardId?: string } | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);

  const isAdmin = user?.role === 'admin';

  const nameSearch = addName.trim().toLowerCase();
  const filteredCustomers = nameSearch
    ? allCustomers.filter(
        (c) =>
          c.name.toLowerCase().includes(nameSearch) ||
          (c.phone && c.phone.includes(addName.trim())) ||
          (c.email && c.email.toLowerCase().includes(nameSearch))
      )
    : allCustomers;
  const showDropdown = nameDropdownOpen && (addName.length > 0 || filteredCustomers.length > 0);

  const fetchSettlements = useCallback(() => {
    setLoading(true);
    setError('');
    getSettlements()
      .then((r) => {
        setLoading(false);
        if (r.success) {
          setSettlements(r.settlements || []);
          setSummary(r.summary || []);
        } else setError(r.message || 'Failed to load');
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  useEffect(() => {
    getBranches({ all: true }).then((r) => r.success && r.branches && setBranches(r.branches || []));
  }, []);

  useEffect(() => {
    if (showAddCustomer) getCustomersForDropdown().then((r) => r.success && r.customers && setAllCustomers(r.customers || []));
  }, [showAddCustomer]);

  useEffect(() => {
    if (showAddCustomer && !isAdmin && user?.branchId) setAddServiceTakenBranchId(user.branchId);
  }, [showAddCustomer, isAdmin, user?.branchId]);

  useEffect(() => {
    function handleClickOutside(ev: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(ev.target as Node) && nameInputRef.current && !nameInputRef.current.contains(ev.target as Node)) {
        setNameDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredSettlements =
    statusFilter === 'all'
      ? settlements
      : settlements.filter((s) => (s.status || '').toLowerCase() === statusFilter);

  const PAGE_SIZE = 10;
  const totalFiltered = filteredSettlements.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const paginatedSettlements = filteredSettlements.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const pendingTotal = settlements
    .filter((s) => (s.status || '').toLowerCase() === 'pending')
    .reduce((sum, s) => sum + (typeof s.amount === 'number' ? s.amount : 0), 0);
  const pendingCount = settlements.filter((s) => (s.status || '').toLowerCase() === 'pending').length;
  const settledCount = settlements.filter((s) => (s.status || '').toLowerCase() === 'settled').length;

  async function handleMarkSettled(id: string) {
    setMarkingId(id);
    const r = await updateSettlement(id, { status: 'settled' });
    setMarkingId(null);
    if (r.success) fetchSettlements();
  }

  function selectCustomer(c: CustomerOption | null) {
    if (!c) {
      setSelectedCustomerId(null);
      setAddName('');
      setAddPhone('');
      setAddEmail('');
      setAddPrimaryBranchId('');
      setNameDropdownOpen(false);
      return;
    }
    setSelectedCustomerId(c.id);
    setAddName(c.name);
    setAddPhone(c.phone || '');
    setAddEmail(c.email || '');
    setAddPrimaryBranchId(c.primaryBranchId || '');
    setNameDropdownOpen(false);
  }

  async function handleAddCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (selectedCustomerId) {
      setAddMessage('This customer is already in the system. Clear the name field and enter new details to add a different customer.');
      return;
    }
    if (!addName.trim() || !addPhone.trim()) {
      setAddMessage('Name and phone are required.');
      return;
    }
    if (!addEmail.trim()) {
      setAddMessage('Email is required.');
      return;
    }
    if (!addPrimaryBranchId) {
      setAddMessage('Primary branch is required.');
      return;
    }
    const effectiveServiceTakenBranchId = isAdmin ? addServiceTakenBranchId : (user?.branchId || addServiceTakenBranchId);
    if (!effectiveServiceTakenBranchId) {
      setAddMessage('Service taken branch is required.');
      return;
    }
    const serviceTakenBranch = branches.find((b) => b.id === effectiveServiceTakenBranchId);
    const serviceTakenName = serviceTakenBranch?.name || user?.branchName || effectiveServiceTakenBranchId;
    const notesWithService = addNotes.trim()
      ? `${addNotes.trim()}\nService taken at: ${serviceTakenName}`
      : `Service taken at: ${serviceTakenName}`;
    setAddSubmitting(true);
    setAddMessage('');
    const res = await createCustomer({
      name: addName.trim(),
      phone: addPhone.trim(),
      email: addEmail.trim(),
      notes: notesWithService,
      primaryBranchId: addPrimaryBranchId,
    });
    setAddSubmitting(false);
    if (res.success) {
      setAddMessage('');
      setAddSuccessJustNow(true);
      const created = (res as { customer?: { id: string; name: string; phone?: string; email?: string; primaryBranch?: string; membershipCardId?: string } }).customer;
      if (created) setLastAddedCustomer(created);
      setAddName('');
      setAddPhone('');
      setAddEmail('');
      setAddNotes('');
      setAddPrimaryBranchId('');
      setAddServiceTakenBranchId('');
      setSelectedCustomerId(null);
      setShowAddCustomer(false);
      getCustomersForDropdown().then((r) => r.success && r.customers && setAllCustomers(r.customers || []));
    } else setAddMessage((res as { message?: string }).message || 'Failed to add customer.');
  }

  const customersLink = user?.role === 'admin' ? '/admin/customers' : '/vendor/customers';

  return (
    <div className="dashboard-content settlements-page">
      <header className="settlements-hero">
        <div className="settlements-hero-text">
          <h1 className="settlements-hero-title">Cross-branch settlements</h1>
          <p className="settlements-hero-subtitle">
            Track what each branch owes when a membership is used at a different branch than where it was sold. Settlement % is set in Settings.
          </p>
        </div>
        <div className="settlements-hero-actions">
          <button type="button" className="settlements-refresh-btn" onClick={fetchSettlements} disabled={loading} aria-label="Refresh">
            {loading ? <span className="settlements-spinner" /> : '↻'} Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="auth-error settlements-error" role="alert">
          {error}
        </div>
      )}

      <section className="content-card settlements-add-customer-card">
        <p className="settlements-card-desc" style={{ marginTop: 0, marginBottom: '0.75rem' }}>
          Add new customers for memberships and tracking. They appear on the Customers page.
        </p>
        <button
          type="button"
          className="settlements-toggle-add"
          onClick={() => {
            setShowAddCustomer(!showAddCustomer);
            setAddMessage('');
            setAddSuccessJustNow(false);
          }}
          aria-expanded={showAddCustomer}
        >
          {showAddCustomer ? 'Hide form' : '+ Add customer to system'}
        </button>
        {showAddCustomer && (
          <div className="settlements-add-form-wrap">
            {addSuccessJustNow && (
              <p className="settlements-add-msg success">
                Customer added. <Link to={customersLink}>View in Customers</Link>
                <button type="button" className="settlements-dismiss" onClick={() => setAddSuccessJustNow(false)} aria-label="Dismiss">×</button>
              </p>
            )}
            <form onSubmit={handleAddCustomer} className="auth-form settlements-add-form">
              <label>
                <span>Name (search or type new)</span>
                <div ref={dropdownRef} style={{ position: 'relative' }}>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={addName}
                    onChange={(e) => {
                      setAddName(e.target.value);
                      setSelectedCustomerId(null);
                      setNameDropdownOpen(true);
                    }}
                    onFocus={() => setNameDropdownOpen(true)}
                    placeholder="Search existing or type new name"
                    autoComplete="off"
                  />
                  {showDropdown && (
                    <ul className="customer-name-dropdown settlements-dropdown">
                      <li>
                        <button type="button" className="dropdown-item-new" onClick={() => selectCustomer(null)}>
                          + New customer
                        </button>
                      </li>
                      {filteredCustomers.slice(0, 50).map((c) => (
                        <li key={c.id}>
                          <button type="button" className="dropdown-item" onClick={() => selectCustomer(c)}>
                            {c.name} {c.phone && <span className="text-muted">({c.phone})</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </label>
              <label><span>Phone</span><input type="tel" value={addPhone} onChange={(e) => setAddPhone(e.target.value)} required placeholder="Required" /></label>
              <label><span>Email (required)</span><input type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} required /></label>
              <label>
                <span>Primary branch (required)</span>
                <select value={addPrimaryBranchId} onChange={(e) => setAddPrimaryBranchId(e.target.value)} required>
                  <option value="">— Select —</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
              <label>
                <span>Service taken branch (required)</span>
                {isAdmin ? (
                  <select value={addServiceTakenBranchId} onChange={(e) => setAddServiceTakenBranchId(e.target.value)} required>
                    <option value="">— Select —</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                ) : (
                  <input type="text" readOnly value={user?.branchName || branches.find((b) => b.id === user?.branchId)?.name || 'Your branch'} className="readonly-input" />
                )}
              </label>
              <label><span>Notes (optional)</span><textarea value={addNotes} onChange={(e) => setAddNotes(e.target.value)} rows={2} /></label>
              {addMessage && <p className="settlements-add-msg error">{addMessage}</p>}
              <button type="submit" className="auth-submit" disabled={addSubmitting}>
                {addSubmitting ? 'Adding…' : 'Add customer'}
              </button>
            </form>
          </div>
        )}
      </section>

      {loading && settlements.length === 0 ? (
        <div className="settlements-loading-state">
          <span className="settlements-spinner" />
          <span>Loading settlements...</span>
        </div>
      ) : (
        <>
          <div className="settlements-stats-row">
            <div className="settlements-stat-card">
              <span className="settlements-stat-value">{settlements.length}</span>
              <span className="settlements-stat-label">Total entries</span>
            </div>
            <div className="settlements-stat-card pending">
              <span className="settlements-stat-value">{pendingCount}</span>
              <span className="settlements-stat-label">Pending</span>
            </div>
            <div className="settlements-stat-card">
              <span className="settlements-stat-value">{formatCurrency(pendingTotal)}</span>
              <span className="settlements-stat-label">Pending amount</span>
            </div>
            <div className="settlements-stat-card settled">
              <span className="settlements-stat-value">{settledCount}</span>
              <span className="settlements-stat-label">Settled</span>
            </div>
          </div>

          {summary.length > 0 && (
            <section className="content-card settlements-summary-card">
              <h2 className="settlements-section-title">Summary — who owes whom</h2>
              <p className="settlements-card-desc">Aggregated amounts by from-branch → to-branch, with status breakdown.</p>
              <div className="settlements-summary-grid">
                {summary.map((s, i) => (
                  <div key={i} className="settlements-summary-item">
                    <span className="settlements-summary-from">{s.from}</span>
                    <span className="settlements-summary-arrow">→</span>
                    <span className="settlements-summary-to">{s.to}</span>
                    <span className="settlements-summary-amount">{formatCurrency(s.amount)}</span>
                    {(s.pendingAmount != null || s.settledAmount != null) && (
                      <span className="settlements-summary-status">
                        <span className="settlement-status settlement-status-pending">Pending: {formatCurrency(s.pendingAmount ?? 0)}</span>
                        <span className="settlement-status settlement-status-settled">Settled: {formatCurrency(s.settledAmount ?? 0)}</span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="content-card settlements-table-card">
            <div className="settlements-table-header">
              <h2 className="settlements-section-title">Settlement entries</h2>
              <div className="settlements-filters">
                <span className="settlements-filter-label">Status:</span>
                {(['all', 'pending', 'settled'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`settlements-filter-btn ${statusFilter === f ? 'active' : ''}`}
                    onClick={() => setStatusFilter(f)}
                  >
                    {f === 'all' ? 'All' : f === 'pending' ? 'Pending' : 'Settled'}
                  </button>
                ))}
              </div>
            </div>

            {lastAddedCustomer && (
              <div className="settlements-added-in-entries">
                <h3 className="settlements-added-in-title">Customer added from this page</h3>
                <div className="data-table-wrap settlements-table-wrap">
                  <table className="data-table settlements-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Email</th>
                        <th>Primary branch</th>
                        <th>Membership card</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>{lastAddedCustomer.name}</strong></td>
                        <td>{lastAddedCustomer.phone ?? '—'}</td>
                        <td>{lastAddedCustomer.email ?? '—'}</td>
                        <td>{lastAddedCustomer.primaryBranch ?? '—'}</td>
                        <td>{lastAddedCustomer.membershipCardId ?? '—'}</td>
                        <td>
                          <span className="settlements-added-actions-cell">
                            <Link to={customersLink} className="settlements-view-customers-link">View in Customers</Link>
                            <button type="button" className="settlements-dismiss-added" onClick={() => { setLastAddedCustomer(null); setAddSuccessJustNow(false); }}>Dismiss</button>
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {filteredSettlements.length === 0 ? (
              <div className="settlements-empty-state">
                <span className="settlements-empty-icon" aria-hidden>📋</span>
                <p>
                  {statusFilter === 'all'
                    ? 'No settlement entries yet.'
                    : `No ${statusFilter} settlements.`}
                </p>
                <p className="text-muted">
                  Entries are created when a membership is used at a different branch than where it was sold.
                </p>
              </div>
            ) : (
              <>
                {totalFiltered > 0 && (
                  <p className="customers-showing-count text-muted">
                    Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalFiltered)} of {totalFiltered} entr{totalFiltered !== 1 ? 'ies' : 'y'}
                  </p>
                )}
                <div className="data-table-wrap settlements-table-wrap">
                  <table className="data-table settlements-table">
                    <thead>
                      <tr>
                        <th>From branch</th>
                        <th>To branch</th>
                        <th className="num">Amount</th>
                        <th>Reason</th>
                        <th>Status</th>
                        <th>Date</th>
                        {isAdmin && <th>Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedSettlements.map((s) => (
                      <tr key={s.id}>
                        <td>{s.fromBranch}</td>
                        <td>{s.toBranch}</td>
                        <td className="num">{typeof s.amount === 'number' ? formatCurrency(s.amount) : s.amount}</td>
                        <td>{s.reason || '—'}</td>
                        <td>
                          <span className={`settlement-status settlement-status-${(s.status || 'pending').toLowerCase()}`}>
                            {s.status || 'pending'}
                          </span>
                        </td>
                        <td>{s.createdAt ? new Date(s.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'}</td>
                        {isAdmin && (
                          <td>
                            {(s.status || '').toLowerCase() === 'pending' ? (
                              <button
                                type="button"
                                className="settlements-mark-btn"
                                onClick={() => handleMarkSettled(s.id)}
                                disabled={markingId === s.id}
                              >
                                {markingId === s.id ? <span className="settlements-spinner small" /> : null}
                                {markingId === s.id ? '…' : 'Mark settled'}
                              </button>
                            ) : (
                              '—'
                            )}
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
            )}
          </section>
        </>
      )}
    </div>
  );
}
