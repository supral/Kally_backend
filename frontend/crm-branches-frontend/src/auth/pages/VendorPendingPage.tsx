import { useAuth } from '../hooks/useAuth';

export default function VendorPendingPage() {
  const { user, logout } = useAuth();

  return (
    <div className="dashboard-content">
      <section className="content-card vendor-pending-card">
        <div className="vendor-pending-icon">Pending</div>
        <h2>Pending approval</h2>
        <p>
          Hello, <strong>{user?.name}</strong>. Your vendor account is waiting for admin approval.
        </p>
        <p className="vendor-pending-note">
          You will be able to access the dashboard once an administrator approves your registration.
        </p>
        <button type="button" className="btn-logout vendor-pending-logout" onClick={logout}>
          Sign out
        </button>
      </section>
    </div>
  );
}
