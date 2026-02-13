import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/hooks/useAuth';

interface DashboardLayoutProps {
  title: string;
  navItems: { to: string; label: string; icon?: string }[];
}

export function DashboardLayout({ title, navItems }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className={`dashboard ${sidebarOpen ? 'dashboard-sidebar-open' : ''}`}>
      <header className="dashboard-header">
        <button
          type="button"
          className="dashboard-menu-btn"
          onClick={() => setSidebarOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          <span className="hamburger" />
          <span className="hamburger" />
          <span className="hamburger" />
        </button>
        <h1 className="dashboard-header-title">{title}</h1>
        <div className="dashboard-header-user">
          <span className="user-name">{user?.name}</span>
          <span className="user-role">{user?.role}</span>
          <button type="button" className="btn-logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <aside className={`dashboard-sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-hidden />
        <nav className="sidebar-nav">
          <div className="sidebar-brand">{title}</div>
          <ul>
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to !== '/'}
                  className={({ isActive }) => (isActive ? 'active' : '')}
                  onClick={() => setSidebarOpen(false)}
                >
                  {item.icon && <span className="nav-icon">{item.icon}</span>}
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <main className="dashboard-main">
        <Outlet />
      </main>
    </div>
  );
}
