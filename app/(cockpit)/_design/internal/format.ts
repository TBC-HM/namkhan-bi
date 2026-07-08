// Shared formatting helpers for primitives.
// Per design_system v5: tabular-nums everywhere, semantic direction colors.

import type { KpiComparison, KpiCompareFormat } from '../types';

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€', USD: '$', LAK: '₭',
};

export function formatNumber(n: number, opts?: { signed?: boolean; decimals?: number }): string {
  const decimals = opts?.decimals ?? 0;
  const signed = opts?.signed ?? false;
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const s = abs.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (!signed) return n < 0 ? `−${s}` : s;
  if (n > 0)  return `+${s}`;
  if (n < 0)  return `−${s}`;
  return s;
}

export function formatCurrency(n: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? '';
  return `${sym}${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function formatComparison(value: number, label: string, format: KpiCompareFormat, currency?: string): string {
  switch (format) {
    case 'percent':
      return `${formatNumber(value, { signed: true, decimals: 0 })}%`;
    case 'currency':
      if (!currency) return formatNumber(value, { signed: true });
      return `${value < 0 ? '−' : '+'}${formatCurrency(Math.abs(value), currency)}`;
    case 'absolute':
    default: {
      const suffix = /pct|rate/i.test(label) ? ' pp' : '';
      return `${formatNumber(value, { signed: true, decimals: 0 })}${suffix}`;
    }
  }
}

export function directionFor(value: number, supplied?: 'up'|'down'|'flat'): 'up'|'down'|'flat' {
  if (supplied) return supplied;
  if (value > 0)  return 'up';
  if (value < 0)  return 'down';
  return 'flat';
}

export function directionColor(dir: 'up'|'down'|'flat', isGoodWhenUp = true): string {
  if (dir === 'flat') return 'var(--ink-soft, #5A5A5A)';
  const good = (dir === 'up' && isGoodWhenUp) || (dir === 'down' && !isGoodWhenUp);
  return good ? 'var(--status-green, #2E7D32)' : 'var(--status-red, #B8542A)';
}

export function arrowFor(dir: 'up'|'down'|'flat'): string {
  if (dir === 'up') return '↑';
  if (dir === 'down') return '↓';
  return '→';
}

export function renderCompareLine(c: KpiComparison, currency?: string): {
  label: string;
  body: string;
  arrow: string;
  color: string;
  pending: boolean;
} {
  const pending = c.status === 'pending';
  const dir = directionFor(c.value, c.direction);
  const color = directionColor(dir, c.isGoodWhenUp ?? true);
  const body = pending ? '—' : formatComparison(c.value, c.label, c.format ?? 'percent', currency);
  return { label: c.label, body, arrow: pending ? '' : arrowFor(dir), color, pending };
}
