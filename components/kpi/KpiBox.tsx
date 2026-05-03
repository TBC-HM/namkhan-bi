// components/kpi/KpiBox.tsx
//
// THE canonical KPI box for every pillar. Locked spec per user 2026-05-03 +
// docs/11_BRAND_AND_UI_STANDARDS.md.
//
// Layout (top-to-bottom inside one box):
//   ┌────────────────────────────────┐
//   │ ▲ +5.2pp STLY  ▼ −3.1pp Bgt   │  delta(s)            — top
//   │                                │
//   │ 28.3%                          │  primary value       — center
//   │ OCCUPANCY                      │  label (caps mono)   — under value
//   │                                │
//   │  [needs pill bottom-right]     │  data-needed badge
//   └────────────────────────────────┘
//
// Typography hierarchy (one rule, no exceptions):
//   - Primary value: italic Fraunces serif (--t-2xl)
//   - Label: mono uppercase letterspaced (--t-xs)
//   - Delta: sans small muted (--t-xs)
//   - Needs: italic small muted (--t-xs)
//
// Unit formatting: handled by lib/format.fmtKpi. Pass raw numbers + unit
// prop, never pre-format. Pre-formatted values bypass the locked rules.

import { ReactNode } from 'react';
import { fmtKpi, fmtDelta, type KpiUnit } from '@/lib/format';

export interface KpiDelta {
  /** Raw numeric delta (e.g. +5.2 for +5.2pp). Sign matters. */
  value: number | null | undefined;
  /** Unit of the delta (usually 'pp', 'pct', 'usd', or 'd'). */
  unit: KpiUnit;
  /** Period label appended after value (e.g. 'STLY', 'Bgt', 'WoW'). */
  period?: string;
}

export interface KpiBoxProps {
  /** Primary numeric value. Pass null/undefined to render "—". */
  value: number | null | undefined;
  /** Unit determines formatting. Use 'text' for arbitrary strings. */
  unit: KpiUnit;
  /** KPI label — automatically uppercased + mono-spaced. */
  label: string;
  /** Up to 2 deltas rendered side-by-side at the top. */
  delta?: KpiDelta;
  compare?: KpiDelta;
  /**
   * State of the tile.
   *   live          — normal value
   *   data-needed   — greyed value + amber "DATA NEEDED" pill
   *   pending       — italic muted "lorem"
   */
  state?: 'live' | 'data-needed' | 'pending';
  /** Explainer shown below value when state === 'data-needed'. */
  needs?: string;
  /**
   * Optional pre-formatted value override. Use ONLY when the value cannot
   * be expressed by a unit (e.g. "18 / 4" composite, "n/a", "—").
   * Prefer numeric `value` + `unit` for everything else so all KPIs share
   * one formatting rule set.
   */
  valueText?: ReactNode;
  /** Decimal places for the primary value (default: 1 for pct/nights, 0 else). */
  dp?: number;
  /** Hover tooltip — surface definition · period · source · calculation. */
  tooltip?: string;
}

export default function KpiBox({
  value,
  unit,
  label,
  delta,
  compare,
  state = 'live',
  needs,
  valueText,
  dp,
  tooltip,
}: KpiBoxProps) {
  const dataNeeded = state === 'data-needed';
  const pending = state === 'pending';

  const display: ReactNode =
    valueText ??
    (pending ? 'lorem' : dataNeeded ? '—' : fmtKpi(value, unit, dp));

  const valueClass =
    `kpi-tile-value${pending || dataNeeded ? ' lorem' : ''}`;

  const tip =
    tooltip ??
    [label, delta && fmtDelta(delta.value, delta.unit, delta.period).text]
      .filter(Boolean)
      .join(' · ');

  return (
    <div className="kpi-box" data-tooltip={tip || undefined} data-state={state}>
      {/* Delta row — top */}
      {(delta || compare) && (
        <div className="kpi-box-deltas">
          {delta && <KpiDeltaPill {...delta} />}
          {compare && <KpiDeltaPill {...compare} />}
        </div>
      )}

      {/* Primary value */}
      <div className={valueClass}>{display}</div>

      {/* Label */}
      <div className="kpi-tile-scope">{label}</div>

      {/* Data-needed badge / explainer — bottom-right */}
      {dataNeeded && (
        <>
          {needs && <div className="kpi-box-needs">Needs: {needs}</div>}
          <span className="kpi-box-pill">DATA NEEDED</span>
        </>
      )}
    </div>
  );
}

function KpiDeltaPill({ value, unit, period }: KpiDelta) {
  const { text, tone } = fmtDelta(value, unit, period);
  return <span className={`kpi-box-delta ${tone}`}>{text}</span>;
}
