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
  /**
   * Tooltip shown on hover. Per the design rule, KPI tiles should surface
   * definition · period · source · calculation. Pass a single string with
   * those four facets separated by ` · ` (or use \n for line breaks).
   * If omitted, an auto-tooltip is built from `label` + `hint`/`delta`.
   */
  tooltip?: string;
}

export default function KpiCard({
  label, value, kind = 'number', tone = 'neutral',
  delta, deltaTone, hint, greyed = false,
  showSecondaryCurrency = true,
  valueLak,
  tooltip,
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

  // Auto-tooltip: if no explicit tooltip is provided, build one from the
  // label + delta/hint so every KPI tile has *some* hover affordance.
  const tip =
    tooltip ??
    [label, delta, hint].filter(Boolean).join(' · ');

  // Render into the canonical .kpi-box layout so KpiCard matches OpsKpiTile,
  // KpiBox, and inline tiles. Same delta-top / value / label / sub structure.
  const deltaCls = deltaTone === 'pos' ? 'pos' : deltaTone === 'neg' ? 'neg' : 'flat';
  return (
    <div className="kpi-box" data-tooltip={tip || undefined} data-state={greyed ? 'data-needed' : 'live'}>
      {delta && (
        <div className="kpi-box-deltas">
          <span className={`kpi-box-delta ${deltaCls}`}>{delta}</span>
        </div>
      )}
      <div className={`kpi-box-value ${numCls === 'greyed' ? 'lorem' : numCls}`}>{display}</div>
      <div className="kpi-tile-scope">{label}</div>
      {secondary && <div className="kpi-tile-sub">{secondary}</div>}
      {hint && !delta && <div className="kpi-tile-sub">{hint}</div>}
    </div>
  );
}
