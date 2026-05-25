// components/kpi/KpiBox.tsx — PBS #205 v3 (2026-05-25)
// Legacy KPI box adapted to delegate to canonical KpiTile.
// v3 (FIX): preserves BOTH delta + compare second-pill via KpiTile.compare[]
// array, plus passes tooltip through to footnote so info from the legacy
// hover survives. data-needed pills surface as status='amber' AND value='—'.
//
// Every existing KpiBox call site auto-upgrades — zero call-site edits.

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

function unitToCompareFormat(unit: KpiUnit): 'absolute' | 'percent' | 'currency' {
  if (unit === 'usd' || unit === 'eur' || unit === 'lak') return 'currency';
  if (unit === 'pct' || unit === 'pp') return 'percent';
  return 'absolute';
}

function asTileDelta(d: KpiDelta | undefined): KpiTileProps['delta'] | undefined {
  if (!d || d.value == null || !Number.isFinite(Number(d.value))) return undefined;
  const v = Number(d.value);
  return {
    value: v,
    period: d.period ?? 'prev',
    direction: v > 0 ? 'up' : v < 0 ? 'down' : 'flat',
  };
}

function asCompareItem(d: KpiDelta | undefined): import('@/app/(cockpit)/_design/types').KpiComparison | null {
  if (!d || d.value == null || !Number.isFinite(Number(d.value))) return null;
  const v = Number(d.value);
  return {
    label: d.period ?? 'cmp',
    value: v,
    format: unitToCompareFormat(d.unit),
    direction: v > 0 ? 'up' : v < 0 ? 'down' : 'flat',
  };
}

export default function KpiBox(props: KpiBoxProps) {
  const { value, unit, label, delta, compare, state = 'live', needs, valueText, dp, tooltip } = props;

  // Value formatting
  const display: string =
    typeof valueText === 'string' || typeof valueText === 'number'
      ? String(valueText)
      : state === 'pending'
      ? 'lorem'
      : state === 'data-needed'
      ? '—'
      : fmtKpi(value, unit, dp);

  // State → status
  const status: KpiTileProps['status'] =
    state === 'data-needed' ? 'amber' :
    state === 'pending' ? 'grey' :
    undefined;

  // Footnote: needs is the loud signal; tooltip is the explainer. Combine.
  const tooltipShort = tooltip && tooltip.length > 140 ? tooltip.slice(0, 137) + '…' : tooltip;
  const footnote =
    needs && tooltipShort ? `Needs: ${needs} · ${tooltipShort}` :
    needs ? `Needs: ${needs}` :
    tooltipShort;

  // Map delta → KpiTile.delta (primary movement, top)
  const tileDelta = asTileDelta(delta);

  // Map compare → KpiTile.compare[] (secondary comparisons, render below value).
  // KpiTile supports 0..n comparisons. The legacy "compare" prop was always one
  // pill, so we pass a single-item array.
  const cmpItem = asCompareItem(compare);
  const compareItems = cmpItem ? [cmpItem] : undefined;

  return (
    <KpiTile
      label={label}
      value={display}
      size="sm"
      status={status}
      footnote={footnote}
      delta={tileDelta}
      compare={compareItems}
    />
  );
}
