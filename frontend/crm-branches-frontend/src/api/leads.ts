import { apiRequest } from './client';
import type { Lead } from '../types/crm';

export interface GetLeadsParams {
  branchId?: string;
  status?: string;
  source?: string;
  serviceId?: string;
  search?: string;
  from?: string;
  to?: string;
}

export async function getLeads(params?: GetLeadsParams): Promise<{ success: boolean; leads?: Lead[]; message?: string }> {
  const q = new URLSearchParams();
  if (params?.branchId) q.set('branchId', params.branchId);
  if (params?.status) q.set('status', params.status);
  if (params?.source) q.set('source', params.source);
  if (params?.serviceId) q.set('serviceId', params.serviceId);
  if (params?.search) q.set('search', params.search);
  if (params?.from) q.set('from', params.from);
  if (params?.to) q.set('to', params.to);
  const query = q.toString();
  const r = await apiRequest<{ leads: Lead[] }>(`/leads${query ? `?${query}` : ''}`);
  if (r.success && 'leads' in r) return { success: true, leads: (r as { leads: Lead[] }).leads };
  return { success: false, message: (r as { message?: string }).message };
}

export async function getLead(id: string) {
  return apiRequest<{ lead: Lead }>(`/leads/${id}`);
}

export async function createLead(data: { name: string; phone?: string; email?: string; source?: string; branchId?: string; serviceId?: string; notes?: string }) {
  return apiRequest<{ lead: Lead }>('/leads', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateLead(id: string, data: { status?: string; notes?: string; serviceId?: string }) {
  return apiRequest<{ lead: Lead }>(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function addFollowUp(leadId: string, note: string) {
  return apiRequest<{ followUps: Lead['followUps'] }>(`/leads/${leadId}/follow-up`, { method: 'POST', body: JSON.stringify({ note }) });
}

export async function deleteLead(id: string): Promise<{ success: boolean; message?: string }> {
  const r = await apiRequest(`/leads/${id}`, { method: 'DELETE' });
  return { success: !!r.success, message: (r as { message?: string }).message };
}

export async function bulkDeleteLeads(ids: string[]): Promise<{ success: boolean; deleted?: number; message?: string }> {
  const r = await apiRequest<{ deleted: number }>('/leads/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) });
  if (r.success && 'deleted' in r) return { success: true, deleted: (r as { deleted: number }).deleted };
  return { success: false, message: (r as { message?: string }).message };
}
