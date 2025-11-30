export function safeParsePrice(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  
  const parsed = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(parsed) ? 0 : parsed;
}

export function formatCurrency(value: number): string {
  if (isNaN(value)) {
    return '$0.00';
  }
  return `$${value.toFixed(2)}`;
}

export function formatPercent(value: number): string {
  if (isNaN(value) || !isFinite(value)) {
    return '0.0%';
  }
  return `${value.toFixed(1)}%`;
}
