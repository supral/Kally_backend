import { http } from './http';

export interface SalesImageItem {
  id: string;
  title: string;
  description: string;
  date: string;
  branchId: string;
  branchName: string;
  hasImage: boolean;
  salesCount: number;
  manualSalesCount: number | null;
  salesAmount: number | null;
  createdAt: string;
}

export interface SalesImageDetail extends SalesImageItem {
  /** Array of base64 image strings. Use imageBase64s[0] for backward compat with single-image views. */
  imageBase64s: string[];
}

export async function getSalesImages(params?: { branchId?: string }): Promise<{
  success: boolean;
  images?: SalesImageItem[];
  message?: string;
}> {
  const query = params?.branchId ? `?branchId=${encodeURIComponent(params.branchId)}` : '';
  const r = await http<{ images: SalesImageItem[] }>(`/sales-images${query}`);
  if (r.success && 'images' in r) return { success: true, images: r.images as SalesImageItem[] };
  return { success: false, message: r.message };
}

export async function getSalesImage(id: string): Promise<{
  success: boolean;
  image?: SalesImageDetail;
  message?: string;
}> {
  const r = await http<{ image: SalesImageDetail }>(`/sales-images/${id}`);
  if (r.success && 'image' in r) return { success: true, image: r.image as SalesImageDetail };
  return { success: false, message: r.message };
}

export async function createSalesImage(data: {
  title: string;
  description?: string;
  date: string;
  imageBase64s: string[];
  branchId?: string;
  manualSalesCount?: number | null;
  salesAmount?: number | null;
}): Promise<{
  success: boolean;
  image?: SalesImageItem;
  message?: string;
}> {
  const r = await http<{ image: SalesImageItem }>('/sales-images', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (r.success && 'image' in r) return { success: true, image: r.image as SalesImageItem };
  return { success: false, message: r.message || 'Failed to upload' };
}

export async function updateSalesImage(
  id: string,
  data: { manualSalesCount?: number | null; description?: string; salesAmount?: number | null }
): Promise<{
  success: boolean;
  image?: SalesImageItem;
  message?: string;
}> {
  const body: { manualSalesCount?: number | null; description?: string; salesAmount?: number | null } = {};
  if (data.manualSalesCount !== undefined) body.manualSalesCount = data.manualSalesCount;
  if (data.description !== undefined) body.description = data.description;
  if (data.salesAmount !== undefined) body.salesAmount = data.salesAmount;
  const r = await http<{ image: SalesImageItem }>(`/sales-images/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (r.success && 'image' in r) return { success: true, image: r.image as SalesImageItem };
  return { success: false, message: r.message || 'Failed to update' };
}
