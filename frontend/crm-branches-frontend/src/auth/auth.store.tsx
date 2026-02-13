import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as authApi from '../api/auth.api';
import type { User, Role } from './auth.types';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string; user?: User }>;
  register: (data: { name: string; email: string; password: string; role?: Role; vendorName?: string }) => Promise<{ success: boolean; message?: string; user?: User }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState(!!token);

  const persistAuth = useCallback((newToken: string | null, newUser: User | null) => {
    if (newToken) localStorage.setItem(TOKEN_KEY, newToken);
    else localStorage.removeItem(TOKEN_KEY);
    if (newUser) localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    else localStorage.removeItem(USER_KEY);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => persistAuth(null, null), [persistAuth]);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    const res = await authApi.getMe();
    if (res.success && res.user) {
      setUser(res.user);
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    authApi
      .getMe()
      .then((res) => {
        if (res.success && res.user) {
          setUser(res.user);
          localStorage.setItem(USER_KEY, JSON.stringify(res.user));
        } else logout();
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
        logout();
      });
  }, [token, logout]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await authApi.login(email, password);
      if (res.success && res.token && res.user) {
        persistAuth(res.token, res.user);
        return { success: true, user: res.user };
      }
      return { success: false, message: res.message || 'Login failed' };
    },
    [persistAuth]
  );

  const register = useCallback(
    async (data: { name: string; email: string; password: string; role?: Role; vendorName?: string }) => {
      const res = await authApi.register(data);
      if (res.success && res.token && res.user) {
        persistAuth(res.token, res.user);
        return { success: true, user: res.user };
      }
      return { success: false, message: res.message || 'Registration failed' };
    },
    [persistAuth]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user && !!token,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthStore() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthStore must be used within AuthProvider');
  return ctx;
}
