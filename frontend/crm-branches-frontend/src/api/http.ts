import { API_BASE } from '../config/env';

const TOKEN_KEY = 'token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export async function http<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; message?: string } & Record<string, unknown>> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  } catch {
    return { success: false, message: 'Network error. Please check your connection.' } as { success: boolean; data?: T; message?: string } & Record<string, unknown>;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = `${window.location.origin}/login`;
    }
    return { success: false, message: (data as { message?: string }).message || 'Request failed' } as { success: boolean; data?: T; message?: string } & Record<string, unknown>;
  }
  return { success: true, ...data } as { success: boolean; data?: T; message?: string } & Record<string, unknown>;
}
