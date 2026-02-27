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
  const [manualSales, setManualSales] = useState<ManualSale[]>([]);
  const [manualSalesLoading, setManualSalesLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addDate, setAddDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [addAmount, setAddAmount] = useState('');
  const [addImage, setAddImage] = useState<File | null>(null);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState('');
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const fetchManualSales = useCallback(() => {
    if (!selectedBranchId) return;
    setManualSalesLoading(true);
    getManualSales({
      from: dateFrom,
      to: dateTo,
      branchId: selectedBranchId,
    }).then((r) => {
      setManualSalesLoading(false);
      if (r.success) setManualSales(r.sales || []);
    });
  }, [selectedBranchId, dateFrom, dateTo]);

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
      setManualSales([]);
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
  }, [selectedBranchId, dateFrom, dateTo, selectedPackageName, detailBreakdownPage, fetchManualSales]);

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

  async function handleAddSale(e: React.FormEvent) {
    e.preventDefault();
    setAddError('');
    const amount = parseFloat(addAmount);
    if (isNaN(amount) || amount < 0) {
      setAddError('Enter a valid amount (0 or more).');
      return;
    }
    if (!selectedBranchId) {
      setAddError('Branch is required.');
      return;
    }
    if (!addDate) {
      setAddError('Date is required.');
      return;
    }

    let imageBase64: string | undefined;
    if (addImage) {
      const base64 = await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string)?.split(',')[1] || null);
        reader.readAsDataURL(addImage);
      });
      if (base64) imageBase64 = base64;
    }

    setAddSubmitting(true);
    const r = await createManualSale({
      branchId: selectedBranchId,
      date: addDate,
      amount,
      imageBase64,
    });
    setAddSubmitting(false);

    if (r.success) {
      setShowAddForm(false);
      setAddAmount('');
      setAddDate(new Date().toISOString().slice(0, 10));
      setAddImage(null);
      fetchManualSales();
    } else setAddError(r.message || 'Failed to record sale');
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
    if (r.success) fetchManualSales();
  }

  const filteredBreakdown = detailData?.breakdown ?? [];

  return (
    <div className="dashboard-content sales-page">
      <header className="page-hero">
        <h1 className="page-hero-title">Sales dashboard</h1>
        <p className="page-hero-subtitle">
          Full visibility across branches: revenue, memberships, appointments, and manual sales.
        </p>
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

      {/* Summary stats */}
      {!overviewLoading && (isAdmin || data) && (
        <section className="content-card" style={{ marginBottom: '1.25rem' }}>
          <div className="owner-hero-stats" style={{ marginTop: 0, marginBottom: 0 }}>
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
                  <span className="owner-hero-stat-label">Appointments this month</span>
                </div>
              </>
            )}
            <div className="owner-hero-stat">
              <span className="owner-hero-stat-value">
                {loading || dashboardManualSalesLoading ? '…' : formatCurrency(membershipSales)}
              </span>
              <span className="owner-hero-stat-label">Membership sales {isAdmin && !branchId ? '(all branches)' : ''}</span>
            </div>
            <div className="owner-hero-stat">
              <span className="owner-hero-stat-value">
                {loading || dashboardManualSalesLoading ? '…' : formatCurrency(totalSales)}
              </span>
              <span className="owner-hero-stat-label">Total sales (membership + manual) {isAdmin && !branchId ? '(all branches)' : ''}</span>
            </div>
          </div>
        </section>
      )}

      {/* Membership sales section */}
      {(isAdmin || data) && (
        <section className="content-card" style={{ marginBottom: '1.25rem' }}>
          <h2 className="page-section-title" style={{ marginTop: 0 }}>Membership sales</h2>
          <p className="text-muted" style={{ marginBottom: '1rem' }}>
            Revenue from membership packages sold. Total sales above also includes manually recorded daily sales amounts.
          </p>
          <div className="owner-hero-stats" style={{ marginTop: 0, marginBottom: 0, flexWrap: 'wrap' }}>
            <div className="owner-hero-stat">
              <span className="owner-hero-stat-value">
                {loading ? '…' : formatCurrency(membershipSales)}
              </span>
              <span className="owner-hero-stat-label">Membership sales total {isAdmin && !branchId ? '(all branches)' : ''}</span>
            </div>
          </div>
        </section>
      )}

      {/* Cross-branch settlement */}
      {isAdmin && settlementSummary.length > 0 && (
        <section className="content-card owner-settlement" style={{ marginBottom: '1.25rem' }}>
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

      {/* Performance by branch – consolidated (no Leads, Leads booked, Lead conversion) */}
      <section className="content-card">
        {error && <div className="auth-error">{error}</div>}
        {loading ? (
          <div className="vendors-loading"><div className="spinner" /><span>Loading...</span></div>
        ) : (
          <>
            <h2 className="page-section-title" style={{ marginTop: 0 }}>Performance by branch</h2>
            <p className="text-muted" style={{ marginBottom: '0.75rem' }}>Click a branch name to see details and manual sales.</p>
            {isAdmin && mergedByBranch.length > 0 ? (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Branch</th>
                      <th className="num">Memberships sold</th>
                      <th className="num">Total sales</th>
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

            {/* Branch details panel – with manual sales */}
            {selectedBranchId && (
              <div
                className="page-section content-card sales-branch-detail"
                style={{
                  marginTop: '1.5rem',
                  padding: '1.25rem',
                  background: 'var(--theme-bg-subtle)',
                  borderRadius: 8,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                  }}
                >
                  <h3 className="page-section-title" style={{ margin: 0 }}>
                    Details for {selectedBranchName ?? 'branch'}
                  </h3>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="auth-submit memberships-create-btn"
                      onClick={() => {
                        setShowAddForm(!showAddForm);
                        setAddError('');
                      }}
                    >
                      {showAddForm ? 'Cancel' : '+ Add manual sale'}
                    </button>
                    <button
                      type="button"
                      className="filter-btn"
                      onClick={() => {
                        setSelectedBranchId(null);
                        setDetailBreakdownPage(1);
                        setShowAddForm(false);
                      }}
                    >
                      Close
                    </button>
                  </div>
                </div>

                {showAddForm && (
                  <form onSubmit={handleAddSale} className="sales-record-form" style={{ marginBottom: '1.5rem', maxWidth: '420px' }}>
                    <div className="sales-record-fields">
                      <div className="sales-record-field">
                        <label htmlFor="add-date">Date</label>
                        <input
                          id="add-date"
                          type="date"
                          value={addDate}
                          onChange={(e) => setAddDate(e.target.value)}
                          required
                        />
                      </div>
                      <div className="sales-record-field">
                        <label htmlFor="add-amount">Amount ($)</label>
                        <input
                          id="add-amount"
                          type="number"
                          min={0}
                          step="0.01"
                          value={addAmount}
                          onChange={(e) => setAddAmount(e.target.value)}
                          placeholder="e.g. 150.00"
                          required
                        />
                      </div>
                      <div className="sales-record-field">
                        <label htmlFor="add-image">Receipt (optional)</label>
                        <input
                          id="add-image"
                          type="file"
                          accept="image/*"
                          onChange={(e) => setAddImage(e.target.files?.[0] || null)}
                        />
                      </div>
                    </div>
                    {addError && <div className="alert alert-error sales-record-error">{addError}</div>}
                    <div className="sales-record-actions">
                      <button type="submit" className="btn-primary" disabled={addSubmitting}>
                        {addSubmitting ? 'Saving…' : 'Save'}
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => setShowAddForm(false)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {/* Manual sales table – date, amount, view/download, delete */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 className="page-section-title" style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Manual sales</h4>
                  {manualSalesLoading ? (
                    <div className="loading-placeholder">Loading…</div>
                  ) : manualSales.length === 0 ? (
                    <p className="text-muted" style={{ margin: 0 }}>No manual sales for this branch in the selected period.</p>
                  ) : (
                    <div className="data-table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th className="num">Amount</th>
                            <th>Receipt</th>
                            {isAdmin && <th></th>}
                          </tr>
                        </thead>
                        <tbody>
                          {manualSales.map((s) => (
                            <tr key={s.id}>
                              <td>
                                <button
                                  type="button"
                                  className="branch-name-link"
                                  onClick={() => s.hasImage && handleViewImage(s.id)}
                                  title={s.hasImage ? 'Click to view receipt' : undefined}
                                >
                                  {new Date(s.date).toLocaleDateString()}
                                </button>
                              </td>
                              <td className="num">
                                <button
                                  type="button"
                                  className="branch-name-link"
                                  onClick={() => s.hasImage && handleViewImage(s.id)}
                                  title={s.hasImage ? 'Click to view receipt' : undefined}
                                >
                                  {formatCurrency(s.amount)}
                                </button>
                              </td>
                              <td>
                                {s.hasImage ? (
                                  <span style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <button type="button" className="btn-link" onClick={() => handleViewImage(s.id)}>
                                      View
                                    </button>
                                    <button type="button" className="btn-link" onClick={() => handleDownloadImage(s.id)}>
                                      Download
                                    </button>
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
                </div>

                {/* Customer/package breakdown */}
                <h4 className="page-section-title" style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Membership breakdown</h4>
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
            <button type="button" className="modal-close" onClick={() => setViewImage(null)}>
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
