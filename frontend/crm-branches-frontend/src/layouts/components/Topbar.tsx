import { ThemeToggle } from '../../theme/ThemeToggle';

interface TopbarProps {
  title: string;
  onMenuClick: () => void;
  children?: React.ReactNode;
}

export function Topbar({ title, onMenuClick, children }: TopbarProps) {
  return (
    <header className="dashboard-header">
      <button type="button" className="dashboard-menu-btn" onClick={onMenuClick} aria-label="Toggle menu">
        <span className="hamburger" />
        <span className="hamburger" />
        <span className="hamburger" />
      </button>
      <h1 className="dashboard-header-title">{title}</h1>
      <ThemeToggle />
      {children}
    </header>
  );
}
