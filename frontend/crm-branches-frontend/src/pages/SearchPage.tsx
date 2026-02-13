import { useState } from 'react';
import { searchCustomersAndMemberships } from '../api/search';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/hooks/useAuth';

export default function SearchPage() {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [customers, setCustomers] = useState<{ id: string; name: string; phone: string; email?: string; membershipCardId?: string }[]>([]);
  const [memberships, setMemberships] = useState<{ id: string; customerId: string; typeName?: string; totalCredits: number; usedCredits: number; remainingCredits?: number; soldAtBranch?: string; expiryDate?: string; status: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    const r = await searchCustomersAndMemberships(q.trim());
    setLoading(false);
    if (r.success) {
      setCustomers(r.customers || []);
      setMemberships(r.memberships || []);
    } else {
      setCustomers([]);
      setMemberships([]);
    }
  }

  const basePath = user?.role === 'admin' ? '/admin' : '/vendor';

  return (
    <div className="dashboard-content">
      <section className="content-card">
        <h2>Search customers & memberships</h2>
        <p>Search by phone number, name, or membership card.</p>
        <form onSubmit={handleSearch} className="auth-form" style={{ maxWidth: '400px', marginTop: '1rem' }}>
          <label>
            <span>Search</span>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Phone, name, or card ID"
              autoFocus
            />
          </label>
          <button type="submit" className="auth-submit" disabled={loading}>{loading ? 'Searching...' : 'Search'}</button>
        </form>
        {searched && !loading && (
          <>
            <h3 style={{ marginTop: '1.5rem' }}>Customers ({customers.length})</h3>
            {customers.length === 0 ? <p className="text-muted">No customers found.</p> : (
              <ul className="report-list">
                {customers.map((c) => (
                  <li key={c.id}>
                    <Link to={`${basePath}/customers`}>{c.name}</Link> — {c.phone}
                    {c.membershipCardId && ` (Card: ${c.membershipCardId})`}
                  </li>
                ))}
              </ul>
            )}
            <h3 style={{ marginTop: '1rem' }}>Memberships ({memberships.length})</h3>
            {memberships.length === 0 ? <p className="text-muted">No active memberships found.</p> : (
              <ul className="report-list">
                {memberships.map((m) => (
                  <li key={m.id}>
                    <Link to={`${basePath}/memberships/${m.id}`}>{m.typeName || 'Membership'}</Link>
                    {' '}— {m.remainingCredits ?? (m.totalCredits - m.usedCredits)} remaining
                    {m.soldAtBranch && ` (Sold at ${m.soldAtBranch})`}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}
