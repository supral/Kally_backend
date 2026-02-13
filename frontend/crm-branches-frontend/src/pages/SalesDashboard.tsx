import { useEffect, useState } from 'react';
import { getSalesDashboard } from '../api/reports';
import { getBranches } from '../api/branches';
import { useAuth } from '../auth/hooks/useAuth';
import type { SalesDashboard as SalesDashboardType } from '../types/crm';
import type { Branch } from '../types/crm';

export default function SalesDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<SalesDashboardType | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (isAdmin) getBranches().then((r) => r.success && r.branches && setBranches(r.branches));
  }, [isAdmin]);

  useEffect(() => {
    setLoading(true);
    getSalesDashboard({
      branchId: branchId || undefined,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to).toISOString() : undefined,
    }).then((r) => {
      setLoading(false);
      if (r.success && r.data) setData(r.data);
      else setError(r.message || 'Failed to load');
    });
  }, [branchId, from, to]);

  return (
    <div className="dashboard-content">
      <section className="content-card">
        <h2>Sales dashboard</h2>
        <p>Revenue, memberships, and filters by branch, date, and service.</p>
        <div className="sales-filters">
          {isAdmin && (
            <label>
              <span>Branch</span>
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span>From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            <span>To</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        {error && <div className="auth-error">{error}</div>}
        {loading ? (
          <div className="vendors-loading"><div className="spinner" /><span>Loading...</span></div>
        ) : data && (
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-value">{data.totalRevenue}</span>
                <span className="stat-label">Total revenue</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{data.totalMemberships}</span>
                <span className="stat-label">Memberships sold</span>
              </div>
            </div>
            {data.byBranch && data.byBranch.length > 0 && (
              <div className="report-section">
                <h3>By branch</h3>
                <ul className="report-list">
                  {data.byBranch.map((x) => (
                    <li key={x.branch}><strong>{x.branch}</strong>: {x.revenue}</li>
                  ))}
                </ul>
              </div>
            )}
            {data.byService && data.byService.length > 0 && (
              <div className="report-section">
                <h3>By service category</h3>
                <ul className="report-list">
                  {data.byService.map((x) => (
                    <li key={x.serviceCategory}><strong>{x.serviceCategory}</strong>: {x.revenue}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
