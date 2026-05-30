export function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatCurrencyDecimal(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function accountTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    checking: 'Checking',
    savings: 'Savings',
    brokerage: 'Brokerage',
    traditional_ira: 'Traditional IRA',
    roth_ira: 'Roth IRA',
    '401k': '401(k)',
    hsa: 'HSA',
    '529': '529 Plan',
    crypto: 'Crypto',
    real_estate: 'Real Estate',
    other: 'Other',
  };
  return labels[type] || type;
}

export function accountTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    checking: 'credit-card',
    savings: 'piggy-bank',
    brokerage: 'trending-up',
    traditional_ira: 'archive',
    roth_ira: 'archive',
    '401k': 'briefcase',
    hsa: 'heart',
    '529': 'book',
    crypto: 'zap',
    real_estate: 'home',
    other: 'folder',
  };
  return icons[type] || 'folder';
}
