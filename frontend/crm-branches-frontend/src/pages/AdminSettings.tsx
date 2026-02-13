import { useEffect, useState } from 'react';
import { getSettings, updateSettings } from '../api/settings';

export default function AdminSettings() {
  const [message, setMessage] = useState('');
  const [settlementPercentage, setSettlementPercentage] = useState('');
  const [membershipRenewalCost, setMembershipRenewalCost] = useState('');
  const [settlementSaving, setSettlementSaving] = useState(false);
  const [renewalSaving, setRenewalSaving] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);

  useEffect(() => {
    getSettings().then((r) => {
      setSettingsLoading(false);
      if (r.success && r.settings != null) {
        setSettlementPercentage(String(r.settings.settlementPercentage ?? 100));
        setMembershipRenewalCost(String(r.settings.membershipRenewalCost ?? 0));
      }
    });
  }, []);

  const handleSaveSettlementPercentage = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(settlementPercentage);
    if (Number.isNaN(num) || num < 0 || num > 100) {
      setMessage('Settlement percentage must be between 0 and 100.');
      return;
    }
    setSettlementSaving(true);
    setMessage('');
    const r = await updateSettings({ settlementPercentage: num });
    setSettlementSaving(false);
    setMessage(r.success ? 'Settlement percentage saved.' : r.message || 'Failed to save.');
  };

  const handleSaveRenewalCost = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(membershipRenewalCost);
    if (Number.isNaN(num) || num < 0) {
      setMessage('Membership renewal cost must be 0 or greater.');
      return;
    }
    setRenewalSaving(true);
    setMessage('');
    const r = await updateSettings({ membershipRenewalCost: num });
    setRenewalSaving(false);
    setMessage(r.success ? 'Membership renewal cost saved.' : r.message || 'Failed to save.');
  };

  return (
    <div className="dashboard-content">
      <section className="content-card">
        <h2>Settings</h2>
        <p>System and role settings.</p>
        {message && <p className="text-muted" style={{ marginTop: '0.5rem' }}>{message}</p>}
      </section>

      <section className="content-card" style={{ marginTop: '1rem' }}>
        <h3>Settlement percentage</h3>
        <p className="text-muted">
          When a membership is used at a different branch than where it was sold, the using branch owes the selling branch. This percentage (0–100) is applied to the per-credit value to compute the settlement amount. 100% = full value.
        </p>
        {settingsLoading ? (
          <p className="text-muted">Loading...</p>
        ) : (
          <form onSubmit={handleSaveSettlementPercentage} className="auth-form" style={{ maxWidth: '320px', marginTop: '0.5rem' }}>
            <label>
              <span>Settlement percentage (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={settlementPercentage}
                onChange={(e) => setSettlementPercentage(e.target.value)}
                placeholder="100"
              />
            </label>
            <button type="submit" className="auth-submit" disabled={settlementSaving}>
              {settlementSaving ? 'Saving...' : 'Save settlement percentage'}
            </button>
          </form>
        )}
      </section>

      <section className="content-card" style={{ marginTop: '1rem' }}>
        <h3>Membership renewal cost</h3>
        <p className="text-muted">
          When an expired membership is renewed (via the &quot;Renew&quot; button on the membership View/Use page), this amount is set as the new membership&apos;s package price. Set to 0 for free renewal.
        </p>
        {settingsLoading ? (
          <p className="text-muted">Loading...</p>
        ) : (
          <form onSubmit={handleSaveRenewalCost} className="auth-form" style={{ maxWidth: '320px', marginTop: '0.5rem' }}>
            <label>
              <span>Renewal cost ($)</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={membershipRenewalCost}
                onChange={(e) => setMembershipRenewalCost(e.target.value)}
                placeholder="0"
              />
            </label>
            <button type="submit" className="auth-submit" disabled={renewalSaving}>
              {renewalSaving ? 'Saving...' : 'Save renewal cost'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
