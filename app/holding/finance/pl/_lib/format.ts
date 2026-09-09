// app/holding/finance/pl/_lib/format.ts
// Formatting helpers for the holding P&L. Brief holding-pl-v1 v2.
//
// LAW: no currency literal lives in this module. Every formatter takes the
// currency code from the row or the payload (L15 — TBC transacts in several
// currencies and EUR is a named reporting LAYER, not "the" currency).
// A missing/unparseable number renders as an em dash, never as zero.

/** Coerce a JSON scalar to a finite number, or null. Never substitutes 0. */
export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Format money in the currency the DATA names.
 * Intl throws on a non-ISO code, so an unknown code degrades to
 * "1,234.00 XYZ" — the amount is still true and the layer is still labelled.
 */
export function money(v: unknown, currency: string, dp = 0): string {
  const n = num(v);
  if (n === null) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: dp,
      maximumFractionDigits: dp,
    }).format(n);
  } catch {
    return `${n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })} ${currency}`;
  }
}

/** Plain number, no currency. */
export function count(v: unknown): string {
  const n = num(v);
  return n === null ? '—' : n.toLocaleString('en-US');
}

/** "202507" -> "Jul 2025". Anything else passes through untouched. */
export function monthLabel(yyyymm: string): string {
  if (!/^\d{6}$/.test(yyyymm)) return yyyymm;
  const y = Number(yyyymm.slice(0, 4));
  const m = Number(yyyymm.slice(4, 6));
  if (m < 1 || m > 12) return yyyymm;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
    month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

/** ISO date -> "9 Sep 2026". Null-safe. */
export function dateLabel(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

/** Accept a YYYY-MM-DD query param, else null so the RPC picks the period. */
export function isoDateOrNull(v: string | undefined): string | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return Number.isNaN(new Date(v).getTime()) ? null : v;
}
