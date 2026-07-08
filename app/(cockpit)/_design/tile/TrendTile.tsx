// TrendTile — single-metric tile with 30 mini bars + dashed average line.
// PBS 2026-07-08 v2: proper client-side hover — highlights the hovered bar
// and pins a floating tooltip with the date + value near the cursor.

'use client';

import { useState, type CSSProperties, type MouseEvent } from 'react';

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
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);

  const n = series.length;
  const values = series.map((d) => Number(d.value) || 0);
  const max = Math.max(1, ...values);
  const avg = n > 0 ? values.reduce((a, b) => a + b, 0) / n : 0;
  const avgY = sparkHeight - (avg / max) * sparkHeight;

  const barGap = 2;
  const svgW = 200;
  const barW = n > 0 ? Math.max(1, (svgW - (n - 1) * barGap) / n) : 0;

  function onLeave() { setHover(null); }
  function onMove(e: MouseEvent<SVGSVGElement>) {
    if (n === 0) return;
    const box = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - box.left) / box.width) * svgW;
    const i = Math.max(0, Math.min(n - 1, Math.round(relX / (barW + barGap))));
    setHover({ i, x: e.clientX - box.left, y: e.clientY - box.top });
  }

  return (
    <div style={outer}>
      <div style={labelStyle}>{label}</div>
      <div style={valueStyle}>{value}</div>

      <div style={{ position: 'relative' }}>
        <svg
          role="img"
          aria-label={`${label} · daily series`}
          width="100%"
          height={sparkHeight}
          viewBox={`0 0 ${svgW} ${sparkHeight}`}
          preserveAspectRatio="none"
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          style={{ display: 'block', marginTop: 4, cursor: 'crosshair' }}
        >
          {series.map((d, i) => {
            const h = (values[i] / max) * sparkHeight;
            const x = i * (barW + barGap);
            const y = sparkHeight - h;
            const isHover = hover?.i === i;
            return (
              <rect
                key={d.date}
                x={x}
                y={y}
                width={barW}
                height={Math.max(0.5, h)}
                fill={isHover ? '#B8542A' : color}
                opacity={isHover ? 1 : 0.85}
              />
            );
          })}
          {/* Average line — dashed, ink-soft */}
          <line
            x1={0}
            x2={svgW}
            y1={avgY}
            y2={avgY}
            stroke="#5A5A5A"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        </svg>

        {hover && series[hover.i] && (
          <div
            style={{
              ...tooltipStyle,
              // Clamp inside the container: nudge to the left when close to the right edge.
              left: Math.min(Math.max(0, hover.x - 70), 200 - 140),
              top: Math.max(-4, hover.y - 52),
            }}
          >
            <div style={{ fontWeight: 700 }}>{series[hover.i].date}</div>
            <div style={{ marginTop: 3, color: '#F5F5F5' }}>
              <span style={{ fontWeight: 600 }}>{values[hover.i].toLocaleString('en-US')}</span>
              <span style={{ marginLeft: 4, opacity: 0.75 }}>that day</span>
            </div>
            <div style={{ marginTop: 2, fontSize: 10, color: '#A8A8A8' }}>
              tile shows 30-day avg = {avg.toFixed(1)}
            </div>
          </div>
        )}
      </div>

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
const tooltipStyle: CSSProperties = {
  position: 'absolute',
  pointerEvents: 'none',
  background: '#1B1B1B',
  color: '#FFFFFF',
  fontSize: 11,
  padding: '6px 10px',
  borderRadius: 4,
  minWidth: 120,
  whiteSpace: 'nowrap',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  zIndex: 10,
};
