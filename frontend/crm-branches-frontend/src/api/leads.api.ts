import { http } from './http';
import type { Lead } from '../types/common';

export async function getLeads(params?: { branchId?: string; status?: string }): Promise<{ success: boolean; leads?: Lead[]; message?: string }> {
  const q = new URLSearchParams();
  if (params?.branchId) q.set('branchId', params.branchId);
  if (params?.status) q.set('status', params.status);
  const query = q.toString();
  const r = await http<{ leads: Lead[] }>(`/leads${query ? `?${query}` : ''}`);
  if (r.success && 'leads' in r) return { success: true, leads: r.leads as Lead[] };
  return { success: false, message: r.message };
}

export async function getLead(id: string) {
  return http<{ lead: Lead }>(`/leads/${id}`);
}

export async function createLead(data: { name: string; phone?: string; email?: string; source?: string; branchId?: string; notes?: string }) {
  return http<{ lead: Lead }>('/leads', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateLead(id: string, data: { status?: string; notes?: string }) {
  return http<{ lead: Lead }>(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function addFollowUp(leadId: string, note: string) {
  return http<{ followUps: Lead['followUps'] }>(`/leads/${leadId}/follow-up`, { method: 'POST', body: JSON.stringify({ note }) });
}
