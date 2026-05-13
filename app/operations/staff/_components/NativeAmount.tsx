// app/operations/staff/_components/NativeAmount.tsx
// PBS 2026-05-13 — currency-aware amount renderer.
// Replaces UsdLak in dept breakdown so Donna shows €X → $Y, not the broken
// "$1 (₭13k)" coming from LAK-only formatter.
//
// Usage:
//   <NativeAmount value={2127.58} currency="EUR" />     → €2.1k  ($2.3k)
//   <NativeAmount value={21500000} currency="LAK" />    → $1,000  (₭21.5M)
//   <NativeAmount value={1000} currency="USD" />        → $1,000

import { EMPTY } from '@/lib/format';

const TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  LAK: 1 / 21800,
};

function fmtNative(n: number, ccy: string): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  switch (ccy) {
    case 'EUR':
      if (abs >= 1_000_000) return `${sign}€${(abs / 1_000_000).toFixed(1)}M`;
      if (abs >= 1_000)     return `${sign}€${(abs / 1_000).toFixed(1)}k`;
      return `${sign}€${Math.round(abs).toLocaleString('de-DE')}`;
    case 'USD':
      if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
      if (abs >= 10_000)    return `${sign}$${(abs / 1_000).toFixed(1)}k`;
      return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
    case 'LAK':
    default:
      if (abs >= 1_000_000_000) return `${sign}₭${(abs / 1_000_000_000).toFixed(1)}B`;
      if (abs >= 1_000_000)     return `${sign}₭${(abs / 1_000_000).toFixed(1)}M`;
      if (abs >= 1_000)         return `${sign}₭${Math.round(abs / 1_000).toLocaleString()}k`;
      return `${sign}₭${Math.round(abs).toLocaleString()}`;
  }
}

function fmtUsd(usd: number): string {
  const abs = Math.abs(usd);
  const sign = usd < 0 ? '−' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000)    return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
}

interface Props {
  /** Amount in `currency`. */
  value: number | null | undefined;
  /** Currency of `value`. */
  currency: string;
  /** Suppress the parenthetical USD conversion. */
  hideUsd?: boolean;
  /** Bold the primary number. */
  bold?: boolean;
  /** Color tone for the primary number. */
  tone?: 'default' | 'pos' | 'neg' | 'mute';
}

export default function NativeAmount({ value, currency, hideUsd = false, bold = false, tone = 'default' }: Props) {
  const n = Number(value ?? 0);
  if (n === 0) {
    return <span style={{ color: 'var(--ink-faint)' }}>{EMPTY}</span>;
  }

  const toneColor: Record<NonNullable<Props['tone']>, string> = {
    default: 'var(--ink)',
    pos: 'var(--st-good, #2c7a4b)',
    neg: 'var(--oxblood-soft, #8e3a35)',
    mute: 'var(--ink-mute)',
  };

  const native = fmtNative(n, currency);
  // For USD source: no parenthetical (would be redundant).
  if (currency === 'USD' || hideUsd) {
    return (
      <span style={{ color: toneColor[tone], fontWeight: bold ? 600 : 500, fontVariantNumeric: 'tabular-nums' }}>
        {native}
      </span>
    );
  }

  const rate = TO_USD[currency] ?? 0;
  const usd = n * rate;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ color: toneColor[tone], fontWeight: bold ? 600 : 500, fontVariantNumeric: 'tabular-nums' }}>
        {native}
      </span>
      <span style={{
        fontFamily: 'var(--mono)',
        fontSize: 'var(--t-xs, 11px)',
        color: 'var(--ink-mute)',
        letterSpacing: 0,
        whiteSpace: 'nowrap',
      }}>
        ({fmtUsd(usd)})
      </span>
    </span>
  );
}
