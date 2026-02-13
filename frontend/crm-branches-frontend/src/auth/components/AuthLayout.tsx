import { Outlet } from 'react-router-dom';
import { ThemeToggle } from '../../theme/ThemeToggle';

export function AuthLayout() {
  return (
    <div className="auth-layout">
      <header className="auth-header-bar">
        <ThemeToggle />
      </header>
      <Outlet />
    </div>
  );
}
