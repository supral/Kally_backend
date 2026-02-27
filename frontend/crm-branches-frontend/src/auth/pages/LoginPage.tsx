import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../auth.store';
import { ROUTES, LOGO_URL } from '../../config/constants';
import { AuthBackgroundAnimation } from '../components/AuthBackgroundAnimation';
import loginBgImage from '../../images/login.jpg';

const BLOCKED_MESSAGE = 'Your account has been blocked. Contact admin.';
const REMEMBERED_EMAIL_KEY = 'rememberedEmail';

function IconUser() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconUserCircle() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="8" r="3" />
    </svg>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState(() => {
    try {
      const stored = localStorage.getItem(REMEMBERED_EMAIL_KEY);
      return stored || '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(() => {
    try {
      return !!localStorage.getItem(REMEMBERED_EMAIL_KEY);
    } catch {
      return false;
    }
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('blocked') === '1') setError(BLOCKED_MESSAGE);
  }, [location.search]);

  if (user) {
    const redirect = user.role === 'admin' ? ROUTES.admin.root : ROUTES.vendor.root;
    navigate(from || redirect, { replace: true });
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (res.success && res.user) {
      if (remember) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
      } else {
        localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }
      const to = from || (res.user.role === 'admin' ? ROUTES.admin.root : ROUTES.vendor.root);
      navigate(to, { replace: true });
    } else setError(res.message || 'Login failed');
  }

  return (
    <div className="login-modern-page">
      <div className="login-modern-bg" style={{ backgroundImage: `url(${loginBgImage})` }} />
      <AuthBackgroundAnimation />
      <div className="login-modern-card-wrap">
        <div className="login-modern-avatar">
          <IconUserCircle />
        </div>
        <div className="login-modern-card">
          <div className="login-modern-brand">
            <img src={LOGO_URL} alt="Logo" className="login-modern-logo" style={{ height: '80px', maxWidth: '360px' }} />
          </div>

          {error && (
            <div className="login-modern-error" role="alert">
              {error.includes('blocked') || error.includes('Contact admin') ? BLOCKED_MESSAGE : error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-modern-form">
            <label className="login-modern-field">
              <span className="login-modern-label">Email ID</span>
              <span className="login-modern-input-wrap">
                <span className="login-modern-input-icon">
                  <IconUser />
                </span>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="login-modern-input"
                />
              </span>
            </label>
            <label className="login-modern-field">
              <span className="login-modern-label">Password</span>
              <span className="login-modern-input-wrap">
                <span className="login-modern-input-icon">
                  <IconLock />
                </span>
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="login-modern-input"
                />
              </span>
            </label>
            <div className="login-modern-options">
              <label className="login-modern-remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="login-modern-checkbox"
                />
                <span>Remember me</span>
              </label>
            </div>
            <button type="submit" className="login-modern-submit" disabled={loading}>
              {loading ? 'Signing in...' : 'LOGIN'}
            </button>
          </form>
          <p className="login-modern-tagline">
            Your multi-branch threading business, all in one place.
          </p>
        </div>
      </div>
    </div>
  );
}
