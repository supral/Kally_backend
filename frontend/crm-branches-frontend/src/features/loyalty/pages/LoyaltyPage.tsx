import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from '../../../hooks/useDebounce';
import { searchCustomersAndMemberships } from '../../../api/search';
import {
  getLoyaltyInsights,
  type RepeatedCustomer,
  type MembershipUpgrader,
} from '../../../api/loyalty.api';
import { useAuth } from '../../../auth/hooks/useAuth';
import { ROUTES } from '../../../config/constants';

function formatDate(s: string) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

type TabId = 'members' | 'visits';

export default function LoyaltyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<{ id: string; name: string; phone?: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('members');

  const [repeatedCustomers, setRepeatedCustomers] = useState<RepeatedCustomer[]>([]);
  const [membershipUpgraders, setMembershipUpgraders] = useState<MembershipUpgrader[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(true);

  const debouncedQuery = useDebounce(query, 300);

  const fetchInsights = useCallback(() => {
    setInsightsLoading(true);
    getLoyaltyInsights()
      .then((r) => {
        setInsightsLoading(false);
        if (r.success) {
          setRepeatedCustomers(r.repeatedCustomers ?? []);
          setMembershipUpgraders(r.membershipUpgraders ?? []);
        }
      })
      .catch(() => setInsightsLoading(false));
  }, []);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const runSearch = () => {
    if (debouncedQuery.trim().length < 2) {
      setCustomers([]);
      return;
    }
    setSearching(true);
    searchCustomersAndMemberships(debouncedQuery.trim())
      .then((r) => {
        setSearching(false);
        if (r.success && r.customers) setCustomers(r.customers);
        else setCustomers([]);
      })
      .catch(() => setSearching(false));
  };

  const navigateToDetail = (customerId: string, customerName?: string) => {
    const base =
      user?.role === 'admin'
        ? ROUTES.admin.loyaltyDetail(customerId)
        : ROUTES.vendor.loyaltyDetail(customerId);
    navigate(base, { state: { customerName } });
  };

  return (
    <div className="dashboard-content loyalty-page">
      <header className="loyalty-hero">
        <div className="loyalty-hero-text">
          <h1 className="loyalty-hero-title">Loyalty program</h1>
          <p className="loyalty-hero-subtitle">Reward repeat customers. View members with 2+ memberships or visits, then manage points.</p>
        </div>
        <div className="loyalty-hero-stats">
          <div className="loyalty-stat-card">
            <span className="loyalty-stat-value">{insightsLoading ? '—' : membershipUpgraders.length}</span>
            <span className="loyalty-stat-label">Loyalty members (2+ memberships)</span>
          </div>
          <div className="loyalty-stat-card">
            <span className="loyalty-stat-value">{insightsLoading ? '—' : repeatedCustomers.length}</span>
            <span className="loyalty-stat-label">Repeated visitors (2+ visits)</span>
          </div>
          <button type="button" className="loyalty-refresh-btn" onClick={fetchInsights} disabled={insightsLoading} aria-label="Refresh data">
            {insightsLoading ? <span className="loyalty-spinner" /> : '↻'} Refresh
          </button>
        </div>
      </header>

      <section className="content-card loyalty-search-card" style={{ marginBottom: '1rem' }}>
        <h3 className="loyalty-search-title">Search customer</h3>
        <p className="loyalty-card-desc">
          Find any customer by name or phone to manage their loyalty points.
        </p>
        <div className="loyalty-search-row">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            placeholder="Name or phone..."
            className="loyalty-search-input"
            aria-label="Search customer"
          />
          <button
            type="button"
            className="loyalty-search-btn"
            onClick={runSearch}
            disabled={searching}
          >
            {searching ? (
              <>
                <span className="loyalty-spinner small" /> Searching...
              </>
            ) : (
              'Search'
            )}
          </button>
        </div>
        {customers.length > 0 && (
          <ul className="loyalty-customer-list" style={{ marginTop: '0.75rem' }}>
            {customers.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="loyalty-customer-btn"
                  onClick={() => navigateToDetail(c.id, c.name)}
                >
                  <span className="loyalty-customer-name">{c.name}</span>
                  {c.phone && <span className="loyalty-customer-phone">{c.phone}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="loyalty-main-grid">
        <div className="loyalty-tables-column">
          <section className="content-card loyalty-section-card">
            <div className="loyalty-tabs">
              <button
                type="button"
                className={`loyalty-tab ${activeTab === 'members' ? 'active' : ''}`}
                onClick={() => setActiveTab('members')}
              >
                Loyalty members (2+)
              </button>
              <button
                type="button"
                className={`loyalty-tab ${activeTab === 'visits' ? 'active' : ''}`}
                onClick={() => setActiveTab('visits')}
              >
                Repeated visits
              </button>
            </div>

            {activeTab === 'members' && (
              <>
                <p className="loyalty-card-desc">Customers registered as members 2 or more times. Click a row to manage points.</p>
                {insightsLoading ? (
                  <div className="loyalty-loading-state">
                    <span className="loyalty-spinner" />
                    <span>Loading loyalty members...</span>
                  </div>
                ) : membershipUpgraders.length === 0 ? (
                  <div className="loyalty-empty-state">
                    <span className="loyalty-empty-icon" aria-hidden>⭐</span>
                    <p>No customers with 2+ memberships yet.</p>
                    <p className="text-muted">They will appear here once customers purchase multiple memberships.</p>
                  </div>
                ) : (
                  <div className="data-table-wrap loyalty-table-wrap">
                    <table className="data-table loyalty-interactive-table">
                      <thead>
                        <tr>
                          <th>Customer name</th>
                          <th>Phone</th>
                          <th className="num">Memberships</th>
                          <th>Last purchase</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {membershipUpgraders.map((row) => (
                          <tr
                            key={row.customerId}
                            onClick={() => navigateToDetail(row.customerId, row.customerName)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && navigateToDetail(row.customerId, row.customerName)}
                          >
                            <td><strong>{row.customerName}</strong></td>
                            <td>{row.phone}</td>
                            <td className="num">{row.membershipCount}</td>
                            <td>{formatDate(row.lastPurchaseAt)}</td>
                            <td><span className="loyalty-row-action">Manage points →</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {activeTab === 'visits' && (
              <>
                <p className="loyalty-card-desc">Customers with 2+ completed appointments. Click a row to manage points.</p>
                {insightsLoading ? (
                  <div className="loyalty-loading-state">
                    <span className="loyalty-spinner" />
                    <span>Loading...</span>
                  </div>
                ) : repeatedCustomers.length === 0 ? (
                  <div className="loyalty-empty-state">
                    <span className="loyalty-empty-icon" aria-hidden>📅</span>
                    <p>No repeated visitors yet.</p>
                    <p className="text-muted">They will appear after 2+ completed appointments.</p>
                  </div>
                ) : (
                  <div className="data-table-wrap loyalty-table-wrap">
                    <table className="data-table loyalty-interactive-table">
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th>Phone</th>
                          <th className="num">Visits</th>
                          <th>Last visit</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {repeatedCustomers.map((row) => (
                          <tr
                            key={row.customerId}
                            onClick={() => navigateToDetail(row.customerId, row.customerName)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && navigateToDetail(row.customerId, row.customerName)}
                          >
                            <td><strong>{row.customerName}</strong></td>
                            <td>{row.phone}</td>
                            <td className="num">{row.visitCount}</td>
                            <td>{formatDate(row.lastVisitAt)}</td>
                            <td><span className="loyalty-row-action">Manage points →</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
