// Formatting + currency conversion helpers.
// LAK = base storage. USD = display default for now.
// Per project rule: LAK = base, USD = communication.

export const FX_LAK_PER_USD = Number(process.env.NEXT_PUBLIC_FX_LAK_USD || 21800);

export type Currency = 'USD' | 'LAK';

export function fmtMoney(n: number | null | undefined, ccy: Currency = 'USD'): string {
  if (n == null || isNaN(n as number)) return '—';
  if (ccy === 'USD') {
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (abs >= 10_000) return `$${(n / 1000).toFixed(1)}k`;
    return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  }
  // LAK display
  const lak = n * FX_LAK_PER_USD;
  const abs = Math.abs(lak);
  if (abs >= 1_000_000_000) return `₭${(lak / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `₭${(lak / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `₭${(lak / 1_000).toFixed(0)}k`;
  return `₭${Math.round(lak).toLocaleString()}`;
}

export function fmtPct(n: number | null | undefined, dp = 1): string {
  if (n == null || isNaN(n as number)) return '—';
  return `${n.toFixed(dp)}%`;
}

export function fmtNumber(n: number | null | undefined, dp = 0): string {
  if (n == null || isNaN(n as number)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: dp });
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateShort(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}
