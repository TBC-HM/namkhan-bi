// TrendTile — single-metric tile with 30 mini bars + dashed average line.
// Compact enough to sit next to KpiTile in the Headline strip.
// PBS 2026-07-08: initial use = "Avg RN sold · last 30d" on /revenue/pulse.

import type { CSSProperties } from 'react';

export interface TrendTileProps {
  label: string;
  /** Big number to display (already formatted). */
  value: string;
  /** Daily series, oldest → newest. */
  series: Array<{ date: string; value: number }>;
  /** Small caption under the number. */
  footnote?: string;
  /** Colour of the bars + the average line. Defaults to brand green. */
  color?: string;
  /** Height of the sparkline area (px). Defaults to 44. */
  sparkHeight?: number;
}

export default function TrendTile({
  label,
  value,
  series,
  footnote,
  color = '#084838',
  sparkHeight = 44,
}: TrendTileProps) {
  const n = series.length;
  const values = series.map((d) => Number(d.value) || 0);
  const max = Math.max(1, ...values);
  const avg = n > 0 ? values.reduce((a, b) => a + b, 0) / n : 0;
  const avgY = sparkHeight - (avg / max) * sparkHeight;

  const barGap = 2;
  const width = 200;
  const barW = n > 0 ? Math.max(1, (width - (n - 1) * barGap) / n) : 0;

  return (
    <div style={outer}>
      <div style={labelStyle}>{label}</div>
      <div style={valueStyle}>{value}</div>

      <svg
        role="img"
        aria-label={`${label} · daily series`}
        width="100%"
        height={sparkHeight}
        viewBox={`0 0 ${width} ${sparkHeight}`}
        preserveAspectRatio="none"
        style={{ display: 'block', marginTop: 4 }}
      >
        {series.map((d, i) => {
          const h = (values[i] / max) * sparkHeight;
          const x = i * (barW + barGap);
          const y = sparkHeight - h;
          return (
            <rect
              key={d.date}
              x={x}
              y={y}
              width={barW}
              height={Math.max(0.5, h)}
              fill={color}
              opacity={0.85}
            >
              <title>{`${d.date}: ${values[i]}`}</title>
            </rect>
          );
        })}
        {/* Average line — dashed, ink-soft */}
        <line
          x1={0}
          x2={width}
          y1={avgY}
          y2={avgY}
          stroke="#5A5A5A"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      </svg>

      {footnote && <div style={footnoteStyle}>{footnote}</div>}
    </div>
  );
}

const outer: CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E6DFCC',
  borderRadius: 6,
  padding: 12,
  minHeight: 132,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  fontFamily: 'inherit',
};
const labelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#5A5A5A',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
};
const valueStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 600,
  color: '#1B1B1B',
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1.15,
};
const footnoteStyle: CSSProperties = {
  fontSize: 11,
  color: '#5A5A5A',
  marginTop: 4,
};
