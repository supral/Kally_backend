import { useEffect, useState } from 'react';
import { getSalesDashboard } from '../../../api/reports';
import { getBranches } from '../../../api/branches';
import { useAuth } from '../../../auth/hooks/useAuth';
import { formatCurrency, formatNumber } from '../../../utils/money';
import type { SalesDashboard as SalesDashboardType } from '../../../types/common';
import type { Branch } from '../../../types/common';

const breakdownLimit = 10;

export default function BranchDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<SalesDashboardType | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<SalesDashboardType | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailBreakdownPage, setDetailBreakdownPage] = useState(1);
  const [breakdownPage, setBreakdownPage] = useState(1);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (isAdmin) getBranches().then((r) => r.success && r.branches && setBranches(r.branches));
  }, [isAdmin]);

  useEffect(() => {
    setLoading(true);
    getSalesDashboard({
      branchId: branchId || undefined,
      breakdownPage: isAdmin ? 1 : breakdownPage,
      breakdownLimit: isAdmin ? 1 : breakdownLimit,
    }).then((r) => {
      setLoading(false);
      if (r.success && r.data) setData(r.data);
      else setError(r.message || 'Failed to load');
    });
  }, [branchId, isAdmin, breakdownPage]);

  useEffect(() => {
    if (!selectedBranchId) {
      setDetailData(null);
      return;
    }
    setDetailLoading(true);
    getSalesDashboard({
      branchId: selectedBranchId,
      breakdownPage: detailBreakdownPage,
      breakdownLimit,
    }).then((r) => {
      setDetailLoading(false);
      if (r.success && r.data) setDetailData(r.data);
      else setDetailData(null);
    });
  }, [selectedBranchId, detailBreakdownPage]);

  const selectedBranchName = selectedBranchId && (data?.branches?.find((b) => b.id === selectedBranchId)?.name ?? branches.find((b) => b.id === selectedBranchId)?.name);

  return (
    <div className="dashboard-content">
      <header className="page-hero">
        <h1 className="page-hero-title">Sales dashboard</h1>
        <p className="page-hero-subtitle">Total sales, memberships, and breakdown by customer and package.</p>
      </header>
      <section className="content-card">
        {isAdmin && (
          <div className="sales-filters">
            <label>
              <span>Branch</span>
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
          </div>
        )}
        {error && <div className="auth-error">{error}</div>}
        {loading ? (
          <div className="vendors-loading"><div className="spinner" /><span>Loading...</span></div>
        ) : data && (
          <>
            <div className="owner-hero-stats" style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
              <div className="owner-hero-stat">
                <span className="owner-hero-stat-value">
                  {typeof data.totalSales === 'number'
                    ? formatCurrency(data.totalSales)
                    : typeof data.totalRevenue === 'number'
                      ? formatCurrency(data.totalRevenue)
                      : '—'}
                </span>
                <span className="owner-hero-stat-label">Total sales {isAdmin && !branchId ? '(all branches)' : ''}</span>
              </div>
            </div>
            {isAdmin && (data.byBranch?.length ?? 0) > 0 && (
              <>
                <div className="page-section" style={{ marginBottom: '1.5rem' }}>
                  <h2 className="page-section-title">Sales by branch</h2>
                  <p className="text-muted" style={{ marginBottom: '0.75rem' }}>Click a branch name to see customer/package breakdown.</p>
                  <div className="data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Branch name</th>
                          <th className="num">Total sales</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.byBranch.map((row) => {
                          const branchIdForRow = data.branches?.find((b) => b.name === row.branch)?.id ?? branches.find((b) => b.name === row.branch)?.id;
                          return (
                            <tr key={row.branch}>
                              <td>
                                {branchIdForRow ? (
                                  <button
                                    type="button"
                                    className="branch-name-link"
                                    onClick={() => setSelectedBranchId(branchIdForRow)}
                                  >
                                    {row.branch}
                                  </button>
                                ) : (
                                  <strong>{row.branch}</strong>
                                )}
                              </td>
                              <td className="num">{formatCurrency(row.sales ?? row.revenue)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="page-section" style={{ marginBottom: '1.5rem' }}>
                  <h2 className="page-section-title">Memberships by branch</h2>
                  <div className="data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Branch</th>
                          <th className="num">Total number</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.byBranch.map((row) => (
                          <tr key={row.branch}>
                            <td><strong>{row.branch}</strong></td>
                            <td className="num">{formatNumber(row.membershipCount ?? 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
            {!isAdmin && data && (data.breakdown?.length ?? 0) > 0 && (
              <div className="page-section" style={{ marginBottom: '1.5rem' }}>
                <h2 className="page-section-title">Breakdown (Customer, Package, Price)</h2>
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
                {(data.breakdownTotal ?? 0) > 0 && (
                  <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span className="text-muted">
                      Showing {Math.min((data.breakdownPage ?? 1) * breakdownLimit - breakdownLimit + 1, data.breakdownTotal ?? 0)}–{Math.min((data.breakdownPage ?? 1) * breakdownLimit, data.breakdownTotal ?? 0)} of {data.breakdownTotal}
                    </span>
                    <button type="button" className="filter-btn" disabled={breakdownPage <= 1} onClick={() => setBreakdownPage((p) => Math.max(1, p - 1))}>Previous</button>
                    <button type="button" className="filter-btn" disabled={((data.breakdownPage ?? 1) * breakdownLimit) >= (data.breakdownTotal ?? 0)} onClick={() => setBreakdownPage((p) => p + 1)}>Next</button>
                  </div>
                )}
              </div>
            )}
            {selectedBranchId && (
              <div className="page-section content-card" style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--theme-bg-subtle)', borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h2 className="page-section-title" style={{ margin: 0 }}>Details for {selectedBranchName ?? 'branch'}</h2>
                  <button type="button" className="filter-btn" onClick={() => { setSelectedBranchId(null); setDetailBreakdownPage(1); }}>Close</button>
                </div>
                {detailLoading ? (
                  <div className="vendors-loading"><div className="spinner" /><span>Loading...</span></div>
                ) : detailData && (
                  <>
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
                          {(detailData.breakdown || []).map((row, i) => (
                            <tr key={`${row.customerName}-${row.packageName}-${i}`}>
                              <td>{row.customerName}</td>
                              <td>{row.packageName}</td>
                              <td className="num">{formatCurrency(row.price)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {(!detailData.breakdown || detailData.breakdown.length === 0) && (
                      <p className="vendors-empty">No breakdown data for this branch.</p>
                    )}
                    {(detailData.breakdownTotal ?? 0) > 0 && (
                      <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <span className="text-muted">
                          Showing {Math.min((detailData.breakdownPage ?? 1) * breakdownLimit - breakdownLimit + 1, detailData.breakdownTotal ?? 0)}–{Math.min((detailData.breakdownPage ?? 1) * breakdownLimit, detailData.breakdownTotal ?? 0)} of {detailData.breakdownTotal}
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
                          disabled={((detailData.breakdownPage ?? 1) * breakdownLimit) >= (detailData.breakdownTotal ?? 0)}
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
    </div>
  );
}
