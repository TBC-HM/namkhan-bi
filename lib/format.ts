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

// Convenience alias used by app/guest/directory/_components — formats USD.
export function fmtUSD(n: number | null | undefined): string {
  return fmtMoney(n, 'USD');
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

// =============================================================================
// KPI BOX FORMATTERS — locked rules per 11_BRAND_AND_UI_STANDARDS.md
// =============================================================================
// Every KPI value/delta in the application MUST flow through one of these
// helpers (or the <KpiBox> component which calls them). No exceptions.
//
// Rules:
//   USD whole         -> $206
//   USD >=1k <1M      -> $8.9k       (1 decimal, k suffix, no space)
//   USD >=1M          -> $1.2M       (1 decimal, M suffix, no space)
//   USD negative      -> −$3.1k      (true minus, not hyphen)
//   LAK               -> ₭ prefix    (locked — never "LAK" suffix)
//   Percent           -> 28.3%       (no space)
//   Percentage points -> +5.2pp / −3.1pp (sign + value + pp, no space)
//   Days              -> 42d
//   Nights / ALOS     -> 2.8         (decimal, no unit)
//   Counts            -> 1,234       (locale-grouped)

const MINUS = '−'; // U+2212 true minus, not ASCII hyphen

export type KpiUnit =
  | 'usd'
  | 'lak'
  | 'pct'
  | 'pp'
  | 'd'
  | 'nights'
  | 'count'
  | 'text';

/** Format a number for a KPI value (locked rules). */
export function fmtKpi(n: number | null | undefined, unit: KpiUnit, dp = 1): string {
  if (n == null || (typeof n === 'number' && isNaN(n))) return '—';
  if (unit === 'text') return String(n);

  const neg = (n as number) < 0;
  const abs = Math.abs(n as number);
  const sign = neg ? MINUS : '';

  switch (unit) {
    case 'usd': {
      if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
      if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}k`;
      return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
    }
    case 'lak': {
      // LAK uses ₭ prefix (locked decision per user 2026-05-03).
      if (abs >= 1_000_000_000) return `${sign}₭${(abs / 1_000_000_000).toFixed(1)}B`;
      if (abs >= 1_000_000)     return `${sign}₭${(abs / 1_000_000).toFixed(1)}M`;
      if (abs >= 1_000)         return `${sign}₭${(abs / 1_000).toFixed(0)}k`;
      return `${sign}₭${Math.round(abs).toLocaleString('en-US')}`;
    }
    case 'pct':
      return `${sign}${abs.toFixed(dp)}%`;
    case 'pp':
      return `${neg ? MINUS : '+'}${abs.toFixed(dp)}pp`;
    case 'd':
      return `${sign}${Math.round(abs)}d`;
    case 'nights':
      return `${sign}${abs.toFixed(dp)}`;
    case 'count':
      return `${sign}${Math.round(abs).toLocaleString('en-US')}`;
  }
}

/** Format a delta value with arrow + period suffix.
 *  Output: "▲ +5.2pp STLY" / "▼ −3.1pp Bgt" / "→ stable" */
export function fmtDelta(
  n: number | null | undefined,
  unit: KpiUnit,
  period?: string,
  opts: { stableThreshold?: number; dp?: number } = {}
): { text: string; tone: 'pos' | 'neg' | 'flat'; arrow: string } {
  const { stableThreshold = 0.05, dp = 1 } = opts;
  if (n == null || (typeof n === 'number' && isNaN(n))) {
    return { text: '—', tone: 'flat', arrow: '→' };
  }

  const v = n as number;
  if (Math.abs(v) <= stableThreshold) {
    return { text: period ? `→ stable ${period}` : '→ stable', tone: 'flat', arrow: '→' };
  }
  const arrow = v > 0 ? '▲' : '▼';
  const tone: 'pos' | 'neg' = v > 0 ? 'pos' : 'neg';
  // pp / pct: include explicit + for positive
  const valueText =
    unit === 'pp'  ? `${v > 0 ? '+' : MINUS}${Math.abs(v).toFixed(dp)}pp`
    : unit === 'pct' ? `${v > 0 ? '+' : MINUS}${Math.abs(v).toFixed(dp)}%`
    : unit === 'usd' ? `${v > 0 ? '+' : MINUS}$${Math.abs(v) >= 1_000 ? `${(Math.abs(v) / 1_000).toFixed(1)}k` : Math.round(Math.abs(v)).toLocaleString()}`
    : unit === 'd'   ? `${v > 0 ? '+' : MINUS}${Math.round(Math.abs(v))}d`
    : `${v > 0 ? '+' : MINUS}${Math.abs(v).toFixed(dp)}`;
  return {
    text: period ? `${arrow} ${valueText} ${period}` : `${arrow} ${valueText}`,
    tone,
    arrow,
  };
}
