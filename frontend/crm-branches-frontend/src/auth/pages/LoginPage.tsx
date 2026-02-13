import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../auth.store';
import { ROUTES } from '../../config/constants';
import { AuthBackgroundAnimation } from '../components/AuthBackgroundAnimation';
import loginBgImage from '../../images/login.jpg';

const LEFT_PANEL_BG = loginBgImage;
const BLOCKED_MESSAGE = 'Your account has been blocked. Contact admin.';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      const to = from || (res.user.role === 'admin' ? ROUTES.admin.root : ROUTES.vendor.root);
      navigate(to, { replace: true });
    } else setError(res.message || 'Login failed');
  }

  return (
    <div className="ui-social-login-page">
      <div className="ui-social-login-bg" style={{ backgroundImage: `url(${LEFT_PANEL_BG})` }} />
      <AuthBackgroundAnimation />
      <div className="ui-social-login-card">
        {/* Left panel: visual / branding */}
        <div
          className="ui-social-login-left"
          style={{ backgroundImage: `url(${LEFT_PANEL_BG})` }}
        >
          <div className="ui-social-login-left-overlay" />
          <div className="ui-social-login-left-inner">
            <div className="ui-social-login-left-top">
              <div className="ui-social-login-left-top-right" />
            </div>
          </div>
        </div>

        {/* Right panel: login form */}
        <div className="ui-social-login-right">
          <div className="ui-social-login-right-header">
            <span className="ui-social-login-brand">Kallythreading</span>
          </div>
          <p className="ui-social-login-welcome-sub">Welcome to Kallythreading</p>

          {error && (
            <div className="ui-social-login-error" role="alert">
              {error.includes('blocked') || error.includes('Contact admin') ? BLOCKED_MESSAGE : error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="ui-social-login-form">
            <input
              type="email"
              className="ui-social-login-input"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <input
              type="password"
              className="ui-social-login-input"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <div className="ui-social-login-forgot-wrap">
              <Link to={ROUTES.forgotPassword} className="ui-social-login-forgot">Forgot password?</Link>
            </div>

            <button type="submit" className="ui-social-login-submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Login'}
            </button>
          </form>

          <div className="ui-social-login-right-footer">
            <p className="ui-social-login-tagline">
              Your multi-branch threading business, all in one place.
            </p>
            <div className="ui-social-login-features">
              <span>Branches</span>
              <span className="ui-social-login-features-dot">•</span>
              <span>Customers</span>
              <span className="ui-social-login-features-dot">•</span>
              <span>Appointments</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
