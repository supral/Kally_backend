import { useState, useRef } from 'react';
import { useAuthStore } from '../../../auth/auth.store';
import * as authApi from '../../../api/auth.api';

export default function VendorProfilePage() {
  const { user, refreshUser } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [vendorName, setVendorName] = useState(user?.vendorName ?? '');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(user?.profilePhoto ?? null);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setName(user?.name ?? '');
    setEmail(user?.email ?? '');
    setVendorName(user?.vendorName ?? '');
    setProfilePhoto(user?.profilePhoto ?? null);
    setProfileError('');
    setProfileSuccess('');
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setProfileError('');
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setProfileLoading(true);
    const payload: { name: string; email: string; vendorName?: string; profilePhoto?: string | null } = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
    };
    if (user?.role === 'vendor') payload.vendorName = vendorName.trim() || undefined;
    payload.profilePhoto = profilePhoto || null;
    const res = await authApi.updateProfile(payload);
    setProfileLoading(false);
    if (res.success && res.user) {
      setProfileSuccess('Profile updated successfully.');
      setEditing(false);
      await refreshUser();
    } else {
      setProfileError(res.message || 'Failed to update profile');
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    setPasswordLoading(true);
    const res = await authApi.updatePassword(currentPassword, newPassword);
    setPasswordLoading(false);
    if (res.success) {
      setPasswordSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setPasswordError(res.message || 'Failed to update password');
    }
  };

  const initials = (user?.name ?? 'V').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setProfileError('Please select an image file (JPEG, PNG, GIF).');
      return;
    }
    if (file.size > 500 * 1024) {
      setProfileError('Image must be less than 500 KB.');
      return;
    }
    setProfileError('');
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setProfilePhoto(result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="dashboard-content vendor-profile-pro">
      <header className="vendor-profile-header">
        <div className="vendor-profile-avatar" aria-hidden="true">
          {(editing ? profilePhoto : user?.profilePhoto) ? (
            <img src={editing ? profilePhoto! : user!.profilePhoto!} alt="" className="vendor-profile-avatar-img" />
          ) : (
            initials
          )}
        </div>
        <div className="vendor-profile-header-text">
          <h1 className="vendor-profile-name">{user?.name ?? 'Profile'}</h1>
          <p className="vendor-profile-role">
            <span className="vendor-profile-role-badge">{user?.role === 'vendor' ? 'Vendor' : user?.role}</span>
            {user?.role === 'vendor' && user?.branchName && (
              <span className="vendor-profile-branch"> · {user.branchName}</span>
            )}
          </p>
        </div>
      </header>

      <div className="vendor-profile-grid">
        <section className="content-card vendor-profile-card">
          <div className="vendor-profile-card-head">
            <h2 className="vendor-profile-card-title">Account details</h2>
            {!editing ? (
              <button type="button" className="vendor-profile-btn vendor-profile-btn-edit" onClick={startEdit}>
                Edit profile
              </button>
            ) : (
              <button type="button" className="vendor-profile-btn vendor-profile-btn-ghost" onClick={cancelEdit}>
                Cancel
              </button>
            )}
          </div>

          {profileError && (
            <div className="vendor-profile-alert vendor-profile-alert-error" role="alert">
              {profileError}
            </div>
          )}
          {profileSuccess && (
            <div className="vendor-profile-alert vendor-profile-alert-success">{profileSuccess}</div>
          )}

          {!editing ? (
            <dl className="vendor-profile-dl">
              <div className="vendor-profile-row">
                <dt>Profile photo</dt>
                <dd>
                  {user?.profilePhoto ? (
                    <img src={user.profilePhoto} alt="Profile" className="vendor-profile-photo-preview" />
                  ) : (
                    <span className="text-muted">No photo</span>
                  )}
                </dd>
              </div>
              <div className="vendor-profile-row">
                <dt>Name</dt>
                <dd>{user?.name ?? '—'}</dd>
              </div>
              <div className="vendor-profile-row">
                <dt>Email</dt>
                <dd>{user?.email ?? '—'}</dd>
              </div>
              {user?.role === 'vendor' && (
                <>
                  <div className="vendor-profile-row">
                    <dt>Business name</dt>
                    <dd>{user?.vendorName ?? '—'}</dd>
                  </div>
                  <div className="vendor-profile-row">
                    <dt>Branch</dt>
                    <dd>{user?.branchName ?? '—'}</dd>
                  </div>
                </>
              )}
              <div className="vendor-profile-row">
                <dt>Role</dt>
                <dd className="vendor-profile-role-value">{user?.role ?? '—'}</dd>
              </div>
            </dl>
          ) : (
            <form onSubmit={handleProfileSubmit} className="vendor-profile-form">
              <label className="vendor-profile-field vendor-profile-photo-field">
                <span className="vendor-profile-field-label">Profile photo</span>
                <div className="vendor-profile-photo-edit">
                  <div className="vendor-profile-photo-preview-wrap">
                    {profilePhoto ? (
                      <img src={profilePhoto} alt="Preview" className="vendor-profile-photo-preview-edit" />
                    ) : (
                      <span className="vendor-profile-photo-placeholder">No photo</span>
                    )}
                  </div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handlePhotoChange}
                    className="vendor-profile-photo-input"
                    aria-label="Upload profile photo"
                  />
                  <button type="button" className="vendor-profile-photo-btn" onClick={() => photoInputRef.current?.click()}>
                    {profilePhoto ? 'Change photo' : 'Add photo'}
                  </button>
                  {profilePhoto && (
                    <button type="button" className="vendor-profile-photo-remove" onClick={() => setProfilePhoto(null)}>
                      Remove
                    </button>
                  )}
                </div>
              </label>
              <label className="vendor-profile-field">
                <span className="vendor-profile-field-label">Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="vendor-profile-input"
                  required
                />
              </label>
              <label className="vendor-profile-field">
                <span className="vendor-profile-field-label">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="vendor-profile-input"
                  required
                />
              </label>
              {user?.role === 'vendor' && (
                <label className="vendor-profile-field">
                  <span className="vendor-profile-field-label">Business name</span>
                  <input
                    type="text"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    className="vendor-profile-input"
                    placeholder="Your business or vendor name"
                  />
                </label>
              )}
              <div className="vendor-profile-actions">
                <button type="button" className="vendor-profile-btn vendor-profile-btn-ghost" onClick={cancelEdit}>
                  Cancel
                </button>
                <button type="submit" className="vendor-profile-btn vendor-profile-btn-primary" disabled={profileLoading}>
                  {profileLoading ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          )}
        </section>

        {user?.role === 'vendor' && (
          <section className="content-card vendor-profile-card">
            <h2 className="vendor-profile-card-title">My branch</h2>
            <p className="vendor-profile-card-desc">
              You can only view data for your assigned branch. Branch assignment can be changed by an admin from Staff.
            </p>
            <div className="vendor-profile-field">
              <span className="vendor-profile-field-label">Branch</span>
              <div className="vendor-profile-branch-readonly" aria-label="Your assigned branch (view only)">
                {user?.branchName ?? 'No branch assigned'}
              </div>
            </div>
          </section>
        )}

        <section className="content-card vendor-profile-card">
          <h2 className="vendor-profile-card-title">Security</h2>
          <p className="vendor-profile-card-desc">Change your password. Use at least 6 characters.</p>

          {passwordError && (
            <div className="vendor-profile-alert vendor-profile-alert-error" role="alert">
              {passwordError}
            </div>
          )}
          {passwordSuccess && (
            <div className="vendor-profile-alert vendor-profile-alert-success">{passwordSuccess}</div>
          )}

          <form onSubmit={handlePasswordSubmit} className="vendor-profile-form">
            <label className="vendor-profile-field">
              <span className="vendor-profile-field-label">Current password</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="vendor-profile-input"
                required
                autoComplete="current-password"
              />
            </label>
            <label className="vendor-profile-field">
              <span className="vendor-profile-field-label">New password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="vendor-profile-input"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </label>
            <label className="vendor-profile-field">
              <span className="vendor-profile-field-label">Confirm new password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="vendor-profile-input"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </label>
            <div className="vendor-profile-actions">
              <button type="submit" className="vendor-profile-btn vendor-profile-btn-primary" disabled={passwordLoading}>
                {passwordLoading ? 'Updating…' : 'Update password'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
