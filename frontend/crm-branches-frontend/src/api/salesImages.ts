import { http } from './http';

export interface SalesImageItem {
  id: string;
  title: string;
  date: string;
  branchId: string;
  branchName: string;
  hasImage: boolean;
  salesCount: number;
  createdAt: string;
}

export interface SalesImageDetail extends SalesImageItem {
  imageBase64: string;
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
  date: string;
  imageBase64: string;
  branchId?: string;
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
