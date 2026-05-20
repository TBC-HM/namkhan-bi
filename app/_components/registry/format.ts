// app/_components/registry/format.ts
// Single source of truth for cell formatting based on columns_spec.format tokens.

import type { FormatToken } from './types';

const SYMBOL: Record<string, string> = { eur: '€', lak: '₭', usd: '$' };

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function fmtMoney(n: number, symbol: string): string {
  return `${symbol}${Math.round(n).toLocaleString('en-US')}`;
}

function fmtPct(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${Math.abs(n).toFixed(1)}%`;
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

function fmtMonth(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch { return iso; }
}

export function formatValue(value: unknown, token: FormatToken, currencySymbol: string): string {
  if (value === null || value === undefined || value === '') return '—';
  switch (token) {
    case 'text':
      return String(value);
    case 'int': {
      const n = toNumber(value); return n == null ? '—' : fmtInt(n);
    }
    case 'eur': {
      const n = toNumber(value); return n == null ? '—' : fmtMoney(n, SYMBOL.eur);
    }
    case 'lak': {
      const n = toNumber(value); return n == null ? '—' : fmtMoney(n, SYMBOL.lak);
    }
    case 'usd': {
      const n = toNumber(value); return n == null ? '—' : fmtMoney(n, SYMBOL.usd);
    }
    case 'pct': {
      const n = toNumber(value); return n == null ? '—' : fmtPct(n);
    }
    case 'date': {
      return typeof value === 'string' ? fmtDate(value) : '—';
    }
    case 'month': {
      return typeof value === 'string' ? fmtMonth(value) : '—';
    }
    default:
      return String(value);
  }
}

// Used for sortable list display when no spec is provided
export function safeText(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') return isFiniteNumber(value) ? fmtInt(value) : '—';
  return String(value);
}
