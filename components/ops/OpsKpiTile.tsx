// components/ops/OpsKpiTile.tsx
//
// Legacy shim that renders into the canonical .kpi-box CSS so OpsKpiTile,
// KpiBox, KpiCard, and inline tiles all share one visual rule set.
// New code should use <KpiBox/> from components/kpi/KpiBox directly —
// the structured props give better tooltips and locked formatting.

import { ReactNode } from 'react';

interface Props {
  scope: string;
  value: ReactNode;
  label?: string;
  delta?: string;
  deltaTone?: 'up' | 'dn' | 'flat';
  needs?: string;
  valueColor?: string;
  tooltip?: string;
}

export default function OpsKpiTile({
  scope,
  value,
  label,
  delta,
  deltaTone = 'flat',
  needs,
  valueColor,
  tooltip,
}: Props) {
  const tip = tooltip ?? [scope, label, delta].filter(Boolean).join(' · ');
  const deltaCls = deltaTone === 'up' ? 'pos' : deltaTone === 'dn' ? 'neg' : 'flat';
  const dataNeeded = !!needs;
  return (
    <div className="kpi-box" data-tooltip={tip || undefined} data-state={dataNeeded ? 'data-needed' : 'live'}>
      {delta && (
        <div className="kpi-box-deltas">
          <span className={`kpi-box-delta ${deltaCls}`}>{delta}</span>
        </div>
      )}
      <div
        className={`kpi-box-value${dataNeeded ? ' lorem' : ''}`}
        style={valueColor && !dataNeeded ? { color: valueColor } : undefined}
      >
        {value}
      </div>
      <div className="kpi-tile-scope">{scope}</div>
      {label && <div className="kpi-box-sub-label">{label}</div>}
      {dataNeeded && <span className="kpi-box-pill">{needs}</span>}
    </div>
  );
}
