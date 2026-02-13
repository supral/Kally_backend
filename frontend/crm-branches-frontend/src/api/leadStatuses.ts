import { apiRequest } from './client';

export interface LeadStatusItem {
  id: string;
  name: string;
  order: number;
  isDefault?: boolean;
}

export async function getLeadStatuses(): Promise<{ success: boolean; leadStatuses?: LeadStatusItem[]; message?: string }> {
  const r = await apiRequest<{ leadStatuses: LeadStatusItem[] }>('/lead-statuses');
  if (r.success && 'leadStatuses' in r) return { success: true, leadStatuses: (r as { leadStatuses: LeadStatusItem[] }).leadStatuses };
  return { success: false, message: (r as { message?: string }).message };
}

export async function createLeadStatus(data: { name: string; order?: number; isDefault?: boolean }) {
  return apiRequest<{ leadStatus: LeadStatusItem }>('/lead-statuses', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateLeadStatus(id: string, data: { name?: string; order?: number; isDefault?: boolean; isActive?: boolean }) {
  return apiRequest<{ leadStatus: LeadStatusItem }>(`/lead-statuses/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteLeadStatus(id: string) {
  return apiRequest<{ message: string }>(`/lead-statuses/${id}`, { method: 'DELETE' });
}
