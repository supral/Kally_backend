import { apiRequest } from './client';
import type { User } from '../types/auth';

interface AuthResponse {
  success: boolean;
  token?: string;
  user?: User;
  message?: string;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const result = await apiRequest<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (result.success && 'token' in result && 'user' in result) {
    return {
      success: true,
      token: (result as { token: string; user: User }).token,
      user: (result as { token: string; user: User }).user,
    };
  }
  return { success: false, message: (result as { message?: string }).message };
}

export async function register(data: {
  name: string;
  email: string;
  password: string;
  role?: string;
  vendorName?: string;
}): Promise<AuthResponse> {
  const result = await apiRequest<{ token: string; user: User }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (result.success && 'token' in result && 'user' in result) {
    return {
      success: true,
      token: (result as { token: string; user: User }).token,
      user: (result as { token: string; user: User }).user,
    };
  }
  return { success: false, message: (result as { message?: string }).message };
}

export async function getMe(): Promise<{ success: boolean; user?: User; message?: string }> {
  const result = await apiRequest<{ user: User }>('/auth/me');
  if (result.success && 'user' in result) {
    return { success: true, user: (result as { user: User }).user };
  }
  return { success: false, message: (result as { message?: string }).message };
}
