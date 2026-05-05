// app/operations/staff/_components/UsdLak.tsx
// Tiny presentational component for the "$X (₭Y)" pattern.
// USD primary in normal weight, LAK secondary in mono mute small.
//
// Usage:
//   <UsdLak lak={21500000} fx={21500} />        // "$1,000  (₭21.5M)"
//   <UsdLak usd={1000} lak={21500000} />        // explicit both
//   <UsdLak lak={0} />                          // "—" (zero collapses)

import { ReactNode } from 'react';
import { EMPTY } from '@/lib/format';

interface Props {
  /** Raw LAK amount. */
  lak?: number | null;
  /** Optional USD override. If omitted, derived from lak / fx. */
  usd?: number | null;
  /** LAK per USD. Defaults to 21500. Use the per-row payroll FX where possible. */
  fx?: number;
  /** Suppress LAK parenthetical (used when only USD makes sense). */
  hideLak?: boolean;
  /** Bold the USD figure (used in totals). */
  bold?: boolean;
  /** Tone for the USD value. */
  tone?: 'default' | 'pos' | 'neg' | 'mute';
}

function fmtUsd(usd: number): string {
  const abs = Math.abs(usd);
  const sign = usd < 0 ? '−' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000)    return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
}

function fmtLak(lak: number): string {
  const abs = Math.abs(lak);
  const sign = lak < 0 ? '−' : '';
  if (abs >= 1_000_000_000) return `${sign}₭${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000)     return `${sign}₭${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)         return `${sign}₭${Math.round(abs / 1_000).toLocaleString()}k`;
  return `${sign}₭${Math.round(abs).toLocaleString()}`;
}

export default function UsdLak({ lak, usd, fx = 21500, hideLak = false, bold = false, tone = 'default' }: Props) {
  const lakNum = Number(lak ?? 0);
  const usdNum = usd != null ? Number(usd) : (lakNum && fx > 0 ? lakNum / fx : 0);

  if (lakNum === 0 && (usd == null || usdNum === 0)) {
    return <span style={{ color: 'var(--ink-faint)' }}>{EMPTY}</span>;
  }

  const toneColor: Record<NonNullable<Props['tone']>, string> = {
    default: 'var(--ink)',
    pos: 'var(--moss-glow)',
    neg: 'var(--st-bad)',
    mute: 'var(--ink-mute)',
  };

  const usdNode: ReactNode = (
    <span style={{ color: toneColor[tone], fontWeight: bold ? 600 : 400, fontVariantNumeric: 'tabular-nums' }}>
      {fmtUsd(usdNum)}
    </span>
  );

  if (hideLak || lakNum === 0) return usdNode;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
      {usdNode}
      <span style={{
        fontFamily: 'var(--mono)',
        fontSize: 'var(--t-xs)',
        color: 'var(--ink-mute)',
        letterSpacing: 0,
        whiteSpace: 'nowrap',
      }}>
        ({fmtLak(lakNum)})
      </span>
    </span>
  );
}
