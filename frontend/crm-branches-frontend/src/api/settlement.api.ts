import { http } from './http';
import type { Settlement } from '../types/common';

export async function getSettlements(): Promise<{
  success: boolean;
  settlements?: Settlement[];
  summary?: { from: string; to: string; amount: number }[];
  message?: string;
}> {
  const r = await http<{ settlements: Settlement[]; summary: { from: string; to: string; amount: number }[] }>('/reports/settlements');
  if (r.success && 'settlements' in r)
    return { success: true, settlements: r.settlements as Settlement[], summary: r.summary as { from: string; to: string; amount: number }[] };
  return { success: false, message: r.message };
}
