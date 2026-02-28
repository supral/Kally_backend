import { useEffect, useMemo, useState } from 'react';
import { getMemberships, createMembership, importMemberships, type ImportRow } from '../api/memberships';
import { getCustomers } from '../api/customers';
import { getBranches } from '../api/branches';
import { getPackages } from '../api/packages';
import { useAuth } from '../auth/hooks/useAuth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatCurrency } from '../utils/money';
import type { Membership, Branch } from '../types/crm';
import type { Customer } from '../types/common';
import type { PackageItem } from '../api/packages';

export default function MembershipsList() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
  const [createPackageId, setCreatePackageId] = useState('');
  const [createPackagePrice, setCreatePackagePrice] = useState('');
  const [createDiscountAmount, setCreateDiscountAmount] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; createdCustomers: number; errors: { row: number; message: string }[] } | null>(null);
  const basePath = user?.role === 'admin' ? '/admin' : '/vendor';
  const isAdmin = user?.role === 'admin';
  const PAGE_SIZE = 10;

  const selectedPackage = useMemo(() => packages.find((p) => p.id === createPackageId), [packages, createPackageId]);

  const { filteredMemberships, totalFiltered, totalPages, currentPage, paginatedMemberships } = useMemo(() => {
    const searchLower = searchQuery.trim().toLowerCase();
    const filtered = searchLower
      ? memberships.filter((m) => {
          const customerName = (m.customer?.name ?? '').toLowerCase();
          const customerPhone = (m.customer?.phone ?? '').toLowerCase();
          const customerEmail = (m.customer?.email ?? '').toLowerCase();
          const typeName = (m.typeName ?? '').toLowerCase();
          const soldAt = (m.soldAtBranch ?? '').toLowerCase();
          const statusStr = (m.status ?? '').toLowerCase();
          return (
            customerName.includes(searchLower) ||
            customerPhone.includes(searchLower) ||
            customerEmail.includes(searchLower) ||
            typeName.includes(searchLower) ||
            soldAt.includes(searchLower) ||
            statusStr.includes(searchLower)
          );
        })
      : memberships;
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const current = Math.min(Math.max(1, page), pages);
    const paginated = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
    return {
      filteredMemberships: filtered,
      totalFiltered: total,
      totalPages: pages,
      currentPage: current,
      paginatedMemberships: paginated,
    };
  }, [memberships, searchQuery, page, PAGE_SIZE]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, branchId, status]);

  function escapeCsvCell(value: string | number): string {
    const s = String(value ?? '').replace(/"/g, '""');
    return /[,"\n\r]/.test(s) ? `"${s}"` : s;
  }

  function exportToCsv() {
    const headers = ['Customer', 'Phone', 'Email', 'Total credits', 'Used', 'Remaining', 'Package price', 'Sold at', 'Status'];
    const rows = filteredMemberships.map((m) => {
      const remaining = m.remainingCredits ?? m.totalCredits - m.usedCredits;
      const priceStr = m.packagePrice != null
        ? (m.discountAmount != null && m.discountAmount > 0
          ? `${formatCurrency((m.packagePrice ?? 0) - (m.discountAmount ?? 0))} (${formatCurrency(m.discountAmount)} off)`
          : formatCurrency(m.packagePrice))
        : '—';
      return [
        m.customer?.name ?? '—',
        m.customer?.phone ?? '—',
        m.customer?.email ?? '—',
        m.totalCredits,
        m.usedCredits,
        remaining,
        priceStr,
        m.soldAtBranch ?? '—',
        m.status ?? '—',
      ].map(escapeCsvCell);
    });
    const csv = [headers.map(escapeCsvCell).join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memberships-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function parseCsvLine(line: string): string[] {
    const out: string[] = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        i++;
        let cell = '';
        while (i < line.length) {
          if (line[i] === '"' && line[i + 1] === '"') { cell += '"'; i += 2; continue; }
          if (line[i] === '"') { i++; break; }
          cell += line[i++];
        }
        out.push(cell);
      } else {
        let cell = '';
        while (i < line.length && line[i] !== ',') cell += line[i++];
        out.push(cell.trim());
        if (line[i] === ',') i++;
      }
    }
    return out;
  }

  function csvToImportRows(text: string): ImportRow[] {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const headers = parseCsvLine(lines[0]).map((h) => h.trim());
    const get = (row: string[], name: string) => {
      const i = headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
      return i >= 0 ? row[i] ?? '' : '';
    };
    const out: ImportRow[] = [];
    for (let r = 1; r < lines.length; r++) {
      const cells = parseCsvLine(lines[r]);
      const customerName = get(cells, 'Customer') || get(cells, 'customerName');
      const customerPhone = get(cells, 'Phone') || get(cells, 'customerPhone');
      const customerEmail = get(cells, 'Email') || get(cells, 'customerEmail');
      const totalCreditsRaw = get(cells, 'Total credits') || get(cells, 'totalCredits');
      const soldAtBranch = get(cells, 'Sold at') || get(cells, 'soldAtBranch') || get(cells, 'Branch');
      let packagePrice: number | undefined;
      const priceStr = get(cells, 'Package price') || get(cells, 'packagePrice');
      if (priceStr && priceStr !== '—' && priceStr !== '-') {
        const num = parseFloat(priceStr.replace(/[$,]/g, '').trim());
        if (!Number.isNaN(num)) packagePrice = num;
      }
      const totalCredits = parseInt(totalCreditsRaw, 10) || 0;
      if (!customerName.trim() && !customerPhone.trim()) continue;
      out.push({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || undefined,
        totalCredits: totalCredits || 1,
        soldAtBranch: soldAtBranch.trim(),
        packagePrice,
      });
    }
    return out;
  }

  async function handleImportFile(file: File) {
    setImportResult(null);
    setError('');
    const text = await file.text();
    const rows = csvToImportRows(text);
    if (rows.length === 0) {
      setError('No valid rows to import. CSV must have a header row with Customer, Phone, Sold at, Total credits (and optionally Email, Package price).');
      return;
    }
    setImporting(true);
    const res = await importMemberships(rows);
    setImporting(false);
    if (res.success && res.imported != null) {
      setImportResult({ imported: res.imported, createdCustomers: res.createdCustomers ?? 0, errors: res.errors ?? [] });
      getMemberships({ branchId: branchId || undefined, status: status || undefined }).then((r) => {
        if (r.success && 'memberships' in r) setMemberships((r as { memberships: Membership[] }).memberships);
      });
    } else setError(res.message || 'Import failed.');
  }

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
    if (!createPackageId || !selectedPackage) {
      setError('Package is required. Please select a package from the list.');
      return;
    }
    const pkgPrice = createPackagePrice !== '' ? Number(createPackagePrice) : selectedPackage.price;
    if (Number.isNaN(pkgPrice) || pkgPrice < 0) {
      setError('Package price is required and must be 0 or greater.');
      return;
    }
    const discount = createDiscountAmount !== '' ? Number(createDiscountAmount) : undefined;
    if (discount != null && (discount < 0 || discount > pkgPrice)) {
      setError('Discount must be between 0 and total price.');
      return;
    }
    setCreateSubmitting(true);
    const res = await createMembership({
      customerId: createCustomerId,
      totalCredits: credits,
      soldAtBranchId: isAdmin ? createSoldAtBranchId || undefined : undefined,
      customerPackage: selectedPackage.name,
      customerPackagePrice: pkgPrice,
      discountAmount: discount,
    });
    setCreateSubmitting(false);
    if (res.success) {
      setShowCreateForm(false);
      setCreateCustomerId('');
      setCreateTotalCredits('');
      setCreatePackageId('');
      setCreatePackagePrice('');
      setCreateDiscountAmount('');
      getMemberships({ branchId: branchId || undefined, status: status || undefined }).then((r) => r.success && 'memberships' in r && setMemberships((r as { memberships: Membership[] }).memberships));
    } else setError((res as { message?: string }).message || 'Failed to create membership');
  }

  return (
    <div className="dashboard-content memberships-page">
      <header className="page-hero memberships-page-hero">
        <h1 className="page-hero-title">Memberships</h1>
        <button type="button" className="auth-submit memberships-create-btn" onClick={() => setShowCreateForm(!showCreateForm)}>
          {showCreateForm ? 'Cancel' : 'Create new membership'}
        </button>
      </header>

      {showCreateForm && (
        <section className="content-card memberships-create-form-card">
          <form onSubmit={handleCreateMembership} className="auth-form" style={{ maxWidth: '480px' }}>
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
            <hr style={{ margin: '1rem 0', border: 'none', borderTop: '1px solid var(--theme-border)' }} />
            <p style={{ fontSize: '0.9rem', color: 'var(--theme-text)', marginBottom: '0.75rem' }}>Package (required)</p>
            <label>
              <span>Package <strong>*</strong></span>
              <select value={createPackageId} onChange={(e) => setCreatePackageId(e.target.value)} required>
                <option value="">— Select package</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)}</option>
                ))}
              </select>
            </label>
            {createPackageId && selectedPackage && (
              <>
                <label>
                  <span>Total price <strong>*</strong></span>
                  <span className="input-prefix-dollar">
                    <span className="input-prefix-symbol" aria-hidden>$</span>
                    <input type="number" min={0} step="0.01" value={createPackagePrice} onChange={(e) => setCreatePackagePrice(e.target.value)} required />
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
              </>
            )}
            <button type="submit" className="auth-submit" disabled={createSubmitting}>{createSubmitting ? 'Creating…' : 'Create membership'}</button>
          </form>
        </section>
      )}

      <div className="memberships-filters-and-list">
      <section className="content-card memberships-search-card">
        <label className="memberships-search-label" htmlFor="memberships-search-input">
          Search memberships
        </label>
        <input
          id="memberships-search-input"
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Customer name, phone, email, package, branch, status…"
          className="memberships-search-input"
          autoComplete="off"
          aria-label="Search memberships by customer, phone, package, branch or status"
        />
        <div className="memberships-search-meta">
          {isAdmin && (
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="memberships-filter-select" aria-label="Filter by branch">
              <option value="">All branches</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="memberships-filter-select" aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="used">Used</option>
          </select>
          {totalFiltered > 0 && (
            <span className="memberships-search-count text-muted">
              {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalFiltered)} of {totalFiltered}
            </span>
          )}
          <button
            type="button"
            className="memberships-export-btn"
            onClick={exportToCsv}
            disabled={totalFiltered === 0}
            title={totalFiltered === 0 ? 'No data to export' : 'Export filtered results to CSV/Excel'}
          >
            Export to CSV / Excel
          </button>
          <label className="memberships-import-btn">
            <input
              type="file"
              accept=".csv,.txt,text/csv,application/csv"
              className="memberships-import-input"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImportFile(f);
                e.target.value = '';
              }}
              disabled={importing}
            />
            {importing ? 'Importing…' : 'Import from CSV'}
          </label>
        </div>
        {importResult && (
          <div className="memberships-import-result" role="status">
            <p className="memberships-import-success">
              Imported <strong>{importResult.imported}</strong> membership{importResult.imported !== 1 ? 's' : ''}
              {importResult.createdCustomers > 0 && `, created ${importResult.createdCustomers} new customer(s).`}
            </p>
            {importResult.errors.length > 0 && (
              <ul className="memberships-import-errors">
                {importResult.errors.slice(0, 10).map((err, i) => (
                  <li key={i}>Row {err.row}: {err.message}</li>
                ))}
                {importResult.errors.length > 10 && <li>… and {importResult.errors.length - 10} more errors.</li>}
              </ul>
            )}
          </div>
        )}
      </section>

      {error && <div className="auth-error vendors-error">{error}</div>}
      <section className="content-card memberships-list-card">
        <h2 className="page-section-title" style={{ marginTop: 0 }}>Membership list</h2>
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
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMemberships.map((m) => (
                  <tr
                    key={m.id}
                    className="memberships-row-clickable"
                    role="button"
                    tabIndex={0}
                    aria-label={`View membership for ${m.customer?.name || 'customer'}`}
                    onClick={() => navigate(`${basePath}/memberships/${m.id}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`${basePath}/memberships/${m.id}`); } }}
                  >
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
                    <td><span className={`status-badge status-${m.status === 'active' ? 'approved' : m.status === 'used' ? 'rejected' : 'pending'}`}>{m.status}</span></td>
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
    </div>
  );
}
