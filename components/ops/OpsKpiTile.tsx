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
}

export default function OpsKpiTile({
  scope,
  value,
  label,
  delta,
  deltaTone = 'flat',
  needs,
  valueColor,
}: Props) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e6dfc9',
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
            color: '#8a8170',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          {scope}
        </div>
        <div
          style={{
            fontFamily: 'ui-monospace, Menlo, monospace',
            fontSize: 26,
            fontWeight: 600,
            color: valueColor || '#1c1c1a',
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
              fontFamily: 'Georgia, serif',
              fontStyle: 'italic',
              fontSize: 13,
              color: '#4a4538',
              marginTop: 6,
            }}
          >
            {label}
          </div>
        )}
        {delta && (
          <div
            style={{
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: 11,
              color:
                deltaTone === 'up' ? '#2f6f4a' : deltaTone === 'dn' ? '#a02d2d' : '#8a8170',
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
              background: '#fef3c7',
              border: '1px solid #f3d57a',
              color: '#5e4818',
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
