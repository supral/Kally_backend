import { AuthProvider } from '../auth/auth.store';
import { ThemeProvider } from '../theme/ThemeContext';
import { AppRouter } from './router';

export function AppProviders() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ThemeProvider>
  );
}
