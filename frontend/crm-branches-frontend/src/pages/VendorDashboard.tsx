import { useAuth } from '../auth/hooks/useAuth';

export default function VendorDashboard() {
  const { user } = useAuth();

  return (
    <div className="dashboard-content">
      <section className="welcome-card">
        <h2>Welcome, {user?.vendorName || user?.name}</h2>
        <p>Manage your branches and profile from here.</p>
      </section>
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">—</span>
          <span className="stat-label">My Branches</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">—</span>
          <span className="stat-label">Active</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">—</span>
          <span className="stat-label">Pending</span>
        </div>
      </div>
      <section className="content-card">
        <h3>Quick actions</h3>
        <ul className="quick-actions">
          <li>View and manage your branches</li>
          <li>Update profile and vendor details</li>
          <li>Reports (coming soon)</li>
        </ul>
      </section>
    </div>
  );
}
