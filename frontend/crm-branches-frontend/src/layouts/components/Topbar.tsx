import { ThemeToggle } from '../../theme/ThemeToggle';
import { LOGO_URL } from '../../config/constants';

interface TopbarProps {
  title?: string;
  onMenuClick: () => void;
  children?: React.ReactNode;
}

export function Topbar({ onMenuClick, children }: TopbarProps) {
  return (
    <header className="dashboard-header">
      <button type="button" className="dashboard-menu-btn" onClick={onMenuClick} aria-label="Toggle menu">
        <span className="hamburger" />
        <span className="hamburger" />
        <span className="hamburger" />
      </button>
      <div className="dashboard-header-logo-wrap">
        <img src={LOGO_URL} alt="Logo" className="dashboard-header-logo" />
      </div>
      <div className="dashboard-header-right">
        <ThemeToggle />
        {children}
      </div>
    </header>
  );
}
