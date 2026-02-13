import { useEffect, useState } from 'react';
import { getSettlements } from '../api/reports';
import type { Settlement } from '../types/crm';

export default function SettlementsPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [summary, setSummary] = useState<{ from: string; to: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getSettlements().then((r) => {
      setLoading(false);
      if (r.success) {
        setSettlements(r.settlements || []);
        setSummary(r.summary || []);
      } else setError(r.message || 'Failed to load');
    });
  }, []);

  return (
    <div className="dashboard-content">
      <section className="content-card">
        <h2>Cross-sales & internal settlement</h2>
        <p>Which branch owes another branch for memberships and referrals. No guessing, no disputes.</p>
        {error && <div className="auth-error vendors-error">{error}</div>}
        {loading ? (
          <div className="vendors-loading"><div className="spinner" /><span>Loading...</span></div>
        ) : (
          <>
            {summary.length > 0 && (
              <div className="report-section" style={{ marginTop: '1rem' }}>
                <h3>Summary (who owes whom)</h3>
                <ul className="report-list">
                  {summary.map((s, i) => (
                    <li key={i}><strong>{s.from}</strong> owes <strong>{s.to}</strong>: {s.amount}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="report-section" style={{ marginTop: '1rem' }}>
              <h3>Settlement entries</h3>
              {settlements.length === 0 ? <p className="text-muted">No settlement entries yet. They are created when a membership is used at a different branch than where it was sold.</p> : (
                <div className="vendors-table-wrap">
                  <table className="vendors-table">
                    <thead>
                      <tr><th>From branch</th><th>To branch</th><th>Amount</th><th>Reason</th><th>Status</th><th>Date</th></tr>
                    </thead>
                    <tbody>
                      {settlements.map((s) => (
                        <tr key={s.id}>
                          <td>{s.fromBranch}</td>
                          <td>{s.toBranch}</td>
                          <td>{s.amount}</td>
                          <td>{s.reason || '—'}</td>
                          <td><span className={`status-badge status-${s.status === 'settled' ? 'approved' : 'pending'}`}>{s.status}</span></td>
                          <td>{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
