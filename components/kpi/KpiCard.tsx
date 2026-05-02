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
  /**
   * Real-column LAK value (no FX multiplication). When `valueLak` is provided
   * alongside a numeric `value` (interpreted as USD), the secondary currency
   * line uses this exact LAK value rather than synthesizing one via FX.
   *
   * If `value` is missing and `valueLak` present, LAK becomes primary when
   * the user toggles to LAK — picked from real columns end-to-end.
   *
   * Use this whenever the source view exposes `<metric>_usd` AND `<metric>_lak`
   * pairs (e.g. f_overview_kpis). This satisfies the audit rule:
   * "Never multiply USD by a hardcoded number to fake LAK."
   */
  valueLak?: number | null;
}

export default function KpiCard({
  label, value, kind = 'number', tone = 'neutral',
  delta, deltaTone, hint, greyed = false,
  showSecondaryCurrency = true,
  valueLak,
}: Props) {
  const { ccy } = useCcy();
  let display = '—';
  let secondary: string | null = null;

  // Real-column dual-currency path: caller passed both USD and LAK columns.
  // We render whichever currency is selected from its own column — no FX math.
  const hasRealLak = typeof valueLak === 'number';

  if (greyed || value === null || value === undefined || value === '') {
    display = '—';
  } else if (kind === 'money' && typeof value === 'number') {
    if (hasRealLak) {
      const primary = ccy === 'LAK' ? (valueLak as number) : value;
      display = fmtMoney(primary, ccy);
      if (showSecondaryCurrency) {
        const altCcy = ccy === 'LAK' ? 'USD' : 'LAK';
        const altVal = ccy === 'LAK' ? value : (valueLak as number);
        secondary = fmtMoney(altVal, altCcy);
      }
    } else {
      // Legacy single-value path. Secondary currency is suppressed because
      // synthesizing it via FX violates the no-hardcoded-FX rule.
      display = fmtMoney(value, ccy);
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
