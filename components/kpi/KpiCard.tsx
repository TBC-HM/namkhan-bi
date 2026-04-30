'use client';

// components/kpi/KpiCard.tsx
// Beyond Circle KPI tile — italic serif number on top, mono uppercase label, optional delta.

import { useCcy } from '@/components/ui/CurrencyToggle';
import { fmtMoney, fmtPct, fmtNumber } from '@/lib/format';

type Tone = 'pos' | 'neg' | 'warn' | 'neutral';
type Kind = 'money' | 'pct' | 'number' | 'text';

interface Props {
  label: string;
  value: number | string | null | undefined;
  kind?: Kind;
  tone?: Tone;
  delta?: string;            // e.g. '+12.4% vs LY'
  deltaTone?: Tone;
  hint?: string;             // small hint below
  greyed?: boolean;
  showSecondaryCurrency?: boolean;
}

export default function KpiCard({
  label, value, kind = 'number', tone = 'neutral',
  delta, deltaTone, hint, greyed = false,
  showSecondaryCurrency = true,
}: Props) {
  const { ccy } = useCcy();
  let display = '—';
  let secondary: string | null = null;

  if (greyed || value === null || value === undefined || value === '') {
    display = '—';
  } else if (kind === 'money' && typeof value === 'number') {
    display = fmtMoney(value, ccy);
    if (showSecondaryCurrency) {
      secondary = fmtMoney(value, ccy === 'USD' ? 'LAK' : 'USD');
    }
  } else if (kind === 'pct' && typeof value === 'number') {
    display = fmtPct(value);
  } else if (kind === 'number' && typeof value === 'number') {
    display = fmtNumber(value);
  } else if (typeof value === 'string') {
    display = value;
  }

  const numCls = greyed ? 'greyed' : tone;

  return (
    <div className="kpi-card">
      <div className={`kpi-num ${numCls}`}>{display}</div>
      <div className="kpi-lbl">{label}</div>
      {secondary && <div className="kpi-secondary">{secondary}</div>}
      {delta && <div className={`kpi-delta ${deltaTone || 'neutral'}`}>{delta}</div>}
      {hint && !delta && <div className="kpi-secondary">{hint}</div>}
    </div>
  );
}
