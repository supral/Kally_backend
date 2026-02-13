import { http } from './http';
import type { User } from '../auth/auth.types';

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: User;
  message?: string;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const r = await http<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (r.success && 'token' in r && 'user' in r)
    return { success: true, token: r.token as string, user: r.user as User };
  return { success: false, message: r.message };
}

export async function register(data: {
  name: string;
  email: string;
  password: string;
  role?: string;
  vendorName?: string;
}): Promise<AuthResponse> {
  const r = await http<{ token: string; user: User }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (r.success && 'token' in r && 'user' in r)
    return { success: true, token: r.token as string, user: r.user as User };
  return { success: false, message: r.message };
}

export async function getMe(): Promise<{ success: boolean; user?: User; message?: string }> {
  const r = await http<{ user: User }>('/auth/me');
  if (r.success && 'user' in r) return { success: true, user: r.user as User };
  return { success: false, message: r.message };
}

/** Vendors can assign themselves to a branch. */
export async function updateMyBranch(branchId: string | null): Promise<{ success: boolean; user?: User; message?: string }> {
  const r = await http<{ user: User }>('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify({ branchId }),
  });
  if (r.success && 'user' in r) return { success: true, user: r.user as User };
  return { success: false, message: r.message };
}

export async function updateProfile(data: {
  name?: string;
  email?: string;
  vendorName?: string;
  profilePhoto?: string | null;
}): Promise<{ success: boolean; user?: User; message?: string }> {
  const r = await http<{ user: User }>('/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (r.success && 'user' in r) return { success: true, user: r.user as User };
  return { success: false, message: r.message };
}

export async function updatePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
  const r = await http<Record<string, never>>('/auth/password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (r.success) return { success: true };
  return { success: false, message: r.message };
}
