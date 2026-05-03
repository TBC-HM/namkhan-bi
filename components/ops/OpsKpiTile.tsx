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
  return (
    <div
      className="kpi"
      data-tooltip={tip || undefined}
      style={{
        background: 'var(--paper-pure)',
        border: '1px solid var(--paper-deep)',
        borderRadius: 8,
        padding: '14px 16px',
        minHeight: 108,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div>
        <div
          style={{
            fontSize: 10,
            color: 'var(--ink-mute)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          {scope}
        </div>
        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 26,
            fontWeight: 600,
            color: valueColor || 'var(--ink)',
            marginTop: 4,
          }}
        >
          {value}
        </div>
      </div>
      <div>
        {label && (
          <div
            style={{
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
              fontSize: 13,
              color: 'var(--ink-soft)',
              marginTop: 6,
            }}
          >
            {label}
          </div>
        )}
        {delta && (
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 11,
              color:
                deltaTone === 'up' ? 'var(--st-good)' : deltaTone === 'dn' ? 'var(--st-bad)' : 'var(--ink-mute)',
              marginTop: 2,
            }}
          >
            {delta}
          </div>
        )}
        {needs && (
          <span
            style={{
              display: 'inline-block',
              background: 'var(--st-warn-bg)',
              border: '1px solid var(--st-warn-bd)',
              color: 'var(--brass)',
              fontSize: 10,
              padding: '2px 7px',
              borderRadius: 4,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginTop: 4,
            }}
          >
            {needs}
          </span>
        )}
      </div>
    </div>
  );
}
