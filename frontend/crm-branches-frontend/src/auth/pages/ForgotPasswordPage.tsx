import { Link } from 'react-router-dom';
import { ROUTES } from '../../config/constants';

export default function ForgotPasswordPage() {
  return (
    <div className="auth-page">
    <div className="auth-card">
      <h1>Forgot password</h1>
      <p className="auth-subtitle">Contact your admin to reset your password.</p>
      <p className="auth-footer">
        <Link to={ROUTES.login}>Back to sign in</Link>
      </p>
    </div>
    </div>
  );
}
