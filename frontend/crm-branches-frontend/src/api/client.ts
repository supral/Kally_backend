// Local development: backend at http://localhost:5000
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '') + '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; message?: string }> {
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
  } catch (e) {
    return { success: false, message: 'Network error. Please check your connection.' };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('token');
      const msg = (data.message || '').toLowerCase();
      if (msg.includes('blocked') || msg.includes('deactivated')) {
        window.location.href = `${window.location.origin}/login?blocked=1`;
        return { success: false, message: data.message || 'Request failed' };
      }
      window.location.href = `${window.location.origin}/login`;
    }
    return { success: false, message: data.message || 'Request failed' };
  }
  return { success: true, ...data };
}
