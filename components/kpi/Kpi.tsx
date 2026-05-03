'use client';
import { useCcy } from '@/components/ui/CurrencyToggle';
import { fmtMoney, fmtPct, fmtNumber, type Currency } from '@/lib/format';

type Props = {
  label: string;
  value: number | string | null | undefined;
  kind?: 'money' | 'pct' | 'number' | 'text';
  hint?: string;
  status?: 'good' | 'bad' | 'warn' | 'neutral';
  greyed?: boolean;
  tooltip?: string; // hover tooltip (definition · period · source · calc)
};

export function Kpi({ label, value, kind='number', hint, status='neutral', greyed=false, tooltip }: Props) {
  const { ccy } = useCcy();
  let display: string = '—';
  let secondary: string | null = null;

  if (greyed) display = '—';
  else if (kind === 'money' && typeof value === 'number') {
    display = fmtMoney(value, ccy);
    secondary = fmtMoney(value, ccy === 'USD' ? 'LAK' : 'USD');
  } else if (kind === 'pct' && typeof value === 'number') display = fmtPct(value);
  else if (kind === 'number' && typeof value === 'number') display = fmtNumber(value);
  else if (typeof value === 'string') display = value;

  const cls = status === 'good' ? 'pos' : status === 'bad' ? 'neg' : status === 'warn' ? 'warn' : '';
  const tip = tooltip ?? [label, hint].filter(Boolean).join(' · ');

  return (
    <div className="kpi-box" data-tooltip={tip || undefined} data-state={greyed ? 'data-needed' : 'live'}>
      <div className={`kpi-box-value ${greyed ? 'lorem' : cls}`}>{display}</div>
      <div className="kpi-tile-scope">{label}</div>
      {secondary && <div className="kpi-tile-sub">{secondary}</div>}
      {hint && <div className="kpi-tile-sub">{hint}</div>}
    </div>
  );
}
