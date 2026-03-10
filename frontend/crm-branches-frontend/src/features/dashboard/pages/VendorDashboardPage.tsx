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
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useAuth } from '../../../auth/hooks/useAuth';
import { getBranchDashboard } from '../../../api/dashboard.api';
import { getCustomers } from '../../../api/customers';
import { ROUTES } from '../../../config/constants';
import { formatCurrency } from '../../../utils/money';
import type { BranchDashboardData } from '../../../api/dashboard.api';
import type { Customer } from '../../../types/crm';

const MEMBERSHIP_STATUS_COLORS = { Active: '#22c55e', Expired: '#f59e0b', Used: '#6366f1' };

type DatePreset = '7d' | '30d' | 'custom';

function getDateRange(preset: '7d' | '30d'): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (preset === '7d') from.setDate(from.getDate() - 7);
  else from.setDate(from.getDate() - 30);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function formatPeriodLabel(fromStr: string | undefined, toStr: string | undefined): string {
  if (!fromStr || !toStr) return '';
  const from = new Date(fromStr);
  const to = new Date(toStr);
  return `${from.toLocaleDateString()} – ${to.toLocaleDateString()}`;
}

export default function VendorDashboardPage() {
  const { user } = useAuth();
  const [datePreset, setDatePreset] = useState<DatePreset>('30d');
  const [from, setFrom] = useState(() => getDateRange('30d').from);
  const [to, setTo] = useState(() => getDateRange('30d').to);

  const [data, setData] = useState<BranchDashboardData | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [loading, setLoading] = useState(true);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(() => {
    setLoading(true);
    setError('');
      const fromDate = new Date(from);
      const toDate = new Date(to);
      if (fromDate > toDate) {
        setLoading(false);
        setError('From date must be before or equal to To date.');
        return;
      }
      getBranchDashboard({ from: fromDate.toISOString(), to: toDate.toISOString() }).then((res) => {
        setLoading(false);
        setError('');
        if (res.success && res.data) setData(res.data);
        else setError(res.message || 'Failed to load dashboard');
      }).catch(() => setLoading(false));
  }, [from, to]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  useEffect(() => {
    setCustomersLoading(true);
    getCustomers().then((r) => {
      setCustomersLoading(false);
      if (r.success && r.customers) setCustomers(r.customers);
    }).catch(() => setCustomersLoading(false));
  }, []);

  if (loading && !data) {
    return (
      <div className="dashboard-content">
        <div className="vendors-loading"><div className="spinner" /><span>Loading...</span></div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="dashboard-content">
        <section className="welcome-card">
          <h2>Welcome, {user?.name}</h2>
          <p>Branch dashboard for {user?.branchName || 'your branch'}.</p>
        </section>
        <div className="auth-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="dashboard-content vendor-dashboard-full">
      <header className="vendor-dashboard-header">
        <div>
          <h1 className="vendor-dashboard-title">Welcome, {user?.name}</h1>
          <p className="vendor-dashboard-subtitle">Your branch: {user?.branchName ?? '—'}</p>
        </div>
        <div className="vendor-dashboard-filters">
          <span className="vendor-dashboard-period-label">Period</span>
          <div className="vendor-dashboard-presets">
            <button
              type="button"
              className={`vendor-dashboard-preset-btn ${datePreset === '7d' ? 'active' : ''}`}
              onClick={() => {
                setDatePreset('7d');
                const r = getDateRange('7d');
                setFrom(r.from);
                setTo(r.to);
              }}
            >
              7 days
            </button>
            <button
              type="button"
              className={`vendor-dashboard-preset-btn ${datePreset === '30d' ? 'active' : ''}`}
              onClick={() => {
                setDatePreset('30d');
                const r = getDateRange('30d');
                setFrom(r.from);
                setTo(r.to);
              }}
            >
              30 days
            </button>
            <button
              type="button"
              className={`vendor-dashboard-preset-btn ${datePreset === 'custom' ? 'active' : ''}`}
              onClick={() => setDatePreset('custom')}
            >
              Custom
            </button>
          </div>
          {datePreset === 'custom' && (
            <div className="vendor-dashboard-custom-dates" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span className="text-muted">From</span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="filter-btn"
                  style={{ padding: '0.35rem 0.5rem' }}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span className="text-muted">To</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="filter-btn"
                  style={{ padding: '0.35rem 0.5rem' }}
                />
              </label>
            </div>
          )}
          <button type="button" className="vendor-dashboard-refresh" onClick={() => loadDashboard()} aria-label="Refresh">
            ↻ Refresh
          </button>
        </div>
      </header>
      {data?.from != null && data?.to != null && (
        <p className="text-muted" style={{ marginTop: '-0.5rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
          Showing data for: {formatPeriodLabel(String(data.from).slice(0, 10), String(data.to).slice(0, 10))}
          {loading && <span style={{ marginLeft: '0.5rem' }}>… updating</span>}
        </p>
      )}

      <section className="vendor-dashboard-kpis">
        <div className="vendor-kpi-card">
          <span className="vendor-kpi-value">{formatCurrency(data?.totalSales ?? 0)}</span>
          <span className="vendor-kpi-label">Total sales (in selected period)</span>
        </div>
        <div className="vendor-kpi-card">
          <span className="vendor-kpi-value">{data?.activeMembershipCount ?? 0}</span>
          <span className="vendor-kpi-label">Total membership</span>
          <Link to={ROUTES.vendor.memberships} className="vendor-kpi-link">View →</Link>
        </div>
        <div className="vendor-kpi-card">
          <span className="vendor-kpi-value">{data?.todayAppointments?.length ?? 0}</span>
          <span className="vendor-kpi-label">Today&apos;s appointments</span>
          <Link to={ROUTES.vendor.appointments} className="vendor-kpi-link">View →</Link>
        </div>
        <div className="vendor-kpi-card">
          <span className="vendor-kpi-value">{data?.servicesCompleted ?? 0}</span>
          <span className="vendor-kpi-label">Services completed</span>
        </div>
        <div className="vendor-kpi-card">
          <span className="vendor-kpi-value">{customersLoading ? '…' : customers.length}</span>
          <span className="vendor-kpi-label">My customers</span>
          <Link to={ROUTES.vendor.customers} className="vendor-kpi-link">View →</Link>
        </div>
        <div className="vendor-kpi-card">
          <span className="vendor-kpi-value">{data?.leadsToFollowUp?.length ?? 0}</span>
          <span className="vendor-kpi-label">Leads to follow up</span>
          <Link to={ROUTES.vendor.leads} className="vendor-kpi-link">Leads inbox →</Link>
        </div>
      </section>

      {data?.leadsToFollowUp && data.leadsToFollowUp.length > 0 && (
        <section className="content-card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 className="vendor-dashboard-section-title" style={{ margin: 0 }}>Leads to follow up</h3>
            <Link to={ROUTES.vendor.leads} className="filter-btn">View all →</Link>
          </div>
          <ul className="report-list" style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {data.leadsToFollowUp.slice(0, 10).map((l) => (
              <li key={l.id}>
                <Link to={ROUTES.vendor.leadDetail(l.id)}>{l.name}</Link>
                {l.phone && ` — ${l.phone}`}
                <span className="text-muted" style={{ marginLeft: '0.5rem' }}>({l.status})</span>
              </li>
            ))}
          </ul>
          {data.leadsToFollowUp.length > 10 && <p className="text-muted" style={{ marginTop: '0.5rem', marginBottom: 0 }}>+ {data.leadsToFollowUp.length - 10} more — <Link to={ROUTES.vendor.leads}>View all</Link></p>}
        </section>
      )}

      {(data?.membershipsExpiringIn7Days !== undefined && data.membershipsExpiringIn7Days > 0) || (data?.membershipsExpiringIn30Days !== undefined && data.membershipsExpiringIn30Days > 0) || (data?.expiredMembershipCount !== undefined && data.expiredMembershipCount > 0) ? (
        <section className="content-card membership-expiry-notification" style={{ marginBottom: '1.5rem' }}>
          <h3 className="vendor-dashboard-section-title" style={{ marginTop: 0 }}>Membership expiry</h3>
          <p className="text-muted" style={{ marginBottom: '1rem' }}>Notify customers to renew before their membership expires.</p>
          <div className="vendor-expiry-alerts">
            {data.membershipsExpiringIn7Days !== undefined && data.membershipsExpiringIn7Days > 0 && (
              <div className="vendor-expiry-alert vendor-expiry-soon">
                <strong>{data.membershipsExpiringIn7Days}</strong> membership{data.membershipsExpiringIn7Days !== 1 ? 's' : ''} expiring in the next 7 days
              </div>
            )}
            {data.membershipsExpiringIn30Days !== undefined && data.membershipsExpiringIn30Days > 0 && data.membershipsExpiringIn7Days !== data.membershipsExpiringIn30Days && (
              <div className="vendor-expiry-alert vendor-expiry-30">
                <strong>{data.membershipsExpiringIn30Days}</strong> membership{data.membershipsExpiringIn30Days !== 1 ? 's' : ''} expiring in the next 30 days
              </div>
            )}
            {data.expiredMembershipCount !== undefined && data.expiredMembershipCount > 0 && (
              <div className="vendor-expiry-alert vendor-expiry-expired">
                <strong>{data.expiredMembershipCount}</strong> membership{data.expiredMembershipCount !== 1 ? 's' : ''} already expired
              </div>
            )}
          </div>
          <Link to={ROUTES.vendor.memberships} className="filter-btn" style={{ marginTop: '0.75rem', display: 'inline-block' }}>View memberships →</Link>
          {data.membershipsExpiringSoonList && data.membershipsExpiringSoonList.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Expiring soon (next 7 days)</h4>
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Package</th>
                      <th>Expiry date</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.membershipsExpiringSoonList.map((m) => (
                      <tr key={m.id}>
                        <td>{m.customerName}{m.customerPhone ? ` (${m.customerPhone})` : ''}</td>
                        <td>{m.packageName}</td>
                        <td>{m.expiryDate ? new Date(m.expiryDate).toLocaleDateString() : '—'}</td>
                        <td><Link to={ROUTES.vendor.membershipDetail(m.id)}>View</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      ) : null}

      <h3 className="vendor-dashboard-section-title">Branch overview</h3>
      <div className="vendor-dashboard-charts-top">
        <section className="content-card vendor-chart-card">
          <h4>Membership status</h4>
          {(() => {
            const membershipPieData = [
              { name: 'Active', value: data?.activeMembershipCount ?? 0, color: MEMBERSHIP_STATUS_COLORS.Active },
              { name: 'Expired', value: data?.expiredMembershipCount ?? 0, color: MEMBERSHIP_STATUS_COLORS.Expired },
              { name: 'Used', value: data?.usedMembershipCount ?? 0, color: MEMBERSHIP_STATUS_COLORS.Used },
            ].filter((d) => d.value > 0);
            if (membershipPieData.length === 0) return <p className="vendor-chart-empty">No membership data yet.</p>;
            return (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={membershipPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {membershipPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'var(--theme-bg-card)', border: '1px solid var(--theme-border)', borderRadius: 8 }}
                    formatter={(value?: number, name?: string) => [value ?? 0, name ?? '']}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            );
          })()}
        </section>
        <section className="content-card vendor-chart-card vendor-chart-sales">
          <h4>Sales in period (this branch)</h4>
          <div className="vendor-chart-sales-value">{formatCurrency(data?.totalSales ?? 0)}</div>
          <p className="text-muted">Revenue from memberships sold in the selected period</p>
        </section>
      </div>
      <section className="content-card vendor-chart-card vendor-chart-counts-full">
        <h4>Counts (this branch)</h4>
        <p className="text-muted" style={{ marginTop: '-0.5rem', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Current: customers &amp; membership status. Period: sales count, services, usage.</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={[
              { name: 'Customers (total)', count: data?.customersCount ?? (customersLoading ? 0 : customers.length), fill: '#3b82f6' },
              { name: 'Active membership', count: data?.activeMembershipCount ?? 0, fill: '#22c55e' },
              { name: 'Expired membership', count: data?.expiredMembershipCount ?? 0, fill: '#f59e0b' },
              { name: 'Used membership', count: data?.usedMembershipCount ?? 0, fill: '#6366f1' },
              { name: 'Memberships sold (period)', count: data?.membershipSalesCount ?? 0, fill: '#0ea5e9' },
              { name: 'Services completed (period)', count: data?.servicesCompleted ?? 0, fill: '#8b5cf6' },
              { name: 'Usage in branch (period)', count: data?.membershipUsageInBranch ?? 0, fill: '#ec4899' },
            ]}
            layout="vertical"
            margin={{ top: 8, right: 24, left: 140, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--theme-border)" />
            <XAxis type="number" tick={{ fill: 'var(--theme-text)', fontSize: 12 }} />
            <YAxis type="category" dataKey="name" tick={{ fill: 'var(--theme-text)', fontSize: 11 }} width={135} />
            <Tooltip
              contentStyle={{ background: 'var(--theme-bg-card)', border: '1px solid var(--theme-border)', borderRadius: 8 }}
              formatter={(value: number | undefined) => [value ?? 0, 'Count']}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <Cell key={i} fill={['#3b82f6', '#22c55e', '#f59e0b', '#6366f1', '#0ea5e9', '#8b5cf6', '#ec4899'][i]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}
