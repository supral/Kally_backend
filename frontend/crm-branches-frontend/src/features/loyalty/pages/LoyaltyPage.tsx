import { useEffect, useState, useCallback } from 'react';
import { useDebounce } from '../../../hooks/useDebounce';
import { searchCustomersAndMemberships } from '../../../api/search';
import {
  getLoyalty,
  earnLoyaltyPoints,
  redeemLoyaltyPoints,
  getLoyaltyInsights,
  type RepeatedCustomer,
  type MembershipUpgrader,
} from '../../../api/loyalty.api';

function formatDate(s: string) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

type TabId = 'members' | 'visits';

export default function LoyaltyPage() {
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<{ id: string; name: string; phone?: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState('');
  const [points, setPoints] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<{ id: string; points: number; type: string; reason?: string; branchName?: string; createdAt: string }[]>([]);
  const [loadingLoyalty, setLoadingLoyalty] = useState(false);
  const [earnPoints, setEarnPoints] = useState('');
  const [earnReason, setEarnReason] = useState('');
  const [redeemPoints, setRedeemPoints] = useState('');
  const [redeemReason, setRedeemReason] = useState('');
  const [actionMessage, setActionMessage] = useState('');
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

  const loadLoyalty = (customerId: string, customerName?: string) => {
    setSelectedCustomerId(customerId);
    const name = customerName ?? customers.find((x) => x.id === customerId)?.name ?? '';
    setSelectedCustomerName(name);
    setActionMessage('');
    setLoadingLoyalty(true);
    getLoyalty(customerId)
      .then((r) => {
        setLoadingLoyalty(false);
        if (r.success) {
          setPoints(r.points ?? 0);
          setTransactions(r.transactions ?? []);
        } else {
          setPoints(0);
          setTransactions([]);
        }
      })
      .catch(() => setLoadingLoyalty(false));
  };

  const closeDetail = () => {
    setSelectedCustomerId(null);
    setSelectedCustomerName('');
    setActionMessage('');
  };

  const handleEarn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !earnPoints) return;
    const p = parseInt(earnPoints, 10);
    if (isNaN(p) || p <= 0) return;
    const r = await earnLoyaltyPoints(selectedCustomerId, p, earnReason || undefined);
    setActionMessage(r.success ? `Added ${p} points. New balance: ${r.points}` : r.message || 'Failed');
    if (r.success) {
      setPoints(r.points ?? 0);
      setEarnPoints('');
      setEarnReason('');
      getLoyalty(selectedCustomerId).then((res) => res.success && setTransactions(res.transactions ?? []));
    }
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !redeemPoints) return;
    const p = parseInt(redeemPoints, 10);
    if (isNaN(p) || p <= 0) return;
    const r = await redeemLoyaltyPoints(selectedCustomerId, p, redeemReason || undefined);
    setActionMessage(r.success ? `Redeemed ${p} points. New balance: ${r.points}` : r.message || 'Failed');
    if (r.success) {
      setPoints(r.points ?? 0);
      setRedeemPoints('');
      setRedeemReason('');
      getLoyalty(selectedCustomerId).then((res) => res.success && setTransactions(res.transactions ?? []));
    }
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
                            className={selectedCustomerId === row.customerId ? 'selected' : ''}
                            onClick={() => loadLoyalty(row.customerId, row.customerName)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && loadLoyalty(row.customerId, row.customerName)}
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
                            className={selectedCustomerId === row.customerId ? 'selected' : ''}
                            onClick={() => loadLoyalty(row.customerId, row.customerName)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && loadLoyalty(row.customerId, row.customerName)}
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

          <section className="content-card loyalty-search-card">
            <h3 className="loyalty-search-title">Search customer</h3>
            <p className="loyalty-card-desc">Find any customer by name, phone, or membership card to manage their points.</p>
            <div className="loyalty-search-row">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                placeholder="Name, phone, or membership card..."
                className="loyalty-search-input"
                aria-label="Search customer"
              />
              <button type="button" className="loyalty-search-btn" onClick={runSearch} disabled={searching}>
                {searching ? <><span className="loyalty-spinner small" /> Searching...</> : 'Search'}
              </button>
            </div>
            {customers.length > 0 && (
              <ul className="loyalty-customer-list">
                {customers.map((c) => (
                  <li key={c.id}>
                    <button type="button" className="loyalty-customer-btn" onClick={() => loadLoyalty(c.id, c.name)}>
                      <span className="loyalty-customer-name">{c.name}</span>
                      {c.phone && <span className="loyalty-customer-phone">{c.phone}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className={`loyalty-detail-column ${selectedCustomerId ? 'open' : ''}`}>
          {selectedCustomerId ? (
            <section className="content-card loyalty-detail-card">
              <div className="loyalty-detail-header">
                <h2 className="loyalty-detail-title">{selectedCustomerName || 'Customer'} — Points</h2>
                <button type="button" className="loyalty-close-btn" onClick={closeDetail} aria-label="Close">×</button>
              </div>
              {loadingLoyalty ? (
                <div className="loyalty-loading-state">
                  <span className="loyalty-spinner" />
                  <span>Loading...</span>
                </div>
              ) : (
                <>
                  <div className="loyalty-balance-card">
                    <span className="loyalty-balance-label">Balance</span>
                    <span className="loyalty-balance-value">{points ?? 0} pts</span>
                  </div>
                  {actionMessage && (
                    <div className={`loyalty-action-msg ${actionMessage.includes('Failed') ? 'error' : 'success'}`} role="alert">
                      {actionMessage}
                    </div>
                  )}
                  <div className="loyalty-actions-grid">
                    <form onSubmit={handleEarn} className="loyalty-form-card earn">
                      <h4 className="loyalty-form-title">Earn points</h4>
                      <label><span>Points</span><input type="number" min={1} value={earnPoints} onChange={(e) => setEarnPoints(e.target.value)} placeholder="e.g. 10" /></label>
                      <label><span>Reason (optional)</span><input type="text" value={earnReason} onChange={(e) => setEarnReason(e.target.value)} placeholder="Visit / spend" /></label>
                      <button type="submit" className="auth-submit loyalty-submit">Add points</button>
                    </form>
                    <form onSubmit={handleRedeem} className="loyalty-form-card redeem">
                      <h4 className="loyalty-form-title">Redeem points</h4>
                      <label><span>Points</span><input type="number" min={1} value={redeemPoints} onChange={(e) => setRedeemPoints(e.target.value)} placeholder="e.g. 50" /></label>
                      <label><span>Reason (optional)</span><input type="text" value={redeemReason} onChange={(e) => setRedeemReason(e.target.value)} placeholder="Reward" /></label>
                      <button type="submit" className="auth-submit loyalty-submit">Redeem</button>
                    </form>
                  </div>
                  <h4 className="loyalty-transactions-heading">Recent transactions</h4>
                  {transactions.length === 0 ? (
                    <p className="text-muted loyalty-no-tx">No transactions yet.</p>
                  ) : (
                    <div className="data-table-wrap">
                      <table className="data-table loyalty-tx-table">
                        <thead>
                          <tr>
                            <th>Date & time</th>
                            <th>Type</th>
                            <th className="num">Points</th>
                            <th>Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transactions.slice(0, 20).map((t) => (
                            <tr key={t.id}>
                              <td>{new Date(t.createdAt).toLocaleString()}</td>
                              <td><span className={`loyalty-tx-type ${t.type}`}>{t.type}</span></td>
                              <td className="num">{t.type === 'earn' ? '+' : ''}{t.points}</td>
                              <td>{t.reason || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </section>
          ) : (
            <div className="loyalty-detail-placeholder">
              <span className="loyalty-placeholder-icon" aria-hidden>👤</span>
              <p>Select a customer from the list or search to manage points.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
