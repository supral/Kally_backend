export function formatDate(d: string | Date): string {
  return new Date(d).toLocaleDateString();
}

export function formatDateTime(d: string | Date): string {
  return new Date(d).toLocaleString();
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
