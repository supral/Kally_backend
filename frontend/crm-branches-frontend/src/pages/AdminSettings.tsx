import { useEffect, useState } from 'react';
import { getSettings, updateSettings } from '../api/settings';
import { getServices, createService, updateService, deleteService } from '../api/services';
import { getBranches } from '../api/branches';
import type { Service } from '../types/crm';

export default function AdminSettings() {
  const [message, setMessage] = useState('');
  const [settlementPercentage, setSettlementPercentage] = useState('');
  const [membershipRenewalCost, setMembershipRenewalCost] = useState('');
  const [settlementSaving, setSettlementSaving] = useState(false);
  const [renewalSaving, setRenewalSaving] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);

  const [services, setServices] = useState<Service[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [serviceName, setServiceName] = useState('');
  const [serviceCategory, setServiceCategory] = useState('');
  const [serviceBranchId, setServiceBranchId] = useState('');
  const [serviceDuration, setServiceDuration] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  const [serviceSaving, setServiceSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editBranchId, setEditBranchId] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [editPrice, setEditPrice] = useState('');

  useEffect(() => {
    getSettings().then((r) => {
      setSettingsLoading(false);
      if (r.success && r.settings != null) {
        setSettlementPercentage(String(r.settings.settlementPercentage ?? 100));
        setMembershipRenewalCost(String(r.settings.membershipRenewalCost ?? 0));
      }
    });
  }, []);

  const loadServices = () => {
    setServicesLoading(true);
    getServices().then((r) => {
      setServicesLoading(false);
      if (r.success && r.services) setServices(r.services);
    });
    getBranches().then((r) => { if (r.success && r.branches) setBranches(r.branches); });
  };

  useEffect(() => { loadServices(); }, []);

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceName.trim()) {
      setMessage('Service name is required.');
      return;
    }
    setServiceSaving(true);
    setMessage('');
    const r = await createService({
      name: serviceName.trim(),
      category: serviceCategory.trim() || undefined,
      branchId: serviceBranchId || undefined,
      durationMinutes: serviceDuration ? parseInt(serviceDuration, 10) : undefined,
      price: servicePrice ? parseFloat(servicePrice) : undefined,
    });
    setServiceSaving(false);
    if (r.success) {
      setServiceName('');
      setServiceCategory('');
      setServiceBranchId('');
      setServiceDuration('');
      setServicePrice('');
      loadServices();
      setMessage('Service added.');
    } else setMessage(r.message || 'Failed to add service.');
  };

  const startEdit = (s: Service) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditCategory(s.category || '');
    setEditBranchId(s.branchId || '');
    setEditDuration(s.durationMinutes != null ? String(s.durationMinutes) : '');
    setEditPrice(s.price != null ? String(s.price) : '');
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleUpdateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !editName.trim()) return;
    setServiceSaving(true);
    setMessage('');
    const r = await updateService(editingId, {
      name: editName.trim(),
      category: editCategory.trim() || undefined,
      branchId: editBranchId || undefined,
      durationMinutes: editDuration ? parseInt(editDuration, 10) : undefined,
      price: editPrice ? parseFloat(editPrice) : undefined,
    });
    setServiceSaving(false);
    if (r.success) {
      setEditingId(null);
      loadServices();
      setMessage('Service updated.');
    } else setMessage(r.message || 'Failed to update service.');
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm('Remove this service? It will no longer appear in appointments or leads.')) return;
    setServiceSaving(true);
    setMessage('');
    const r = await deleteService(id);
    setServiceSaving(false);
    if (r.success) {
      loadServices();
      setMessage('Service removed.');
    } else setMessage(r.message || 'Failed to remove service.');
  };

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

      <section className="content-card" style={{ marginTop: '1rem' }}>
        <h3>Services</h3>
        <p className="text-muted">
          Add services that can be selected when booking appointments or converting leads. Leave branch blank for services available at all branches.
        </p>
        {message && <p className="text-muted" style={{ marginTop: '0.5rem' }}>{message}</p>}
        <form onSubmit={handleAddService} className="auth-form" style={{ maxWidth: '480px', marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
          <label style={{ flex: '1 1 140px' }}>
            <span>Name *</span>
            <input
              type="text"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="e.g. Eyebrow threading"
            />
          </label>
          <label style={{ flex: '1 1 100px' }}>
            <span>Category</span>
            <input
              type="text"
              value={serviceCategory}
              onChange={(e) => setServiceCategory(e.target.value)}
              placeholder="Optional"
            />
          </label>
          <label style={{ flex: '1 1 140px' }}>
            <span>Branch</span>
            <select value={serviceBranchId} onChange={(e) => setServiceBranchId(e.target.value)}>
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>
          <label style={{ flex: '0 1 80px' }}>
            <span>Duration (min)</span>
            <input
              type="number"
              min={1}
              value={serviceDuration}
              onChange={(e) => setServiceDuration(e.target.value)}
              placeholder="—"
            />
          </label>
          <label style={{ flex: '0 1 80px' }}>
            <span>Price ($)</span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={servicePrice}
              onChange={(e) => setServicePrice(e.target.value)}
              placeholder="—"
            />
          </label>
          <button type="submit" className="auth-submit" disabled={serviceSaving}>
            {serviceSaving ? 'Adding…' : 'Add service'}
          </button>
        </form>
        {servicesLoading ? (
          <p className="text-muted" style={{ marginTop: '1rem' }}>Loading services…</p>
        ) : services.length === 0 ? (
          <p className="text-muted" style={{ marginTop: '1rem' }}>No services yet. Add one above.</p>
        ) : (
          <div className="data-table-wrap" style={{ marginTop: '1rem' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Branch</th>
                  <th>Duration</th>
                  <th>Price</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id}>
                    {editingId === s.id ? (
                      <>
                        <td colSpan={6}>
                          <form onSubmit={handleUpdateService} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" required style={{ width: '120px' }} />
                            <input type="text" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} placeholder="Category" style={{ width: '100px' }} />
                            <select value={editBranchId} onChange={(e) => setEditBranchId(e.target.value)} style={{ width: '120px' }}>
                              <option value="">All branches</option>
                              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                            <input type="number" min={1} value={editDuration} onChange={(e) => setEditDuration(e.target.value)} placeholder="Min" style={{ width: '60px' }} />
                            <input type="number" min={0} step={0.01} value={editPrice} onChange={(e) => setEditPrice(e.target.value)} placeholder="Price" style={{ width: '70px' }} />
                            <button type="submit" className="filter-btn" disabled={serviceSaving}>Save</button>
                            <button type="button" className="filter-btn" onClick={cancelEdit}>Cancel</button>
                          </form>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{s.name}</td>
                        <td>{s.category || '—'}</td>
                        <td>{s.branch || 'All'}</td>
                        <td>{s.durationMinutes != null ? `${s.durationMinutes} min` : '—'}</td>
                        <td>{s.price != null ? `$${s.price}` : '—'}</td>
                        <td>
                          <button type="button" className="filter-btn" style={{ marginRight: '0.5rem' }} onClick={() => startEdit(s)}>Edit</button>
                          <button type="button" className="btn-reject" style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }} onClick={() => handleDeleteService(s.id)}>Remove</button>
                        </td>
                      </>
                    )}
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
