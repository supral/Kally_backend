import { apiRequest } from './client';
import type { Branch } from '../types/crm';

export async function getBranches(opts?: { all?: boolean }): Promise<{ success: boolean; branches?: Branch[]; message?: string }> {
  const query = opts?.all ? '?all=1' : '';
  const r = await apiRequest<{ branches: Branch[] }>(`/branches${query}`);
  if (r.success && 'branches' in r) return { success: true, branches: (r as { branches: Branch[] }).branches };
  return { success: false, message: (r as { message?: string }).message };
}

export async function createBranch(data: { name: string; code?: string; address?: string; zipCode?: string }) {
  return apiRequest<{ branch: Branch }>('/branches', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateBranch(id: string, data: Partial<Branch>) {
  return apiRequest<{ branch: Branch }>(`/branches/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteBranch(id: string): Promise<{ success: boolean; message?: string }> {
  const r = await apiRequest<{ message?: string }>(`/branches/${id}`, { method: 'DELETE' });
  return r.success ? { success: true } : { success: false, message: (r as { message?: string }).message };
}
