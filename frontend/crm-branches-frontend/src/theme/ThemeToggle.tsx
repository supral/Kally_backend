import { useTheme } from './ThemeContext';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
    >
      {theme === 'dark' ? (
        <span className="theme-toggle-icon" aria-hidden>☀️</span>
      ) : (
        <span className="theme-toggle-icon" aria-hidden>🌙</span>
      )}
    </button>
  );
}
