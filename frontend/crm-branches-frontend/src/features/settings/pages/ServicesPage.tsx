import { Link } from 'react-router-dom';

export default function ServicesPage() {
  return (
    <div className="dashboard-content">
      <section className="content-card">
        <h2>Services</h2>
        <p>Add and manage services in <Link to="/admin/settings">Settings</Link>. Those services are used when booking appointments and when adding or filtering leads.</p>
      </section>
    </div>
  );
}
