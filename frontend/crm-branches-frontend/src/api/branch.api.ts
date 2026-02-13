import { http } from './http';
import type { Branch } from '../types/common';

export async function getBranches(): Promise<{ success: boolean; branches?: Branch[]; message?: string }> {
  const r = await http<{ branches: Branch[] }>('/branches');
  if (r.success && 'branches' in r) return { success: true, branches: r.branches as Branch[] };
  return { success: false, message: r.message };
}

export async function createBranch(data: { name: string; code?: string; address?: string }) {
  return http<{ branch: Branch }>('/branches', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateBranch(id: string, data: Partial<Branch>) {
  return http<{ branch: Branch }>(`/branches/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}
