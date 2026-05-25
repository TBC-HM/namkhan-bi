// components/kpi/KpiBox.tsx — PBS #205 (2026-05-25)
// Legacy KPI box ADAPTED to delegate to the canonical KpiTile primitive.
// Every existing KpiBox callsite (50+ on /finance/pnl alone) automatically
// renders with the new design without touching any call site. Locked spec
// preserved for tooltip/needs/state behavior — mapped onto KpiTile props.

import { ReactNode } from 'react';
import { fmtKpi, type KpiUnit } from '@/lib/format';
import { KpiTile, type KpiTileProps } from '@/app/(cockpit)/_design';

export interface KpiDelta {
  /** Raw numeric delta (e.g. +5.2 for +5.2pp). Sign matters. */
  value: number | null | undefined;
  /** Unit of the delta (usually 'pp', 'pct', 'usd', or 'd'). */
  unit: KpiUnit;
  /** Period label appended after value (e.g. 'STLY', 'Bgt', 'WoW'). */
  period?: string;
}

export interface KpiBoxProps {
  value: number | null | undefined;
  unit: KpiUnit;
  label: string;
  delta?: KpiDelta;
  compare?: KpiDelta;
  state?: 'live' | 'data-needed' | 'pending';
  needs?: string;
  valueText?: ReactNode;
  dp?: number;
  tooltip?: string;
}

export default function KpiBox(props: KpiBoxProps) {
  const { value, unit, label, delta, compare, state = 'live', needs, valueText, dp, tooltip } = props;

  // Value formatting:
  //   - valueText overrides (string passed through; JSX falls back to fmtKpi)
  //   - state='pending' → 'lorem'
  //   - state='data-needed' → '—'
  //   - else fmtKpi(value, unit, dp)
  const display: string =
    typeof valueText === 'string' || typeof valueText === 'number'
      ? String(valueText)
      : state === 'pending'
      ? 'lorem'
      : state === 'data-needed'
      ? '—'
      : fmtKpi(value, unit, dp);

  // State → status mapping
  const status: KpiTileProps['status'] =
    state === 'data-needed' ? 'amber' :
    state === 'pending' ? 'grey' :
    undefined;

  // Footnote — needs takes priority over tooltip (data-needed is the louder
  // signal). Truncate tooltip to ~120 chars to keep tiles tight.
  const tooltipShort = tooltip && tooltip.length > 120 ? tooltip.slice(0, 117) + '…' : tooltip;
  const footnote = needs ? `Needs: ${needs}` : tooltipShort;

  // Delta mapping — KpiTile expects { value, period, direction }.
  const kpiTileDelta: KpiTileProps['delta'] =
    delta && delta.value != null && Number.isFinite(Number(delta.value))
      ? {
          value: Number(delta.value),
          period: delta.period ?? '',
          direction: Number(delta.value) >= 0 ? 'up' : 'down',
        }
      : undefined;

  // Note: `compare` (second delta) is dropped — KpiTile supports a single
  // delta. Pages relying on dual-delta should switch to a custom Container
  // layout. Audit before removing the prop.
  void compare;

  return (
    <KpiTile
      label={label}
      value={display}
      size="sm"
      status={status}
      footnote={footnote}
      delta={kpiTileDelta}
    />
  );
}
