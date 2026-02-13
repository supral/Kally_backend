import { useEffect, useState } from 'react';
import { getMemberships, createMembership } from '../api/memberships';
import { getCustomers } from '../api/customers';
import { getBranches } from '../api/branches';
import { getPackages } from '../api/packages';
import { useAuth } from '../auth/hooks/useAuth';
import { Link, useSearchParams } from 'react-router-dom';
import { formatCurrency } from '../utils/money';
import type { Membership, Branch } from '../types/crm';
import type { Customer } from '../types/common';
import type { PackageItem } from '../api/packages';

export default function MembershipsList() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [branchId, setBranchId] = useState(searchParams.get('branchId') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createCustomerId, setCreateCustomerId] = useState('');
  const [createTotalCredits, setCreateTotalCredits] = useState('');
  const [createSoldAtBranchId, setCreateSoldAtBranchId] = useState('');
  const [createExpiryDate, setCreateExpiryDate] = useState('');
  const [createPackageId, setCreatePackageId] = useState('');
  const [createPackagePrice, setCreatePackagePrice] = useState('');
  const [createDiscountAmount, setCreateDiscountAmount] = useState('');
  const [createPackageExpiry, setCreatePackageExpiry] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const basePath = user?.role === 'admin' ? '/admin' : '/vendor';
  const isAdmin = user?.role === 'admin';
  const PAGE_SIZE = 10;

  const selectedPackage = packages.find((p) => p.id === createPackageId);

  const searchLower = searchQuery.trim().toLowerCase();
  const filteredMemberships = searchLower
    ? memberships.filter((m) => {
        const customerName = (m.customer?.name ?? '').toLowerCase();
        const customerPhone = (m.customer?.phone ?? '').toLowerCase();
        const customerEmail = (m.customer?.email ?? '').toLowerCase();
        const typeName = (m.typeName ?? '').toLowerCase();
        const soldAt = (m.soldAtBranch ?? '').toLowerCase();
        const statusStr = (m.status ?? '').toLowerCase();
        const purchaseDate = m.purchaseDate ? new Date(m.purchaseDate).toLocaleDateString().toLowerCase() : '';
        const expiryDate = m.expiryDate ? new Date(m.expiryDate).toLocaleDateString().toLowerCase() : '';
        return (
          customerName.includes(searchLower) ||
          customerPhone.includes(searchLower) ||
          customerEmail.includes(searchLower) ||
          typeName.includes(searchLower) ||
          soldAt.includes(searchLower) ||
          statusStr.includes(searchLower) ||
          purchaseDate.includes(searchLower) ||
          expiryDate.includes(searchLower)
        );
      })
    : memberships;

  const totalFiltered = filteredMemberships.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const paginatedMemberships = filteredMemberships.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, branchId, status]);

  useEffect(() => {
    if (isAdmin) getBranches().then((r) => r.success && r.branches && setBranches(r.branches || []));
  }, [isAdmin]);

  useEffect(() => {
    getCustomers().then((r) => r.success && r.customers && setCustomers(r.customers || []));
    getPackages(false).then((r) => r.success && r.packages && setPackages(r.packages || []));
  }, []);

  useEffect(() => {
    setLoading(true);
    getMemberships({ branchId: branchId || undefined, status: status || undefined }).then((r) => {
      setLoading(false);
      if (r.success && 'memberships' in r) setMemberships((r as { memberships: Membership[] }).memberships);
      else setError((r as { message?: string }).message || 'Failed to load');
    });
  }, [branchId, status]);

  useEffect(() => {
    if (createPackageId && selectedPackage) setCreatePackagePrice(String(selectedPackage.price));
  }, [createPackageId, selectedPackage?.price]);

  async function handleCreateMembership(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const credits = Number(createTotalCredits);
    if (!createCustomerId || isNaN(credits) || credits < 1) {
      setError('Customer and total credits are required.');
      return;
    }
    setCreateSubmitting(true);
    const pkgPrice = createPackageId && selectedPackage
      ? (createPackagePrice !== '' ? Number(createPackagePrice) : selectedPackage.price)
      : undefined;
    const discount = createDiscountAmount !== '' ? Number(createDiscountAmount) : undefined;
    if (pkgPrice != null && discount != null && (discount < 0 || discount > pkgPrice)) {
      setError('Discount must be between 0 and total price.');
      setCreateSubmitting(false);
      return;
    }
    const res = await createMembership({
      customerId: createCustomerId,
      totalCredits: credits,
      soldAtBranchId: isAdmin ? createSoldAtBranchId || undefined : undefined,
      expiryDate: createExpiryDate || undefined,
      customerPackage: selectedPackage?.name,
      customerPackagePrice: pkgPrice,
      customerPackageExpiry: createPackageExpiry || undefined,
      discountAmount: discount,
    });
    setCreateSubmitting(false);
    if (res.success) {
      setShowCreateForm(false);
      setCreateCustomerId('');
      setCreateTotalCredits('');
      setCreateExpiryDate('');
      setCreatePackageId('');
      setCreatePackagePrice('');
      setCreateDiscountAmount('');
      setCreatePackageExpiry('');
      getMemberships({ branchId: branchId || undefined, status: status || undefined }).then((r) => r.success && 'memberships' in r && setMemberships((r as { memberships: Membership[] }).memberships));
    } else setError((res as { message?: string }).message || 'Failed to create membership');
  }

  return (
    <div className="dashboard-content">
      <header className="page-hero">
        <h1 className="page-hero-title">Memberships</h1>
        <p className="page-hero-subtitle">Assign memberships to customers. Set package and expiry here. View list below.</p>
      </header>
      <section className="content-card">
        <h2 className="page-section-title" style={{ marginTop: 0 }}>Create new membership</h2>
        <p className="page-hero-subtitle" style={{ marginBottom: '1rem' }}>Select a customer and set credits. Optionally set package and expiry for the customer.</p>
        <button type="button" className="auth-submit" style={{ marginBottom: '1rem', width: 'auto' }} onClick={() => setShowCreateForm(!showCreateForm)}>
          {showCreateForm ? 'Cancel' : 'Create new membership'}
        </button>
        {showCreateForm && (
          <form onSubmit={handleCreateMembership} className="auth-form" style={{ marginBottom: '1.5rem', maxWidth: '480px' }}>
            <label>
              <span>Customer</span>
              <select value={createCustomerId} onChange={(e) => setCreateCustomerId(e.target.value)} required>
                <option value="">— Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Total credits</span>
              <input type="number" min={1} value={createTotalCredits} onChange={(e) => setCreateTotalCredits(e.target.value)} required />
            </label>
            {isAdmin && (
              <label>
                <span>Branch (sold at)</span>
                <select value={createSoldAtBranchId} onChange={(e) => setCreateSoldAtBranchId(e.target.value)}>
                  <option value="">—</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>
            )}
            <label>
              <span>Membership expiry date (optional)</span>
              <input type="date" value={createExpiryDate} onChange={(e) => setCreateExpiryDate(e.target.value)} />
            </label>
            <hr style={{ margin: '1rem 0', border: 'none', borderTop: '1px solid var(--theme-border)' }} />
            <p style={{ fontSize: '0.9rem', color: 'var(--theme-text)', marginBottom: '0.75rem' }}>Customer package (optional — shown on customer list)</p>
            <label>
              <span>Package</span>
              <select value={createPackageId} onChange={(e) => setCreatePackageId(e.target.value)}>
                <option value="">— None</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)}</option>
                ))}
              </select>
            </label>
            {createPackageId && selectedPackage && (
              <>
                <label>
                  <span>Total price</span>
                  <span className="input-prefix-dollar">
                    <span className="input-prefix-symbol" aria-hidden>$</span>
                    <input type="number" min={0} step="0.01" value={createPackagePrice} onChange={(e) => setCreatePackagePrice(e.target.value)} />
                  </span>
                </label>
                <label>
                  <span>Discount amount (optional)</span>
                  <span className="input-prefix-dollar">
                    <span className="input-prefix-symbol" aria-hidden>$</span>
                    <input type="number" min={0} step="0.01" value={createDiscountAmount} onChange={(e) => setCreateDiscountAmount(e.target.value)} placeholder="0" />
                  </span>
                </label>
                {(createPackagePrice !== '' || createDiscountAmount !== '') && (
                  <p className="form-hint" style={{ marginTop: '0.25rem' }}>
                    Final price: {formatCurrency(Math.max(0, (createPackagePrice !== '' ? Number(createPackagePrice) : selectedPackage.price) - (createDiscountAmount !== '' ? Number(createDiscountAmount) : 0)))}
                  </p>
                )}
                <label>
                  <span>Package expiry date</span>
                  <input type="date" value={createPackageExpiry} onChange={(e) => setCreatePackageExpiry(e.target.value)} />
                </label>
              </>
            )}
            <button type="submit" className="auth-submit" disabled={createSubmitting}>{createSubmitting ? 'Creating…' : 'Create membership'}</button>
          </form>
        )}
        {error && <div className="auth-error vendors-error">{error}</div>}
      </section>
      <section className="content-card">
        <h2 className="page-section-title">Membership list</h2>
        <div className="vendors-filters" style={{ marginBottom: '1rem' }}>
          {isAdmin && (
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="filter-btn">
              <option value="">All branches</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="filter-btn">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="used">Used</option>
            <option value="expired">Expired</option>
          </select>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label className="search-label-inline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span className="text-muted">Search</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Customer, phone, package, branch, status, date…"
              className="filter-btn"
              style={{ minWidth: '220px', padding: '0.4rem 0.6rem' }}
              aria-label="Search memberships"
            />
          </label>
          {totalFiltered > 0 && (
            <p className="customers-showing-count text-muted">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalFiltered)} of {totalFiltered} membership{totalFiltered !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {loading ? (
          <div className="vendors-loading"><div className="spinner" /><span>Loading...</span></div>
        ) : memberships.length === 0 ? (
          <p className="vendors-empty">No memberships found.</p>
        ) : filteredMemberships.length === 0 ? (
          <p className="vendors-empty">No memberships match your search.</p>
        ) : (
          <>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th className="num">Total / Used / Remaining</th>
                    <th>Package price</th>
                    <th>Sold at</th>
                    <th>Purchase date</th>
                    <th>Expiry</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMemberships.map((m) => (
                  <tr key={m.id}>
                    <td><strong>{m.customer?.name || '—'}</strong> {m.customer?.phone && `(${m.customer.phone})`}</td>
                    <td className="num">{m.totalCredits} / {m.usedCredits} / {(m.remainingCredits ?? m.totalCredits - m.usedCredits)}</td>
                    <td className="num">
                      {m.packagePrice != null
                        ? (m.discountAmount != null && m.discountAmount > 0
                          ? `${formatCurrency((m.packagePrice ?? 0) - (m.discountAmount ?? 0))} (${formatCurrency(m.discountAmount)} off)`
                          : formatCurrency(m.packagePrice))
                        : '—'}
                    </td>
                    <td>{m.soldAtBranch || '—'}</td>
                    <td>{m.purchaseDate ? new Date(m.purchaseDate).toLocaleDateString() : '—'}</td>
                    <td>{m.expiryDate ? new Date(m.expiryDate).toLocaleDateString() : '—'}</td>
                    <td><span className={`status-badge status-${m.status === 'active' ? 'approved' : m.status === 'used' ? 'rejected' : 'pending'}`}>{m.status}</span></td>
                    <td><Link to={`${basePath}/memberships/${m.id}`}>View / Use</Link></td>
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
          </>
        )}
      </section>
    </div>
  );
}
