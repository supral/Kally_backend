import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../auth/auth.store';
import { ROUTES } from '../../config/constants';

export function ProfileMenu() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate(ROUTES.login, { replace: true });
  }

  return (
    <div className="dashboard-header-user">
      <span className="user-name">{user?.name ?? user?.role ?? 'User'}</span>
      <button type="button" className="btn-logout" onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
}
