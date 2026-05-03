// components/ops/OpsKpiTile.tsx
// Block 4 — KPI tile for operations sub-tabs.
// Larger format than KpiCard, allows inline "Data needed" badge per /revenue IA standard.

import { ReactNode } from 'react';

interface Props {
  scope: string;            // small uppercase eyebrow, e.g. "Rooms ready"
  value: ReactNode;         // big numeric value or "—"
  label?: string;           // italic serif sub-label
  delta?: string;           // sub2 mono delta line
  deltaTone?: 'up' | 'dn' | 'flat';
  needs?: string;           // "Data needed · roster" — inline yellow badge
  valueColor?: string;      // override for warn/bad colour on value
  tooltip?: string;         // hover tooltip — definition · period · source · calc
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
  const deltaCls = deltaTone === 'up' ? 'pos' : deltaTone === 'dn' ? 'neg' : 'neu';
  return (
    <div className="kpi-tile" data-tooltip={tip || undefined}>
      <div>
        <div className="kpi-tile-scope">{scope}</div>
        <div
          className="kpi-tile-value"
          style={valueColor ? { color: valueColor } : undefined}
        >
          {value}
        </div>
      </div>
      <div>
        {label && <div className="kpi-tile-sub" style={{ fontStyle: 'italic', fontFamily: 'var(--serif)', fontSize: "var(--t-md)", color: 'var(--ink-soft)', marginTop: 6 }}>{label}</div>}
        {delta && <div className={`kpi-tile-delta ${deltaCls}`} style={{ marginTop: 2 }}>{delta}</div>}
        {needs && (
          <span style={{
            display: 'inline-block',
            background: 'var(--st-warn-bg)',
            border: '1px solid var(--st-warn-bd)',
            color: 'var(--brass)',
            fontSize: 'var(--t-xs)',
            padding: '2px 7px',
            borderRadius: 4,
            textTransform: 'uppercase',
            letterSpacing: 'var(--ls-loose)',
            marginTop: 4,
            fontFamily: 'var(--mono)',
            fontWeight: 600,
          }}>
            {needs}
          </span>
        )}
      </div>
    </div>
  );
}
