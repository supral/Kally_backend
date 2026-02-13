import { http } from './http';
import type { SalesDashboard } from '../types/common';

export async function getSalesDashboard(params?: {
  branchId?: string;
  from?: string;
  to?: string;
  serviceCategory?: string;
}): Promise<{ success: boolean; data?: SalesDashboard; message?: string }> {
  const q = new URLSearchParams();
  if (params?.branchId) q.set('branchId', params.branchId);
  if (params?.from) q.set('from', params.from);
  if (params?.to) q.set('to', params.to);
  if (params?.serviceCategory) q.set('serviceCategory', params.serviceCategory);
  const query = q.toString();
  const r = await http<SalesDashboard>(`/reports/sales-dashboard${query ? `?${query}` : ''}`);
  if (r.success && 'totalRevenue' in r) return { success: true, data: r as unknown as SalesDashboard };
  return { success: false, message: r.message };
}
