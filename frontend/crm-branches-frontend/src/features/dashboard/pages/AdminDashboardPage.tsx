import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useAuth } from '../../../auth/hooks/useAuth';
import { getVendors } from '../../../api/vendors';
import { getBranches } from '../../../api/branches';
import { getSalesDashboard, getOwnerOverview, getSettlements } from '../../../api/reports';
import { getSalesImages, getSalesImage, type SalesImageItem, type SalesImageDetail } from '../../../api/salesImages';
import type { SalesDashboard, OwnerOverviewBranch, Settlement } from '../../../types/crm';
import type { Branch } from '../../../types/crm';
import type { VendorListItem } from '../../../types/auth';
import { ROUTES } from '../../../config/constants';
import { formatCurrency } from '../../../utils/money';
import { formatNumber } from '../../../utils/money';

type DatePreset = '7d' | '30d' | '90d' | 'custom';

function getDateRange(preset: DatePreset): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (preset === '7d') from.setDate(from.getDate() - 7);
  else if (preset === '30d') from.setDate(from.getDate() - 30);
  else if (preset === '90d') from.setDate(from.getDate() - 90);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [from] = useState(() => getDateRange('30d').from);
  const [to] = useState(() => getDateRange('30d').to);
  const [branchId] = useState('');
  const [totalVendors, setTotalVendors] = useState<number | null>(null);
  const [totalBranches, setTotalBranches] = useState<number | null>(null);
  const [pendingVendors, setPendingVendors] = useState<number | null>(null);
  const [salesData, setSalesData] = useState<SalesDashboard | null>(null);
  const [overview, setOverview] = useState<OwnerOverviewBranch[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [, setVendors] = useState<VendorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [salesLoading, setSalesLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [settlementsLoading, setSettlementsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [branchSalesImages, setBranchSalesImages] = useState<SalesImageItem[]>([]);
  const [branchSalesLoading, setBranchSalesLoading] = useState(false);
  const [viewImageDetail, setViewImageDetail] = useState<SalesImageDetail | null>(null);
  const [viewImageIndex, setViewImageIndex] = useState(0);

  const loadSettlements = useCallback(() => {
    setSettlementsLoading(true);
    getSettlements().then((r) => {
      setSettlementsLoading(false);
      if (r.success && r.settlements) setSettlements(r.settlements);
    }).catch(() => setSettlementsLoading(false));
  }, []);

  const loadCounts = useCallback(() => {
    setLoading(true);
    Promise.all([
      getVendors(),
      getVendors('pending'),
      getBranches(),
    ]).then(([allRes, pendingRes, branchesRes]) => {
      setLoading(false);
      if (allRes.success && allRes.vendors != null) {
        setTotalVendors(allRes.vendors.length);
        setVendors(allRes.vendors);
      }
      if (pendingRes.success && pendingRes.vendors != null) setPendingVendors(pendingRes.vendors.length);
      if (branchesRes.success && branchesRes.branches != null) {
        setTotalBranches(branchesRes.branches.length);
        setBranches(branchesRes.branches);
      }
    }).catch(() => setLoading(false));
  }, []);

  const loadSales = useCallback(() => {
    setSalesLoading(true);
    setError('');
    getSalesDashboard({
      branchId: branchId || undefined,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to).toISOString() : undefined,
    }).then((r) => {
      setSalesLoading(false);
      if (r.success && r.data) setSalesData(r.data);
      else setError(r.message || 'Failed to load sales');
    });
  }, [branchId, from, to]);

  const loadOverview = useCallback(() => {
    setOverviewLoading(true);
    getOwnerOverview().then((r) => {
      setOverviewLoading(false);
      if (r.success && r.overview) setOverview(r.overview);
    });
  }, []);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  useEffect(() => {
    loadOverview();
    loadSettlements();
  }, [loadOverview, loadSettlements]);

  const loadBranchSales = useCallback(() => {
    if (!selectedBranchId) {
      setBranchSalesImages([]);
      return;
    }
    setBranchSalesLoading(true);
    getSalesImages({ branchId: selectedBranchId })
      .then((r) => {
        setBranchSalesLoading(false);
        if (r.success && r.images) setBranchSalesImages(r.images);
        else setBranchSalesImages([]);
      })
      .catch(() => setBranchSalesLoading(false));
  }, [selectedBranchId]);

  useEffect(() => {
    loadBranchSales();
  }, [loadBranchSales]);

  async function handleViewBranchReceipt(id: string) {
    const r = await getSalesImage(id);
    if (r.success && r.image) {
      setViewImageDetail(r.image);
      setViewImageIndex(0);
    }
  }

  function closeViewImage() {
    setViewImageDetail(null);
    setViewImageIndex(0);
  }

  const chartMembershipByBranch = overview.map((o) => ({ name: o.branchName, memberships: o.membershipsSold })).filter((d) => d.memberships > 0 || overview.length <= 10);
  const totalLeads = overview.reduce((s, o) => s + (o.leads ?? 0), 0);
  const totalAppointments = overview.reduce((s, o) => s + (o.appointmentsThisMonth ?? 0), 0);
  const systemGrowthData = [
    { name: 'Vendors', value: totalVendors ?? 0, fill: 'var(--theme-link)' },
    { name: 'Branches', value: totalBranches ?? 0, fill: '#8b5cf6' },
    { name: 'Active memberships', value: salesData?.activeMembershipCount ?? 0, fill: '#06b6d4' },
    { name: 'Total leads', value: totalLeads, fill: '#f59e0b' },
    { name: 'Appointments (month)', value: totalAppointments, fill: '#10b981' },
    { name: 'Pending approvals', value: pendingVendors ?? 0, fill: '#ef4444' },
  ].filter((d) => d.value > 0 || d.name === 'Vendors' || d.name === 'Branches');

  return (
    <div className="dashboard-content admin-dashboard">
      <header className="admin-dashboard-hero">
        <div className="admin-dashboard-hero-inner">
          <h1 className="admin-dashboard-hero-title">Welcome back, {user?.name}</h1>
          <p className="admin-dashboard-hero-subtitle">Overview of vendors, branches, sales, and performance.</p>
        </div>
      </header>

      {error && <div className="auth-error admin-dashboard-error" role="alert">{error}</div>}

      <div className="admin-dashboard-bottom">
      <h2 className="admin-dashboard-section-title">Key metrics</h2>
      <div className="admin-dashboard-kpis stats-grid">
        <div className="stat-card admin-kpi">
          <span className="stat-value">{loading ? '…' : formatNumber(totalVendors ?? 0)}</span>
          <span className="stat-label">Total vendors</span>
          <Link to={ROUTES.admin.vendors} className="stat-link">View →</Link>
        </div>
        <div className="stat-card admin-kpi">
          <span className="stat-value">{loading ? '…' : formatNumber(totalBranches ?? 0)}</span>
          <span className="stat-label">Active branches</span>
          <Link to={ROUTES.admin.branches} className="stat-link">View →</Link>
        </div>
        <div className="stat-card admin-kpi admin-kpi-highlight">
          <span className="stat-value">{salesLoading ? '…' : formatCurrency(salesData?.totalSales ?? salesData?.totalRevenue ?? 0)}</span>
          <span className="stat-label">Total sales</span>
          <Link to={ROUTES.admin.sales} className="stat-link">Details →</Link>
        </div>
        <div className="stat-card admin-kpi">
          <span className="stat-value">{salesLoading ? '…' : formatNumber(salesData?.activeMembershipCount ?? salesData?.totalMemberships ?? 0)}</span>
          <span className="stat-label">Active memberships</span>
          <Link to={ROUTES.admin.memberships} className="stat-link">View →</Link>
        </div>
        <div className="stat-card admin-kpi">
          <span className="stat-value">{overviewLoading ? '…' : formatNumber(totalLeads)}</span>
          <span className="stat-label">Total leads</span>
          <Link to={ROUTES.admin.leads} className="stat-link">Leads inbox →</Link>
        </div>
      </div>

      <div className="admin-dashboard-charts-section">
      <h2 className="admin-dashboard-section-title">Analytics</h2>
      <div className="admin-dashboard-charts">
        <section className="content-card admin-chart-card admin-chart-card-full">
          <h3>Memberships by branch</h3>
          {overviewLoading ? (
            <div className="admin-chart-loading"><div className="spinner" /><span>Loading...</span></div>
          ) : chartMembershipByBranch.length > 0 ? (
            <div className="admin-chart-wrap">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartMembershipByBranch} margin={{ top: 12, right: 12, left: 12, bottom: 60 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--theme-border)" />
                  <XAxis type="number" tick={{ fill: 'var(--theme-text)', fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fill: 'var(--theme-text)', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--theme-bg-card)', border: '1px solid var(--theme-border)', borderRadius: 8 }}
                    formatter={(value: number | undefined) => [formatNumber(value ?? 0), 'Memberships']}
                    labelFormatter={(label) => `Branch: ${label}`}
                  />
                  <Bar dataKey="memberships" fill="#06b6d4" radius={[0, 4, 4, 0]} name="Memberships sold" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="admin-chart-empty">No membership data by branch.</p>
          )}
        </section>
        <section className="content-card admin-chart-card admin-chart-card-full">
          <h3>System growth & platform overview</h3>
          {(loading || overviewLoading) ? (
            <div className="admin-chart-loading"><div className="spinner" /><span>Loading...</span></div>
          ) : systemGrowthData.length > 0 ? (
            <div className="admin-chart-wrap admin-chart-wrap-horizontal">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={systemGrowthData} margin={{ top: 12, right: 24, left: 12, bottom: 24 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--theme-border)" />
                  <XAxis type="number" tick={{ fill: 'var(--theme-text)', fontSize: 12 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fill: 'var(--theme-text)', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--theme-bg-card)', border: '1px solid var(--theme-border)', borderRadius: 8 }}
                    formatter={(value: number | undefined) => [formatNumber(value ?? 0), 'Count']}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} name="Count">
                    {systemGrowthData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="admin-chart-empty">No platform data yet.</p>
          )}
        </section>
      </div>
      </div>

      <h2 className="admin-dashboard-section-title">Branch &amp; settlements</h2>
      <div className="admin-dashboard-tables">
        <section className="content-card admin-table-card">
          <div className="admin-table-header">
            <h3>Branch performance</h3>
            <button type="button" className="admin-table-refresh" onClick={loadOverview}>↻</button>
          </div>
          {overviewLoading ? (
            <div className="admin-chart-loading"><div className="spinner" /><span>Loading...</span></div>
          ) : overview.length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Branch</th>
                    <th>Memberships sold</th>
                    <th>Leads</th>
                    <th>Leads booked</th>
                    <th>Appointments (month)</th>
                    <th>Completed</th>
                    <th className="th-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.map((row) => (
                    <tr key={row.branchId}>
                      <td><strong>{row.branchName}</strong></td>
                      <td>{formatNumber(row.membershipsSold)}</td>
                      <td>{formatNumber(row.leads)}</td>
                      <td>{formatNumber(row.leadsBooked)}</td>
                      <td>{formatNumber(row.appointmentsThisMonth)}</td>
                      <td>{formatNumber(row.appointmentsCompleted)}</td>
                      <td className="branch-actions">
                        <Link to={ROUTES.admin.branches} className="branch-action-btn branch-action-view">Manage →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="admin-chart-empty">No branch overview data.</p>
          )}
        </section>
        <section className="content-card admin-table-card">
          <div className="admin-table-header">
            <h3>Recent settlements</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button type="button" className="admin-table-refresh" onClick={loadSettlements} aria-label="Refresh settlements">↻</button>
              <Link to={ROUTES.admin.settlements} className="stat-link">View all →</Link>
            </div>
          </div>
          {settlementsLoading && !settlements.length ? (
            <div className="admin-chart-loading"><div className="spinner" /><span>Loading...</span></div>
          ) : settlements.length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>From → To</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.slice(0, 10).map((s) => (
                    <tr key={s.id}>
                      <td>{s.fromBranch} → {s.toBranch}</td>
                      <td>{formatCurrency(s.amount)}</td>
                      <td><span className={`settlement-status settlement-status-${s.status?.toLowerCase()}`}>{s.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="admin-chart-empty">No settlements.</p>
          )}
        </section>
        <section className="content-card admin-table-card">
          <div className="admin-table-header">
            <h3>Branch Sales Data</h3>
            <div className="admin-branch-sales-header">
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="admin-branch-sales-select"
                aria-label="Select branch"
              >
                <option value="">Select branch…</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              {selectedBranchId && (
                <button type="button" className="admin-table-refresh" onClick={loadBranchSales} aria-label="Refresh">↻</button>
              )}
            </div>
          </div>
          {!selectedBranchId ? (
            <p className="admin-chart-empty">Select a branch to view its Sales Data.</p>
          ) : branchSalesLoading ? (
            <div className="admin-chart-loading"><div className="spinner" /><span>Loading...</span></div>
          ) : branchSalesImages.length === 0 ? (
            <p className="admin-chart-empty">No Sales Data for this branch.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table admin-table-clickable">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Date</th>
                    <th>Sales count</th>
                    <th>Amount</th>
                    <th className="th-actions">View</th>
                  </tr>
                </thead>
                <tbody>
                  {branchSalesImages.map((img) => (
                    <tr
                      key={img.id}
                      onClick={() => handleViewBranchReceipt(img.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && handleViewBranchReceipt(img.id)}
                    >
                      <td><strong>{img.title}</strong></td>
                      <td>{new Date(img.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      <td>{img.manualSalesCount ?? img.salesCount}</td>
                      <td>{(img.salesAmount != null && img.salesAmount > 0) ? formatCurrency(img.salesAmount) : '—'}</td>
                      <td className="branch-actions">
                        <span className="branch-action-btn branch-action-view">View receipt →</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {viewImageDetail && (
        <div
          className="sales-images-modal-overlay"
          onClick={closeViewImage}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Escape' && closeViewImage()}
        >
          <div className="sales-images-modal sales-images-modal-with-sidebar" onClick={(e) => e.stopPropagation()}>
            <div className="sales-images-modal-main">
              {viewImageDetail.imageBase64s && viewImageDetail.imageBase64s.length > 0 ? (
                <>
                  <img
                    src={viewImageDetail.imageBase64s[viewImageIndex]?.startsWith('data:') ? viewImageDetail.imageBase64s[viewImageIndex] : `data:image/jpeg;base64,${viewImageDetail.imageBase64s[viewImageIndex]}`}
                    alt={`Sales receipt ${viewImageIndex + 1} of ${viewImageDetail.imageBase64s.length}`}
                    className="sales-images-modal-img"
                  />
                  {viewImageDetail.imageBase64s.length > 1 && (
                    <div className="sales-images-modal-nav">
                      <button
                        type="button"
                        className="sales-images-modal-nav-btn"
                        onClick={(e) => { e.stopPropagation(); setViewImageIndex((i) => Math.max(0, i - 1)); }}
                        disabled={viewImageIndex <= 0}
                        aria-label="Previous image"
                      >
                        ‹
                      </button>
                      <span className="sales-images-modal-nav-label">
                        {viewImageIndex + 1} / {viewImageDetail.imageBase64s.length}
                      </span>
                      <button
                        type="button"
                        className="sales-images-modal-nav-btn"
                        onClick={(e) => { e.stopPropagation(); setViewImageIndex((i) => Math.min(viewImageDetail.imageBase64s.length - 1, i + 1)); }}
                        disabled={viewImageIndex >= viewImageDetail.imageBase64s.length - 1}
                        aria-label="Next image"
                      >
                        ›
                      </button>
                    </div>
                  )}
                  {viewImageDetail.imageBase64s.length > 1 && (
                    <div className="sales-images-modal-thumbs">
                      {viewImageDetail.imageBase64s.map((src, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className={`sales-images-modal-thumb ${viewImageIndex === idx ? 'active' : ''}`}
                          onClick={(e) => { e.stopPropagation(); setViewImageIndex(idx); }}
                          aria-label={`View image ${idx + 1}`}
                        >
                          <img src={src.startsWith('data:') ? src : `data:image/jpeg;base64,${src}`} alt="" />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="sales-images-modal-no-img">No images</div>
              )}
            </div>
            <aside className="sales-images-modal-sidebar">
              <div className="sales-images-sidebar-header">
                <h3 className="sales-images-sidebar-title">{viewImageDetail.title}</h3>
                <span className="sales-images-sidebar-date">
                  {new Date(viewImageDetail.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="sales-images-sidebar-badge">{viewImageDetail.branchName}</span>
              </div>
              {(viewImageDetail.description != null && viewImageDetail.description !== '') && (
                <p className="sales-images-sidebar-desc">{viewImageDetail.description}</p>
              )}
              <div className="sales-images-sidebar-stats">
                <div className="sales-images-sidebar-stat">
                  <span className="sales-images-sidebar-count">{viewImageDetail.salesCount}</span>
                  <span className="sales-images-sidebar-count-label">sales {viewImageDetail.manualSalesCount != null ? '(manual)' : ''}</span>
                </div>
                {(viewImageDetail.salesAmount != null && viewImageDetail.salesAmount > 0) && (
                  <div className="sales-images-sidebar-stat">
                    <span className="sales-images-sidebar-count">{formatCurrency(viewImageDetail.salesAmount)}</span>
                    <span className="sales-images-sidebar-count-label">sales amount</span>
                  </div>
                )}
              </div>
            </aside>
            <button type="button" className="sales-images-modal-close" onClick={closeViewImage} aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
