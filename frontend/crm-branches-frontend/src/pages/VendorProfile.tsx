import { useAuth } from '../auth/hooks/useAuth';

export default function VendorProfile() {
  const { user } = useAuth();

  return (
    <div className="dashboard-content">
      <section className="content-card">
        <h2>Profile</h2>
        <dl className="profile-dl">
          <dt>Name</dt>
          <dd>{user?.name}</dd>
          <dt>Email</dt>
          <dd>{user?.email}</dd>
          <dt>Vendor name</dt>
          <dd>{user?.vendorName || '—'}</dd>
          <dt>Role</dt>
          <dd>{user?.role}</dd>
        </dl>
        <p className="text-muted">Edit profile (coming soon)</p>
      </section>
    </div>
  );
}
