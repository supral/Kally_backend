import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  getLoyalty,
  earnLoyaltyPoints,
  redeemLoyaltyPoints,
} from '../../../api/loyalty.api';
import { useAuth } from '../../../auth/hooks/useAuth';
import { ROUTES } from '../../../config/constants';

export default function LoyaltyDetailPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const initialName = (location.state as { customerName?: string } | null)?.customerName;

  const [customerName, _setCustomerName] = useState(initialName ?? '');
  const [points, setPoints] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<
    { id: string; points: number; type: string; reason?: string; createdAt: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [earnPoints, setEarnPoints] = useState('');
  const [earnReason, setEarnReason] = useState('');
  const [redeemPoints, setRedeemPoints] = useState('');
  const [redeemReason, setRedeemReason] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setActionMessage('');
    getLoyalty(id)
      .then((r) => {
        setLoading(false);
        if (r.success) {
          setPoints(r.points ?? 0);
          setTransactions(r.transactions ?? []);
        } else {
          setPoints(0);
          setTransactions([]);
        }
      })
      .catch(() => setLoading(false));
  }, [id]);

  const basePath = user?.role === 'admin' ? ROUTES.admin.loyalty : ROUTES.vendor.loyalty;

  const handleEarn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !earnPoints) return;
    const p = parseInt(earnPoints, 10);
    if (Number.isNaN(p) || p <= 0) return;
    const r = await earnLoyaltyPoints(id, p, earnReason || undefined);
    setActionMessage(r.success ? `Added ${p} points. New balance: ${r.points}` : r.message || 'Failed');
    if (r.success) {
      setPoints(r.points ?? 0);
      setEarnPoints('');
      setEarnReason('');
      getLoyalty(id).then((res) => res.success && setTransactions(res.transactions ?? []));
    }
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !redeemPoints) return;
    const p = parseInt(redeemPoints, 10);
    if (Number.isNaN(p) || p <= 0) return;
    const r = await redeemLoyaltyPoints(id, p, redeemReason || undefined);
    setActionMessage(r.success ? `Redeemed ${p} points. New balance: ${r.points}` : r.message || 'Failed');
    if (r.success) {
      setPoints(r.points ?? 0);
      setRedeemPoints('');
      setRedeemReason('');
      getLoyalty(id).then((res) => res.success && setTransactions(res.transactions ?? []));
    }
  };

  return (
    <div className="dashboard-content loyalty-page">
      <section className="content-card loyalty-detail-card">
        <div className="loyalty-detail-header">
          <h2 className="loyalty-detail-title">
            {customerName || 'Customer'} — Points
          </h2>
          <button
            type="button"
            className="loyalty-close-btn"
            onClick={() => navigate(basePath)}
            aria-label="Back to loyalty list"
          >
            ×
          </button>
        </div>
        {loading ? (
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
              <div
                className={`loyalty-action-msg ${
                  actionMessage.includes('Failed') ? 'error' : 'success'
                }`}
                role="alert"
              >
                {actionMessage}
              </div>
            )}
            <div className="loyalty-actions-grid">
              <form onSubmit={handleEarn} className="loyalty-form-card earn">
                <h4 className="loyalty-form-title">Earn points</h4>
                <label>
                  <span>Points</span>
                  <input
                    type="number"
                    min={1}
                    value={earnPoints}
                    onChange={(e) => setEarnPoints(e.target.value)}
                    placeholder="e.g. 10"
                  />
                </label>
                <label>
                  <span>Reason (optional)</span>
                  <input
                    type="text"
                    value={earnReason}
                    onChange={(e) => setEarnReason(e.target.value)}
                    placeholder="Visit / spend"
                  />
                </label>
                <button type="submit" className="auth-submit loyalty-submit">
                  Add points
                </button>
              </form>
              <form onSubmit={handleRedeem} className="loyalty-form-card redeem">
                <h4 className="loyalty-form-title">Redeem points</h4>
                <label>
                  <span>Points</span>
                  <input
                    type="number"
                    min={1}
                    value={redeemPoints}
                    onChange={(e) => setRedeemPoints(e.target.value)}
                    placeholder="e.g. 50"
                  />
                </label>
                <label>
                  <span>Reason (optional)</span>
                  <input
                    type="text"
                    value={redeemReason}
                    onChange={(e) => setRedeemReason(e.target.value)}
                    placeholder="Reward"
                  />
                </label>
                <button type="submit" className="auth-submit loyalty-submit">
                  Redeem
                </button>
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
                        <td>
                          <span className={`loyalty-tx-type ${t.type}`}>{t.type}</span>
                        </td>
                        <td className="num">
                          {t.type === 'earn' ? '+' : ''}
                          {t.points}
                        </td>
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
    </div>
  );
}

