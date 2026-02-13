export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat().format(n);
}
