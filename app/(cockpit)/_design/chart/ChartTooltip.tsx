// Universal Recharts tooltip — same chrome for every variant.
// Spec: design_system v5 §3.2 universal hover contract.

'use client';

import type { CSSProperties, ReactNode } from 'react';

interface Payload {
  name?: string;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
  dataKey?: string;
}

interface Props {
  active?: boolean;
  label?: string | number;
  payload?: Payload[];
  formatY?: (v: number) => string;
  formatX?: (v: unknown) => string;
  tooltipFormatter?: (point: Record<string, unknown>, series?: string) => ReactNode;
  variant?: string;
  showStackTotal?: boolean;
}

function fmt(v: number | string | undefined, formatter?: (n: number) => string): string {
  if (v === undefined || v === null) return '—';
  if (typeof v === 'number' && formatter) return formatter(v);
  if (typeof v === 'number') return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return String(v);
}

export default function ChartTooltip(props: Props) {
  const { active, label, payload, formatY, formatX, tooltipFormatter, showStackTotal } = props;
  if (!active || !payload || payload.length === 0) return null;

  if (tooltipFormatter && payload[0]?.payload) {
    return (
      <div style={S.box}>
        {tooltipFormatter(payload[0].payload, payload[0].dataKey)}
      </div>
    );
  }

  const displayLabel = formatX && label !== undefined ? formatX(label) : label;
  const total = showStackTotal
    ? payload.reduce((acc, p) => acc + (typeof p.value === 'number' ? p.value : 0), 0)
    : null;

  return (
    <div style={S.box} role="tooltip">
      {displayLabel !== undefined && <div style={S.label}>{String(displayLabel)}</div>}
      <div style={S.list}>
        {payload.map((p, i) => (
          <div key={i} style={S.row}>
            <span style={{ ...S.swatch, background: p.color ?? 'var(--primary, #1F3A2E)' }} />
            <span style={S.name}>{p.name ?? p.dataKey}</span>
            <span style={S.value}>{fmt(p.value, formatY)}</span>
          </div>
        ))}
        {total !== null && (
          <div style={{ ...S.row, ...S.totalRow }}>
            <span style={S.swatch} />
            <span style={S.name}>Total</span>
            <span style={S.value}>{fmt(total, formatY)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  box: {
    background: 'var(--paper, #FFFFFF)',
    border: '1px solid var(--hairline, #E6DFCC)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    borderRadius: 6,
    padding: '8px 12px',
    fontFamily: 'var(--sans, "Inter Tight", system-ui, sans-serif)',
    fontSize: 12,
    color: 'var(--ink, #1B1B1B)',
    fontVariantNumeric: 'tabular-nums',
    pointerEvents: 'none',
    minWidth: 120,
  },
  label: { fontWeight: 600, marginBottom: 4 },
  list: { display: 'flex', flexDirection: 'column', gap: 2 },
  row: { display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 8, alignItems: 'center' },
  totalRow: { borderTop: '1px solid var(--hairline, #E6DFCC)', marginTop: 4, paddingTop: 4, fontWeight: 600 },
  swatch: { width: 8, height: 8, borderRadius: 2, display: 'inline-block' },
  name: { color: 'var(--ink-soft, #5A5A5A)' },
  value: { fontWeight: 600 },
};
