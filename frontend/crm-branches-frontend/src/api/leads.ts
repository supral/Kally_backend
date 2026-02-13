import { apiRequest } from './client';
import type { Lead } from '../types/crm';

export async function getLeads(params?: { branchId?: string; status?: string }): Promise<{ success: boolean; leads?: Lead[]; message?: string }> {
  const q = new URLSearchParams();
  if (params?.branchId) q.set('branchId', params.branchId);
  if (params?.status) q.set('status', params.status);
  const query = q.toString();
  const r = await apiRequest<{ leads: Lead[] }>(`/leads${query ? `?${query}` : ''}`);
  if (r.success && 'leads' in r) return { success: true, leads: (r as { leads: Lead[] }).leads };
  return { success: false, message: (r as { message?: string }).message };
}

export async function getLead(id: string) {
  return apiRequest<{ lead: Lead }>(`/leads/${id}`);
}

export async function createLead(data: { name: string; phone?: string; email?: string; source?: string; branchId?: string; notes?: string }) {
  return apiRequest<{ lead: Lead }>('/leads', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateLead(id: string, data: { status?: string; notes?: string }) {
  return apiRequest<{ lead: Lead }>(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function addFollowUp(leadId: string, note: string) {
  return apiRequest<{ followUps: Lead['followUps'] }>(`/leads/${leadId}/follow-up`, { method: 'POST', body: JSON.stringify({ note }) });
}
