import { useEffect, useState, useCallback } from 'react';
import { getSalesDashboard, getOwnerOverview } from '../../../api/reports';
import { getBranches } from '../../../api/branches';
import { getPackages } from '../../../api/packages';
import {
  getManualSales,
  createManualSale,
  deleteManualSale,
  getManualSale,
  type ManualSale,
} from '../../../api/manualSales';
import { useAuth } from '../../../auth/hooks/useAuth';
import { formatCurrency, formatNumber } from '../../../utils/money';
import type { SalesDashboard as SalesDashboardType } from '../../../types/common';
import type { Branch } from '../../../types/common';
import type { OwnerOverviewBranch } from '../../../types/crm';
import type { SettlementSummaryItem } from '../../../api/reports';
import type { PackageItem } from '../../../api/packages';

const breakdownLimit = 10;

function getDefaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 1);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default function SalesPage() {
  const { user } = useAuth();
  const [data, setData] = useState<SalesDashboardType | null>(null);
  const [overview, setOverview] = useState<OwnerOverviewBranch[]>([]);
  const [settlementSummary, setSettlementSummary] = useState<SettlementSummaryItem[]>([]);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [dateFrom, setDateFrom] = useState(() => getDefaultDateRange().from);
  const [dateTo, setDateTo] = useState(() => getDefaultDateRange().to);
  const [packageId, setPackageId] = useState('');
  const [loading, setLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<SalesDashboardType | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailBreakdownPage, setDetailBreakdownPage] = useState(1);
  const [breakdownPage] = useState(1);

  // Manual sales – dashboard level (for Total Sales calc) and branch details
  const [dashboardManualSales, setDashboardManualSales] = useState<ManualSale[]>([]);
  const [dashboardManualSalesLoading, setDashboardManualSalesLoading] = useState(false);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Add manual sale modal (top-right button) – only on this details page
  const [showAddManualModal, setShowAddManualModal] = useState(false);
  const [addModalBranchId, setAddModalBranchId] = useState('');
  const [addModalDate, setAddModalDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [addModalAmount, setAddModalAmount] = useState('');
  const [addModalImage, setAddModalImage] = useState<File | null>(null);
  const [addModalSubmitting, setAddModalSubmitting] = useState(false);
  const [addModalError, setAddModalError] = useState('');

  const isAdmin = user?.role === 'admin';
  const selectedPackageName = packageId ? packages.find((p) => p.id === packageId)?.name : undefined;

  const fetchDashboardManualSales = useCallback(() => {
    setDashboardManualSalesLoading(true);
    getManualSales({
      from: dateFrom,
      to: dateTo,
      branchId: isAdmin && branchId ? branchId : undefined,
    }).then((r) => {
      setDashboardManualSalesLoading(false);
      if (r.success) setDashboardManualSales(r.sales || []);
    });
  }, [dateFrom, dateTo, branchId, isAdmin]);

  useEffect(() => {
    fetchDashboardManualSales();
  }, [fetchDashboardManualSales]);

  useEffect(() => {
    if (isAdmin) {
      getBranches({ all: true }).then((r) => r.success && r.branches && setBranches(r.branches || []));
      getPackages(true).then((r) => r.success && r.packages && setPackages(r.packages || []));
      getOwnerOverview().then((r) => {
        setOverviewLoading(false);
        if (r.success) {
          if (r.overview) setOverview(r.overview);
          if (r.settlementSummary) setSettlementSummary(r.settlementSummary);
        }
      });
    } else setOverviewLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    setLoading(true);
    getSalesDashboard({
      branchId: branchId || undefined,
      from: dateFrom || undefined,
      to: dateTo || undefined,
      packageName: selectedPackageName,
      breakdownPage: isAdmin ? 1 : breakdownPage,
      breakdownLimit: isAdmin ? 1 : breakdownLimit,
    }).then((r) => {
      setLoading(false);
      if (r.success && r.data) setData(r.data);
      else setError(r.message || 'Failed to load');
    });
  }, [branchId, dateFrom, dateTo, selectedPackageName, isAdmin, breakdownPage]);

  useEffect(() => {
    if (!selectedBranchId) {
      setDetailData(null);
      return;
    }
    setDetailLoading(true);
    getSalesDashboard({
      branchId: selectedBranchId,
      from: dateFrom || undefined,
      to: dateTo || undefined,
      packageName: selectedPackageName,
      breakdownPage: detailBreakdownPage,
      breakdownLimit,
    }).then((r) => {
      setDetailLoading(false);
      if (r.success && r.data) setDetailData(r.data);
      else setDetailData(null);
    });
    fetchManualSales();
  }, [selectedBranchId, dateFrom, dateTo, selectedPackageName, detailBreakdownPage]);

  const selectedBranchName =
    selectedBranchId &&
    (data?.branches?.find((b) => b.id === selectedBranchId)?.name ??
      branches.find((b) => b.id === selectedBranchId)?.name);

  // Merge byBranch with overview for appointments
  const mergedByBranch = (data?.byBranch ?? []).map((row) => {
    const branchIdForRow =
      data?.branches?.find((b) => b.name === row.branch)?.id ??
      branches.find((b) => b.name === row.branch)?.id;
    const ov = overview.find((o) => String(o.branchId) === String(branchIdForRow) || o.branchName === row.branch);
    return {
      ...row,
      branchId: branchIdForRow,
      appointmentsThisMonth: ov?.appointmentsThisMonth ?? 0,
      appointmentsCompleted: ov?.appointmentsCompleted ?? 0,
    };
  });

  const totalMemberships = mergedByBranch.reduce((s, b) => s + (b.membershipCount ?? 0), 0);
  const totalAppointments = overview.reduce((s, b) => s + b.appointmentsThisMonth, 0);

  const membershipSales = typeof data?.totalSales === 'number'
    ? data.totalSales
    : typeof data?.totalRevenue === 'number'
      ? data.totalRevenue
      : 0;
  const totalManualSalesAmount = dashboardManualSales.reduce((s, m) => s + (m.amount ?? 0), 0);
  const totalSales = membershipSales + totalManualSalesAmount;

  async function handleAddManualModalSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAddModalError('');
    const amount = parseFloat(addModalAmount);
    if (isNaN(amount) || amount < 0) {
      setAddModalError('Enter a valid amount (0 or more).');
      return;
    }
    const targetBranchId = isAdmin ? addModalBranchId : (user?.branchId ?? '');
    if (!targetBranchId) {
      setAddModalError('Please select a branch.');
      return;
    }
    if (!addModalDate) {
      setAddModalError('Date is required.');
      return;
    }

    let imageBase64: string | undefined;
    if (addModalImage) {
      const base64 = await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string)?.split(',')[1] || null);
        reader.readAsDataURL(addModalImage);
      });
      if (base64) imageBase64 = base64;
    }

    setAddModalSubmitting(true);
    const r = await createManualSale({
      branchId: targetBranchId,
      date: addModalDate,
      amount,
      imageBase64,
    });
    setAddModalSubmitting(false);

    if (r.success) {
      setShowAddManualModal(false);
      setAddModalAmount('');
      setAddModalDate(new Date().toISOString().slice(0, 10));
      setAddModalImage(null);
      setAddModalBranchId(branchId || '');
      fetchDashboardManualSales();
    } else setAddModalError(r.message || 'Failed to record sale');
  }

  async function handleViewImage(id: string) {
    const r = await getManualSale(id);
    if (r.success && r.sale?.imageBase64) setViewImage(r.sale.imageBase64);
  }

  function handleDownloadImage(id: string) {
    getManualSale(id).then((r) => {
      if (r.success && r.sale?.imageBase64) {
        const a = document.createElement('a');
        a.href = `data:image/jpeg;base64,${r.sale.imageBase64}`;
        a.download = `receipt-${id}.jpg`;
        a.click();
      }
    });
  }

  async function handleDelete(id: string) {
    if (!isAdmin) return;
    setDeletingId(id);
    const r = await deleteManualSale(id);
    setDeletingId(null);
    if (r.success) fetchDashboardManualSales();
  }

  const filteredBreakdown = detailData?.breakdown ?? [];

  return (
    <div className="dashboard-content sales-page">
      <header className="page-hero sales-page-hero">
        <div className="sales-page-hero-top">
          <div>
            <h1 className="page-hero-title">Sales dashboard</h1>
            <p className="page-hero-subtitle">
              Revenue, memberships, and manual sales. Use date and package filters below.
            </p>
          </div>
          <button
            type="button"
            className="auth-submit memberships-create-btn sales-add-manual-btn"
            onClick={() => {
              setShowAddManualModal(true);
              setAddModalError('');
              setAddModalBranchId(branchId || (user?.branchId ?? ''));
              setAddModalDate(new Date().toISOString().slice(0, 10));
              setAddModalAmount('');
              setAddModalImage(null);
            }}
          >
            + Add manual sale
          </button>
        </div>
        <div className="sales-dashboard-filters">
          <label>
            <span>From</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="sales-dashboard-date-input" />
          </label>
          <label>
            <span>To</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="sales-dashboard-date-input" />
          </label>
          {isAdmin && (
            <>
              <label>
                <span>Branch</span>
                <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                  <option value="">All branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Package</span>
                <select value={packageId} onChange={(e) => setPackageId(e.target.value)}>
                  <option value="">All packages</option>
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>
      </header>

      {/* Sales summary: formula + Membership only + Daily amount + Total (one card, fit on screen) */}
      {!overviewLoading && (isAdmin || data) && (
        <section className="content-card sales-summary-card">
          <p className="text-muted" style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', fontWeight: 500 }}>
            <strong>Total Sales = Membership Sales + Daily Sales Amount.</strong> Daily sales are manually updated below.
          </p>
          <div className="owner-hero-stats" style={{ marginTop: 0, marginBottom: 0, flexWrap: 'wrap' }}>
            <div className="owner-hero-stat">
              <span className="owner-hero-stat-value">{loading ? '…' : formatCurrency(membershipSales)}</span>
              <span className="owner-hero-stat-label">Membership sales only {isAdmin && !branchId ? '(all)' : ''}</span>
            </div>
            <div className="owner-hero-stat">
              <span className="owner-hero-stat-value">{loading || dashboardManualSalesLoading ? '…' : formatCurrency(totalManualSalesAmount)}</span>
              <span className="owner-hero-stat-label">Daily sales (manual) {isAdmin && !branchId ? '(all)' : ''}</span>
            </div>
            <div className="owner-hero-stat owner-hero-stat-highlight">
              <span className="owner-hero-stat-value">{loading || dashboardManualSalesLoading ? '…' : formatCurrency(totalSales)}</span>
              <span className="owner-hero-stat-label">Total sales {isAdmin && !branchId ? '(all)' : ''}</span>
            </div>
            {isAdmin && (
              <>
                <div className="owner-hero-stat">
                  <span className="owner-hero-stat-value">{branches.length}</span>
                  <span className="owner-hero-stat-label">Branches</span>
                </div>
                <div className="owner-hero-stat">
                  <span className="owner-hero-stat-value">{formatNumber(totalMemberships)}</span>
                  <span className="owner-hero-stat-label">Memberships sold</span>
                </div>
                <div className="owner-hero-stat">
                  <span className="owner-hero-stat-value">{formatNumber(totalAppointments)}</span>
                  <span className="owner-hero-stat-label">Appointments (month)</span>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* Cross-branch settlement */}
      {isAdmin && settlementSummary.length > 0 && (
        <section className="content-card owner-settlement">
          <h2 className="owner-section-title">Cross-branch settlement</h2>
          <p className="owner-section-desc">Outstanding balances for membership services delivered at another branch.</p>
          <div className="owner-settlement-table-wrap">
            <table className="owner-settlement-table">
              <thead>
                <tr>
                  <th>From branch</th>
                  <th>To branch</th>
                  <th className="owner-settlement-amount">Amount</th>
                </tr>
              </thead>
              <tbody>
                {settlementSummary.map((s, i) => (
                  <tr key={i}>
                    <td>{s.fromBranch}</td>
                    <td>{s.toBranch}</td>
                    <td className="owner-settlement-amount">
                      {formatCurrency(s.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Manual sales – all branches, date filter from above; view/download image on click; admin delete */}
      <section className="content-card manual-sales-section">
        <h2 className="page-section-title" style={{ marginTop: 0 }}>Manual sales</h2>
        <p className="text-muted" style={{ marginBottom: '0.5rem' }}>
          Daily sales added manually by branches. Filter by date range above. Click date or amount to view/download receipt.
        </p>
        {dashboardManualSalesLoading ? (
          <div className="loading-placeholder">Loading…</div>
        ) : dashboardManualSales.length === 0 ? (
          <p className="text-muted" style={{ margin: 0 }}>No manual sales in the selected date range.</p>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>Date</th>
                  <th className="num">Amount</th>
                  <th>Receipt</th>
                  {isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {dashboardManualSales.map((s) => (
                  <tr key={s.id}>
                    <td>{s.branchName}</td>
                    <td>
                      <button
                        type="button"
                        className="branch-name-link"
                        onClick={() => s.hasImage && handleViewImage(s.id)}
                        title={s.hasImage ? 'View receipt' : undefined}
                      >
                        {new Date(s.date).toLocaleDateString()}
                      </button>
                    </td>
                    <td className="num">
                      <button
                        type="button"
                        className="branch-name-link"
                        onClick={() => s.hasImage && handleViewImage(s.id)}
                        title={s.hasImage ? 'View receipt' : undefined}
                      >
                        {formatCurrency(s.amount)}
                      </button>
                    </td>
                    <td>
                      {s.hasImage ? (
                        <span style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button type="button" className="btn-link" onClick={() => handleViewImage(s.id)}>View</button>
                          <button type="button" className="btn-link" onClick={() => handleDownloadImage(s.id)}>Download</button>
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td>
                        <button
                          type="button"
                          className="btn-danger btn-sm"
                          onClick={() => handleDelete(s.id)}
                          disabled={!!deletingId}
                        >
                          {deletingId === s.id ? '…' : 'Delete'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Membership by branch – same as previous “Performance by branch”; no Leads columns */}
      <section className="content-card">
        {error && <div className="auth-error">{error}</div>}
        {loading ? (
          <div className="vendors-loading"><div className="spinner" /><span>Loading...</span></div>
        ) : (
          <>
            <h2 className="page-section-title" style={{ marginTop: 0 }}>Membership by branch</h2>
            <p className="text-muted" style={{ marginBottom: '0.75rem' }}>Click a branch to see membership breakdown.</p>
            {isAdmin && mergedByBranch.length > 0 ? (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Branch</th>
                      <th className="num">Memberships sold</th>
                      <th className="num">Membership sales</th>
                      <th className="num">Appointments this month</th>
                      <th className="num">Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mergedByBranch.map((row) => (
                      <tr key={row.branch}>
                        <td>
                          {row.branchId ? (
                            <button
                              type="button"
                              className="branch-name-link"
                              onClick={() => setSelectedBranchId(row.branchId!)}
                            >
                              {row.branch}
                            </button>
                          ) : (
                            <strong>{row.branch}</strong>
                          )}
                        </td>
                        <td className="num">{formatNumber(row.membershipCount ?? 0)}</td>
                        <td className="num">{formatCurrency(row.sales ?? row.revenue)}</td>
                        <td className="num">{formatNumber(row.appointmentsThisMonth ?? 0)}</td>
                        <td className="num">{formatNumber(row.appointmentsCompleted ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : !isAdmin && data && (data.breakdown?.length ?? 0) > 0 ? (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Customer name</th>
                      <th>Package name</th>
                      <th className="num">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.breakdown || []).map((row, i) => (
                      <tr key={`${row.customerName}-${row.packageName}-${i}`}>
                        <td>{row.customerName}</td>
                        <td>{row.packageName}</td>
                        <td className="num">{formatCurrency(row.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="vendors-empty">No data for this period.</p>
            )}

            {/* Branch details panel – membership breakdown only (manual sales are in the table above) */}
            {selectedBranchId && (
              <div
                className="page-section content-card sales-branch-detail"
                style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  background: 'var(--theme-bg-subtle)',
                  borderRadius: 8,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.75rem',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <h3 className="page-section-title" style={{ margin: 0 }}>
                    Membership breakdown – {selectedBranchName ?? 'branch'}
                  </h3>
                  <button
                    type="button"
                    className="filter-btn"
                    onClick={() => {
                      setSelectedBranchId(null);
                      setDetailBreakdownPage(1);
                    }}
                  >
                    Close
                  </button>
                </div>

                {/* Customer/package breakdown */}
                {detailLoading ? (
                  <div className="vendors-loading"><div className="spinner" /><span>Loading...</span></div>
                ) : (
                  <>
                    {filteredBreakdown.length === 0 ? (
                      <p className="vendors-empty">No breakdown data for this branch.</p>
                    ) : (
                      <div className="data-table-wrap">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Customer name</th>
                              <th>Package name</th>
                              <th className="num">Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredBreakdown.map((row, i) => (
                              <tr key={`${row.customerName}-${row.packageName}-${i}`}>
                                <td>{row.customerName}</td>
                                <td>{row.packageName}</td>
                                <td className="num">{formatCurrency(row.price)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {(detailData?.breakdownTotal ?? 0) > 0 && !packageId && (
                      <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <span className="text-muted">
                          Showing {Math.min((detailData?.breakdownPage ?? 1) * breakdownLimit - breakdownLimit + 1, detailData?.breakdownTotal ?? 0)}
                          –{Math.min((detailData?.breakdownPage ?? 1) * breakdownLimit, detailData?.breakdownTotal ?? 0)} of {detailData?.breakdownTotal}
                        </span>
                        <button
                          type="button"
                          className="filter-btn"
                          disabled={detailBreakdownPage <= 1}
                          onClick={() => setDetailBreakdownPage((p) => Math.max(1, p - 1))}
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          className="filter-btn"
                          disabled={((detailData?.breakdownPage ?? 1) * breakdownLimit) >= (detailData?.breakdownTotal ?? 0)}
                          onClick={() => setDetailBreakdownPage((p) => p + 1)}
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* Add manual sale modal */}
      {showAddManualModal && (
        <div
          className="modal-overlay"
          onClick={() => !addModalSubmitting && setShowAddManualModal(false)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Escape' && !addModalSubmitting && setShowAddManualModal(false)}
        >
          <div className="modal-content sales-add-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="page-section-title" style={{ marginTop: 0 }}>Add manual sale</h3>
            <form onSubmit={handleAddManualModalSubmit} className="sales-record-form">
              <div className="sales-record-fields">
                {isAdmin && (
                  <div className="sales-record-field">
                    <label htmlFor="add-modal-branch">Branch</label>
                    <select
                      id="add-modal-branch"
                      value={addModalBranchId}
                      onChange={(e) => setAddModalBranchId(e.target.value)}
                      required
                    >
                      <option value="">Select branch</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="sales-record-field">
                  <label htmlFor="add-modal-date">Date</label>
                  <input
                    id="add-modal-date"
                    type="date"
                    value={addModalDate}
                    onChange={(e) => setAddModalDate(e.target.value)}
                    required
                  />
                </div>
                <div className="sales-record-field">
                  <label htmlFor="add-modal-amount">Amount ($)</label>
                  <input
                    id="add-modal-amount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={addModalAmount}
                    onChange={(e) => setAddModalAmount(e.target.value)}
                    placeholder="e.g. 150.00"
                    required
                  />
                </div>
                <div className="sales-record-field">
                  <label htmlFor="add-modal-image">Receipt image (optional)</label>
                  <input
                    id="add-modal-image"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setAddModalImage(e.target.files?.[0] || null)}
                  />
                </div>
              </div>
              {addModalError && <div className="alert alert-error sales-record-error">{addModalError}</div>}
              <div className="sales-record-actions">
                <button type="submit" className="btn-primary" disabled={addModalSubmitting}>
                  {addModalSubmitting ? 'Saving…' : 'Save'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => !addModalSubmitting && setShowAddManualModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewImage && (
        <div
          className="modal-overlay sales-images-modal-overlay"
          onClick={() => setViewImage(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Escape' && setViewImage(null)}
        >
          <div className="modal-content sales-images-modal" onClick={(e) => e.stopPropagation()}>
            <img
              src={`data:image/jpeg;base64,${viewImage}`}
              alt="Receipt"
              className="sales-images-modal-img"
              style={{ maxWidth: '100%', maxHeight: '85vh' }}
            />
            <div className="sales-images-modal-actions">
              <a
                href={`data:image/jpeg;base64,${viewImage}`}
                download="receipt.jpg"
                className="filter-btn"
              >
                Download
              </a>
              <button type="button" className="modal-close" onClick={() => setViewImage(null)}>
                ×
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
