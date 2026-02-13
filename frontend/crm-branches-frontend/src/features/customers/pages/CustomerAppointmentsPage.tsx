import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/hooks/useAuth';
import { getCustomer } from '../../../api/customers';
import { getAppointments } from '../../../api/appointments';
import type { Customer } from '../../../types/common';
import type { Appointment } from '../../../types/common';

export default function CustomerAppointmentsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const basePath = user?.role === 'admin' ? '/admin' : '/vendor';

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    Promise.all([
      getCustomer(id).then((r) => {
        if (r.success && 'customer' in r) setCustomer((r as unknown as { customer: Customer }).customer);
      }),
      getAppointments({ customerId: id }).then((r) => {
        if (r.success && r.appointments != null) setAppointments(r.appointments);
        else setError((r as { message?: string }).message || 'Failed to load appointments.');
      }),
    ]).finally(() => setLoading(false));
  }, [id]);

  if (!id) {
    return (
      <div className="dashboard-content">
        <div className="auth-error">Invalid customer.</div>
        <button type="button" className="auth-submit" style={{ marginTop: '1rem' }} onClick={() => navigate(`${basePath}/customers`)}>Back to customers</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="dashboard-content">
        <div className="vendors-loading"><div className="spinner" /><span>Loading...</span></div>
      </div>
    );
  }

  const sorted = [...appointments].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );

  return (
    <div className="dashboard-content">
      <section className="content-card">
        <button type="button" className="vendor-name-btn" style={{ marginBottom: '0.5rem' }} onClick={() => navigate(`${basePath}/customers/${id}`)}>← Back to customer</button>
        <h2>Appointments{customer ? `: ${customer.name}` : ''}</h2>
        <p className="text-muted">All appointments for this customer.</p>
        {error && <div className="auth-error vendors-error">{error}</div>}
        {sorted.length === 0 && !error ? (
          <p className="text-muted">No appointments found for this customer.</p>
        ) : (
          <div className="table-responsive" style={{ marginTop: '1rem' }}>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Branch</th>
                  <th>Service</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((a) => (
                  <tr key={a.id}>
                    <td>{a.scheduledAt ? new Date(a.scheduledAt).toLocaleDateString() : '—'}</td>
                    <td>{a.scheduledAt ? new Date(a.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td>{a.branch || '—'}</td>
                    <td>{a.service || '—'}</td>
                    <td>
                      <span className={`status-badge status-${a.status === 'completed' ? 'approved' : a.status === 'rejected' || a.status === 'no-show' || a.status === 'cancelled' ? 'rejected' : 'pending'}`}>
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
