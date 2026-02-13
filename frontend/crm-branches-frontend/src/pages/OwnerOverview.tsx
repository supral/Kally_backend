import { useEffect, useState } from 'react';
import { getOwnerOverview } from '../api/reports';
import type { OwnerOverviewBranch } from '../types/crm';

export default function OwnerOverview() {
  const [overview, setOverview] = useState<OwnerOverviewBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getOwnerOverview().then((r) => {
      setLoading(false);
      if (r.success && r.overview) setOverview(r.overview);
      else setError(r.message || 'Failed to load overview');
    });
  }, []);

  if (loading) {
    return (
      <div className="dashboard-content">
        <div className="vendors-loading">
          <div className="spinner" />
          <span>Loading overview...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-content">
        <div className="auth-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="dashboard-content">
      <section className="welcome-card">
        <h2>Owner overview</h2>
        <p>Full visibility across all branches: performance, memberships, leads, and growth.</p>
      </section>
      <div className="overview-grid">
        {overview.map((b) => (
          <div key={b.branchId} className="content-card overview-branch-card">
            <h3>{b.branchName}</h3>
            <dl className="overview-dl">
              <dt>Memberships sold</dt>
              <dd>{b.membershipsSold}</dd>
              <dt>Leads</dt>
              <dd>{b.leads}</dd>
              <dt>Leads booked</dt>
              <dd>{b.leadsBooked}</dd>
              <dt>Appointments this month</dt>
              <dd>{b.appointmentsThisMonth}</dd>
              <dt>Completed</dt>
              <dd>{b.appointmentsCompleted}</dd>
            </dl>
          </div>
        ))}
      </div>
      {overview.length === 0 && (
        <section className="content-card">
          <p>No branches yet. Create branches and assign vendors to see data here.</p>
        </section>
      )}
    </div>
  );
}
