import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getSettings, updateSettings } from '../api/settings';
import { getServices, createService, updateService, deleteService } from '../api/services';
import { getBranches } from '../api/branches';
import { updatePassword } from '../api/auth.api';
import type { Service } from '../types/crm';

export default function AdminSettings() {
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | null>(null);
  const [revenuePercentage, setRevenuePercentage] = useState('');
  const [settlementPercentage, setSettlementPercentage] = useState('');
  const [revenueSaving, setRevenueSaving] = useState(false);
  const [settlementSaving, setSettlementSaving] = useState(false);
  const [guidelinesVendorSaving, setGuidelinesVendorSaving] = useState(false);
  const [showGuidelinesInVendorDashboard, setShowGuidelinesInVendorDashboard] = useState<boolean>(true);
  const [notificationsSaving, setNotificationsSaving] = useState(false);
  const [showNotificationBellToVendors, setShowNotificationBellToVendors] = useState<boolean>(true);
  const [showNotificationAppointments, setShowNotificationAppointments] = useState<boolean>(true);
  const [showNotificationSettlements, setShowNotificationSettlements] = useState<boolean>(true);
  const [showNotificationTickets, setShowNotificationTickets] = useState<boolean>(true);
  const [showNotificationComments, setShowNotificationComments] = useState<boolean>(true);
  const [showNotificationSalesData, setShowNotificationSalesData] = useState<boolean>(true);
  const [importButtonSaving, setImportButtonSaving] = useState(false);
  const [showImportButton, setShowImportButton] = useState<boolean>(true);
  const [exportButtonSaving, setExportButtonSaving] = useState(false);
  const [showExportButton, setShowExportButton] = useState<boolean>(true);
  const [customerDeleteSaving, setCustomerDeleteSaving] = useState(false);
  const [showCustomerDeleteToAdmin, setShowCustomerDeleteToAdmin] = useState<boolean>(true);
  const [showCustomerDeleteToVendor, setShowCustomerDeleteToVendor] = useState<boolean>(true);
  const [showCustomerDeleteToStaff, setShowCustomerDeleteToStaff] = useState<boolean>(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [passwordCurrent, setPasswordCurrent] = useState('');
  const [passwordNew, setPasswordNew] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

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
        setRevenuePercentage(String(r.settings.revenuePercentage ?? 10));
        setSettlementPercentage(String(r.settings.settlementPercentage ?? 100));
        setShowGuidelinesInVendorDashboard(r.settings.showGuidelinesInVendorDashboard !== false);
        setShowNotificationBellToVendors(r.settings.showNotificationBellToVendors !== false);
        setShowNotificationAppointments(r.settings.showNotificationAppointments !== false);
        setShowNotificationSettlements(r.settings.showNotificationSettlements !== false);
        setShowNotificationTickets(r.settings.showNotificationTickets !== false);
        setShowNotificationComments(r.settings.showNotificationComments !== false);
        setShowNotificationSalesData(r.settings.showNotificationSalesData !== false);
        setShowImportButton(r.settings.showImportButton !== false);
        setShowExportButton(r.settings.showExportButton !== false);
        setShowCustomerDeleteToAdmin(r.settings.showCustomerDeleteToAdmin !== false);
        setShowCustomerDeleteToVendor(r.settings.showCustomerDeleteToVendor !== false);
        setShowCustomerDeleteToStaff(r.settings.showCustomerDeleteToStaff !== false);
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

  const clearMessage = useCallback(() => {
    setMessage('');
    setMessageType(null);
  }, []);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(clearMessage, 5000);
    return () => clearTimeout(t);
  }, [message, clearMessage]);

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceName.trim()) {
      setMessageType('error');
      setMessage('Service name is required.');
      return;
    }
    const durationNum = serviceDuration.trim() ? parseInt(serviceDuration, 10) : undefined;
    const priceNum = servicePrice.trim() ? parseFloat(servicePrice) : undefined;
    if (serviceDuration.trim() && (Number.isNaN(durationNum) || (durationNum != null && durationNum < 1))) {
      setMessageType('error');
      setMessage('Duration must be at least 1 minute.');
      return;
    }
    if (servicePrice.trim() && (Number.isNaN(priceNum as number) || (priceNum != null && priceNum < 0))) {
      setMessageType('error');
      setMessage('Price must be 0 or greater.');
      return;
    }
    setServiceSaving(true);
    setMessage('');
    setMessageType(null);
    const r = await createService({
      name: serviceName.trim(),
      category: serviceCategory.trim() || undefined,
      branchId: serviceBranchId || undefined,
      durationMinutes: durationNum,
      price: priceNum,
    });
    setServiceSaving(false);
    if (r.success) {
      setServiceName('');
      setServiceCategory('');
      setServiceBranchId('');
      setServiceDuration('');
      setServicePrice('');
      loadServices();
      setMessageType('success');
      setMessage('Service added.');
    } else {
      setMessageType('error');
      setMessage(r.message || 'Failed to add service.');
    }
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
    if (!editingId || !editName.trim()) {
      setMessageType('error');
      setMessage('Name is required.');
      return;
    }
    const durationNum = editDuration.trim() ? parseInt(editDuration, 10) : undefined;
    const priceNum = editPrice.trim() ? parseFloat(editPrice) : undefined;
    if (editDuration.trim() && (Number.isNaN(durationNum) || (durationNum != null && durationNum < 1))) {
      setMessageType('error');
      setMessage('Duration must be at least 1 minute.');
      return;
    }
    if (editPrice.trim() && (Number.isNaN(priceNum as number) || (priceNum != null && priceNum < 0))) {
      setMessageType('error');
      setMessage('Price must be 0 or greater.');
      return;
    }
    setServiceSaving(true);
    setMessage('');
    setMessageType(null);
    const r = await updateService(editingId, {
      name: editName.trim(),
      category: editCategory.trim() || undefined,
      branchId: editBranchId || undefined,
      durationMinutes: durationNum,
      price: priceNum,
    });
    setServiceSaving(false);
    if (r.success) {
      setEditingId(null);
      loadServices();
      setMessageType('success');
      setMessage('Service updated.');
    } else {
      setMessageType('error');
      setMessage(r.message || 'Failed to update service.');
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm('Remove this service? It will no longer appear in appointments or leads.')) return;
    setServiceSaving(true);
    setMessage('');
    setMessageType(null);
    const r = await deleteService(id);
    setServiceSaving(false);
    if (r.success) {
      loadServices();
      setMessageType('success');
      setMessage('Service removed.');
    } else {
      setMessageType('error');
      setMessage(r.message || 'Failed to remove service.');
    }
  };

  const handleSaveRevenuePercentage = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(revenuePercentage);
    if (Number.isNaN(num) || num < 0 || num > 100) {
      setMessageType('error');
      setMessage('Revenue percentage must be between 0 and 100.');
      return;
    }
    setRevenueSaving(true);
    setMessage('');
    setMessageType(null);
    const r = await updateSettings({ revenuePercentage: num });
    setRevenueSaving(false);
    setMessageType(r.success ? 'success' : 'error');
    setMessage(r.success ? 'Revenue percentage saved.' : r.message || 'Failed to save.');
  };

  const handleSaveSettlementPercentage = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(settlementPercentage);
    if (Number.isNaN(num) || num < 0 || num > 100) {
      setMessageType('error');
      setMessage('Settlement percentage must be between 0 and 100.');
      return;
    }
    setSettlementSaving(true);
    setMessage('');
    setMessageType(null);
    const r = await updateSettings({ settlementPercentage: num });
    setSettlementSaving(false);
    setMessageType(r.success ? 'success' : 'error');
    setMessage(r.success ? 'Settlement percentage saved.' : r.message || 'Failed to save.');
  };

  const handleSaveShowGuidelinesInVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuidelinesVendorSaving(true);
    setMessage('');
    setMessageType(null);
    const r = await updateSettings({ showGuidelinesInVendorDashboard });
    setGuidelinesVendorSaving(false);
    setMessageType(r.success ? 'success' : 'error');
    setMessage(r.success ? 'Guidelines visibility saved.' : r.message || 'Failed to save.');
  };

  const handleSaveNotificationSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotificationsSaving(true);
    setMessage('');
    setMessageType(null);
    const r = await updateSettings({
      showNotificationBellToVendors,
      showNotificationAppointments,
      showNotificationSettlements,
      showNotificationTickets,
      showNotificationComments,
      showNotificationSalesData,
    });
    setNotificationsSaving(false);
    setMessageType(r.success ? 'success' : 'error');
    setMessage(r.success ? 'Notification settings saved.' : r.message || 'Failed to save.');
  };

  const handleSaveImportButton = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportButtonSaving(true);
    setMessage('');
    setMessageType(null);
    const r = await updateSettings({ showImportButton });
    setImportButtonSaving(false);
    setMessageType(r.success ? 'success' : 'error');
    setMessage(r.success ? 'Import button visibility saved.' : r.message || 'Failed to save.');
  };

  const handleSaveExportButton = async (e: React.FormEvent) => {
    e.preventDefault();
    setExportButtonSaving(true);
    setMessage('');
    setMessageType(null);
    const r = await updateSettings({ showExportButton });
    setExportButtonSaving(false);
    setMessageType(r.success ? 'success' : 'error');
    setMessage(r.success ? 'Export button visibility saved.' : r.message || 'Failed to save.');
  };

  const handleSaveCustomerDeleteVisibility = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomerDeleteSaving(true);
    setMessage('');
    setMessageType(null);
    const r = await updateSettings({
      showCustomerDeleteToAdmin,
      showCustomerDeleteToVendor,
      showCustomerDeleteToStaff,
    });
    setCustomerDeleteSaving(false);
    setMessageType(r.success ? 'success' : 'error');
    setMessage(r.success ? 'Customer delete button visibility saved.' : r.message || 'Failed to save.');
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setMessageType(null);
    if (!passwordCurrent.trim()) {
      setMessageType('error');
      setMessage('Current password is required.');
      return;
    }
    if (passwordNew.length < 6) {
      setMessageType('error');
      setMessage('New password must be at least 6 characters.');
      return;
    }
    if (passwordNew !== passwordConfirm) {
      setMessageType('error');
      setMessage('New password and confirmation do not match.');
      return;
    }
    setPasswordSaving(true);
    const r = await updatePassword(passwordCurrent, passwordNew);
    setPasswordSaving(false);
    if (r.success) {
      setPasswordCurrent('');
      setPasswordNew('');
      setPasswordConfirm('');
      setMessageType('success');
      setMessage('Password updated successfully.');
    } else {
      setMessageType('error');
      setMessage(r.message || 'Failed to update password.');
    }
  };

  const toastEl = message ? (
    <div
      role="alert"
      aria-live="polite"
      className={`settings-toast settings-toast-${messageType === 'success' ? 'success' : 'error'}`}
    >
      <span className="settings-toast-message">{message}</span>
      <button
        type="button"
        className="settings-toast-close"
        onClick={clearMessage}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  ) : null;

  return (
    <div className="dashboard-content settings-page">
      {toastEl != null && createPortal(toastEl, document.body)}
      <header className="page-hero settings-page-hero">
        <h1 className="page-hero-title">Settings</h1>
        <p className="page-hero-subtitle">
          Manage system configuration, security, vendor experience, and services.
        </p>
      </header>

      <div className="settings-layout">
        {/* Account & Security */}
        <section className="content-card settings-card">
          <h2 className="settings-card-title">Account &amp; security</h2>
          <div className="settings-block">
            <h3 className="settings-block-heading">Update password</h3>
            <p className="settings-block-desc">
              Change your admin account password. Enter your current password and the new password twice.
            </p>
            <form onSubmit={handleUpdatePassword} className="settings-form">
              <label className="settings-label">
                <span>Current password</span>
                <input
                  type="password"
                  value={passwordCurrent}
                  onChange={(e) => setPasswordCurrent(e.target.value)}
                  placeholder="Your current password"
                  autoComplete="current-password"
                  required
                  className="settings-input"
                />
              </label>
              <label className="settings-label">
                <span>New password</span>
                <input
                  type="password"
                  value={passwordNew}
                  onChange={(e) => setPasswordNew(e.target.value)}
                  placeholder="At least 6 characters"
                  minLength={6}
                  autoComplete="new-password"
                  required
                  className="settings-input"
                />
              </label>
              <label className="settings-label">
                <span>Confirm new password</span>
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="Repeat new password"
                  minLength={6}
                  autoComplete="new-password"
                  required
                  className="settings-input"
                />
              </label>
              <button type="submit" className="settings-btn settings-btn-primary" disabled={passwordSaving}>
                {passwordSaving ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </div>
        </section>

        {/* Business rules – one card, two blocks in grid */}
        <section className="content-card settings-card">
          <h2 className="settings-card-title">Business rules</h2>
          <div className="settings-grid-2">
            <div className="settings-block">
              <h3 className="settings-block-heading">Revenue percentage</h3>
              <p className="settings-block-desc">
                Percentage of membership sales counted as revenue for reporting (0–100).
              </p>
              {settingsLoading ? (
                <p className="text-muted">Loading...</p>
              ) : (
                <form onSubmit={handleSaveRevenuePercentage} className="settings-form settings-form-inline">
                  <label className="settings-label">
                    <span>Revenue %</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={revenuePercentage}
                      onChange={(e) => setRevenuePercentage(e.target.value)}
                      placeholder="10"
                      className="settings-input settings-input-narrow"
                    />
                  </label>
                  <button type="submit" className="settings-btn settings-btn-primary" disabled={revenueSaving}>
                    {revenueSaving ? 'Saving…' : 'Save'}
                  </button>
                </form>
              )}
            </div>
            <div className="settings-block">
              <h3 className="settings-block-heading">Settlement percentage</h3>
              <p className="settings-block-desc">
                Share of per-credit value for cross-branch settlements. 100% = full value.
              </p>
              {settingsLoading ? (
                <p className="text-muted">Loading...</p>
              ) : (
                <form onSubmit={handleSaveSettlementPercentage} className="settings-form settings-form-inline">
                  <label className="settings-label">
                    <span>Settlement %</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={settlementPercentage}
                      onChange={(e) => setSettlementPercentage(e.target.value)}
                      placeholder="100"
                      className="settings-input settings-input-narrow"
                    />
                  </label>
                  <button type="submit" className="settings-btn settings-btn-primary" disabled={settlementSaving}>
                    {settlementSaving ? 'Saving…' : 'Save'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>

        {/* Vendor experience – one card, three blocks */}
        <section className="content-card settings-card">
          <h2 className="settings-card-title">Vendor experience</h2>

          <div className="settings-block settings-block-divider">
            <h3 className="settings-block-heading">Guidelines in vendor dashboard</h3>
            <p className="settings-block-desc">Show or hide the Guidelines link in the vendor sidebar.</p>
            {settingsLoading ? (
              <p className="text-muted">Loading...</p>
            ) : (
              <form onSubmit={handleSaveShowGuidelinesInVendor} className="settings-form">
                <div className="settings-radio-group">
                  <label className="settings-radio-label">
                    <input
                      type="radio"
                      name="showGuidelinesInVendorDashboard"
                      checked={showGuidelinesInVendorDashboard === true}
                      onChange={() => setShowGuidelinesInVendorDashboard(true)}
                    />
                    <span>Yes – show Guidelines</span>
                  </label>
                  <label className="settings-radio-label">
                    <input
                      type="radio"
                      name="showGuidelinesInVendorDashboard"
                      checked={showGuidelinesInVendorDashboard === false}
                      onChange={() => setShowGuidelinesInVendorDashboard(false)}
                    />
                    <span>No – hide Guidelines</span>
                  </label>
                </div>
                <button type="submit" className="settings-btn settings-btn-primary" disabled={guidelinesVendorSaving}>
                  {guidelinesVendorSaving ? 'Saving…' : 'Save'}
                </button>
              </form>
            )}
          </div>

          <div className="settings-block settings-block-divider">
            <h3 className="settings-block-heading">Vendor notifications</h3>
            <p className="settings-block-desc">Notification bell visibility and which categories appear in the dropdown.</p>
            {settingsLoading ? (
              <p className="text-muted">Loading...</p>
            ) : (
              <form onSubmit={handleSaveNotificationSettings} className="settings-form">
                <div className="settings-radio-group">
                  <span className="settings-radio-legend">Show notification bell</span>
                  <label className="settings-radio-label">
                    <input
                      type="radio"
                      name="showNotificationBellToVendors"
                      checked={showNotificationBellToVendors === true}
                      onChange={() => setShowNotificationBellToVendors(true)}
                    />
                    <span>Yes</span>
                  </label>
                  <label className="settings-radio-label">
                    <input
                      type="radio"
                      name="showNotificationBellToVendors"
                      checked={showNotificationBellToVendors === false}
                      onChange={() => setShowNotificationBellToVendors(false)}
                    />
                    <span>No</span>
                  </label>
                </div>
                <div className="settings-checkbox-group">
                  <span className="settings-checkbox-legend">Categories in dropdown</span>
                  <label className="settings-checkbox-label"><input type="checkbox" checked={showNotificationAppointments} onChange={(e) => setShowNotificationAppointments(e.target.checked)} /><span>Appointments</span></label>
                  <label className="settings-checkbox-label"><input type="checkbox" checked={showNotificationSettlements} onChange={(e) => setShowNotificationSettlements(e.target.checked)} /><span>Settlements</span></label>
                  <label className="settings-checkbox-label"><input type="checkbox" checked={showNotificationTickets} onChange={(e) => setShowNotificationTickets(e.target.checked)} /><span>Tickets</span></label>
                  <label className="settings-checkbox-label"><input type="checkbox" checked={showNotificationComments} onChange={(e) => setShowNotificationComments(e.target.checked)} /><span>Comments</span></label>
                  <label className="settings-checkbox-label"><input type="checkbox" checked={showNotificationSalesData} onChange={(e) => setShowNotificationSalesData(e.target.checked)} /><span>Sales Data</span></label>
                </div>
                <button type="submit" className="settings-btn settings-btn-primary" disabled={notificationsSaving}>
                  {notificationsSaving ? 'Saving…' : 'Save notification settings'}
                </button>
              </form>
            )}
          </div>

          <div className="settings-block settings-block-divider">
            <h3 className="settings-block-heading">Import buttons</h3>
            <p className="settings-block-desc">Show or hide Import buttons on Branches, Packages, Customers, Memberships, and Appointments.</p>
            {settingsLoading ? (
              <p className="text-muted">Loading...</p>
            ) : (
              <form onSubmit={handleSaveImportButton} className="settings-form">
                <div className="settings-radio-group">
                  <label className="settings-radio-label">
                    <input type="radio" name="showImportButton" checked={showImportButton === true} onChange={() => setShowImportButton(true)} />
                    <span>Yes – show Import buttons</span>
                  </label>
                  <label className="settings-radio-label">
                    <input type="radio" name="showImportButton" checked={showImportButton === false} onChange={() => setShowImportButton(false)} />
                    <span>No – hide Import buttons</span>
                  </label>
                </div>
                <button type="submit" className="settings-btn settings-btn-primary" disabled={importButtonSaving}>
                  {importButtonSaving ? 'Saving…' : 'Save'}
                </button>
              </form>
            )}
          </div>

          <div className="settings-block">
            <h3 className="settings-block-heading">Export buttons</h3>
            <p className="settings-block-desc">Show or hide Export buttons on Customers, Memberships, and Sales Data pages.</p>
            {settingsLoading ? (
              <p className="text-muted">Loading...</p>
            ) : (
              <form onSubmit={handleSaveExportButton} className="settings-form">
                <div className="settings-radio-group">
                  <label className="settings-radio-label">
                    <input type="radio" name="showExportButton" checked={showExportButton === true} onChange={() => setShowExportButton(true)} />
                    <span>Yes – show Export buttons</span>
                  </label>
                  <label className="settings-radio-label">
                    <input type="radio" name="showExportButton" checked={showExportButton === false} onChange={() => setShowExportButton(false)} />
                    <span>No – hide Export buttons</span>
                  </label>
                </div>
                <button type="submit" className="settings-btn settings-btn-primary" disabled={exportButtonSaving}>
                  {exportButtonSaving ? 'Saving…' : 'Save'}
                </button>
              </form>
            )}
          </div>

          <div className="settings-block settings-block-divider">
            <h3 className="settings-block-heading">Customer delete button</h3>
            <p className="settings-block-desc">Choose which roles can see the delete button on the Customers page (Admin, Vendor, Staff).</p>
            {settingsLoading ? (
              <p className="text-muted">Loading...</p>
            ) : (
              <form onSubmit={handleSaveCustomerDeleteVisibility} className="settings-form">
                <div className="settings-checkbox-group">
                  <label className="settings-checkbox-label">
                    <input type="checkbox" checked={showCustomerDeleteToAdmin} onChange={(e) => setShowCustomerDeleteToAdmin(e.target.checked)} />
                    <span>Show to Admin</span>
                  </label>
                  <label className="settings-checkbox-label">
                    <input type="checkbox" checked={showCustomerDeleteToVendor} onChange={(e) => setShowCustomerDeleteToVendor(e.target.checked)} />
                    <span>Show to Vendor</span>
                  </label>
                  <label className="settings-checkbox-label">
                    <input type="checkbox" checked={showCustomerDeleteToStaff} onChange={(e) => setShowCustomerDeleteToStaff(e.target.checked)} />
                    <span>Show to Staff</span>
                  </label>
                </div>
                <button type="submit" className="settings-btn settings-btn-primary" disabled={customerDeleteSaving}>
                  {customerDeleteSaving ? 'Saving…' : 'Save'}
                </button>
              </form>
            )}
          </div>
        </section>

        {/* Services */}
        <section className="content-card settings-card">
          <h2 className="settings-card-title">Services</h2>
          <p className="settings-block-desc" style={{ marginBottom: '1rem' }}>
            Add services for appointments and leads. Leave branch blank for all branches.
          </p>
          <form onSubmit={handleAddService} className="settings-form settings-form-row">
            <label className="settings-label settings-label-flex">
              <span>Name *</span>
              <input type="text" value={serviceName} onChange={(e) => setServiceName(e.target.value)} placeholder="e.g. Eyebrow threading" className="settings-input" />
            </label>
            <label className="settings-label settings-label-flex">
              <span>Category</span>
              <input type="text" value={serviceCategory} onChange={(e) => setServiceCategory(e.target.value)} placeholder="Optional" className="settings-input" />
            </label>
            <label className="settings-label settings-label-flex">
              <span>Branch</span>
              <select value={serviceBranchId} onChange={(e) => setServiceBranchId(e.target.value)} className="settings-input">
                <option value="">All branches</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            <label className="settings-label settings-label-flex">
              <span>Duration (min)</span>
              <input type="number" min={1} value={serviceDuration} onChange={(e) => setServiceDuration(e.target.value)} placeholder="—" className="settings-input settings-input-narrow" />
            </label>
            <label className="settings-label settings-label-flex">
              <span>Price ($)</span>
              <input type="number" min={0} step={0.01} value={servicePrice} onChange={(e) => setServicePrice(e.target.value)} placeholder="—" className="settings-input settings-input-narrow" />
            </label>
            <button type="submit" className="settings-btn settings-btn-primary" disabled={serviceSaving}>
              {serviceSaving ? 'Adding…' : 'Add service'}
            </button>
          </form>
          {servicesLoading ? (
            <p className="text-muted settings-services-loading">Loading services…</p>
          ) : services.length === 0 ? (
            <p className="text-muted settings-services-empty">No services yet. Add one above.</p>
          ) : (
            <div className="settings-table-wrap">
              <table className="data-table settings-table">
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
                        <td colSpan={6}>
                          <form onSubmit={handleUpdateService} className="settings-inline-form">
                            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" required className="settings-input settings-input-sm" />
                            <input type="text" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} placeholder="Category" className="settings-input settings-input-sm" />
                            <select value={editBranchId} onChange={(e) => setEditBranchId(e.target.value)} className="settings-input settings-input-sm">
                              <option value="">All branches</option>
                              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                            <input type="number" min={1} value={editDuration} onChange={(e) => setEditDuration(e.target.value)} placeholder="Min" className="settings-input settings-input-sm" />
                            <input type="number" min={0} step={0.01} value={editPrice} onChange={(e) => setEditPrice(e.target.value)} placeholder="Price" className="settings-input settings-input-sm" />
                            <button type="submit" className="settings-btn settings-btn-sm" disabled={serviceSaving}>Save</button>
                            <button type="button" className="settings-btn settings-btn-sm settings-btn-secondary" onClick={cancelEdit}>Cancel</button>
                          </form>
                        </td>
                      ) : (
                        <>
                          <td>{s.name}</td>
                          <td>{s.category || '—'}</td>
                          <td>{s.branch || 'All'}</td>
                          <td>{s.durationMinutes != null ? `${s.durationMinutes} min` : '—'}</td>
                          <td>{s.price != null ? `$${s.price}` : '—'}</td>
                          <td>
                            <button type="button" className="settings-btn settings-btn-sm settings-btn-secondary" onClick={() => startEdit(s)}>Edit</button>
                            <button type="button" className="settings-btn settings-btn-sm settings-btn-danger" onClick={() => handleDeleteService(s.id)}>Remove</button>
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
    </div>
  );
}
