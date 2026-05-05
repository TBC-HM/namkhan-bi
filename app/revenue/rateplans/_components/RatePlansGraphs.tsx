// app/revenue/rateplans/_components/RatePlansGraphs.tsx
// 3-graph row at the top of /revenue/rateplans, mirroring the compset pattern.
// Pure SVG, client-side for hover tooltips on the trend chart.
//
// Charts:
//   1. Daily bookings + revenue trend (last 30 days) — hover shows BIG values
//   2. Revenue mix by plan type — horizontal bars
//   3. Cancel rate by plan (top 10) — colored bars
//
// User feedback (2026-05-05): when hovering over the calendar/trend chart,
// show big readable values in tooltip boxes. Implemented as inline SVG hover
// with a fixed-position card showing date + bookings + revenue + ADR.

'use client';

import { useState } from 'react';
import { fmtMoney } from '@/lib/format';

// ---- Types ----
export interface DailyTrendRow {
  day: string;            // ISO yyyy-mm-dd
  bookings: number;
  revenue: number;
  adr: number;
}
export interface TypeMixRow {
  type: string;
  bookings: number;
  revenue: number;
  nights: number;
  adr: number;
  mix: number;            // pct of total revenue
}
export interface CancelRow {
  name: string;
  cancelPct: number;
  bookings: number;
  cancellations: number;
}

interface Props {
  trend: DailyTrendRow[];
  typeMix: TypeMixRow[];
  cancel: CancelRow[];
}

const CARD: React.CSSProperties = {
  background: 'var(--paper-warm)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 8,
  padding: '14px 16px',
  position: 'relative',
};
const TITLE: React.CSSProperties = {
  fontSize: 'var(--t-md)', fontWeight: 600, color: 'var(--ink)', marginBottom: 2,
};
const SUB: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-loose)', color: 'var(--ink-mute)',
  textTransform: 'uppercase', marginBottom: 10,
};

export default function RatePlansGraphs({ trend, typeMix, cancel }: Props) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 12,
        marginTop: 14,
      }}
    >
      <div style={CARD}>
        <div style={TITLE}>Booking calendar · last 30 days</div>
        <div style={SUB}>Hover any day for full breakdown</div>
        <TrendCalendar rows={trend} />
      </div>
      <div style={CARD}>
        <div style={TITLE}>Revenue mix · by plan type</div>
        <div style={SUB}>Share of period revenue · USD</div>
        <TypeMixChart rows={typeMix} />
      </div>
      <div style={CARD}>
        <div style={TITLE}>Cancel rate · top plans</div>
        <div style={SUB}>Plans by cancellation %</div>
        <CancelChart rows={cancel} />
      </div>
    </div>
  );
}

// =========================================================================
// Chart 1: daily booking calendar with hover tooltip
// =========================================================================
function TrendCalendar({ rows }: { rows: DailyTrendRow[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const data = [...rows]
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(-30);

  if (data.length === 0) {
    return (
      <div
        style={{
          height: 180,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--ink-faint)',
          fontStyle: 'italic',
        }}
      >
        No bookings in window.
      </div>
    );
  }

  const w = 320, h = 180, padL = 28, padR = 8, padT = 12, padB = 24;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const maxBook = Math.max(1, ...data.map((d) => d.bookings));
  const maxRev = Math.max(1, ...data.map((d) => d.revenue));
  const barW = innerW / Math.max(data.length, 1);

  const revPath = data
    .map((d, i) => {
      const x = padL + i * barW + barW / 2;
      const y = padT + innerH - (d.revenue / maxRev) * innerH;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const hover = hoverIdx != null ? data[hoverIdx] : null;

  return (
    <div style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        style={{ width: '100%', height: 180 }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* Y-axis max labels */}
        <text x={4} y={padT + 8} style={axisTxt}>{maxBook}</text>
        <text x={4} y={padT + innerH} style={axisTxt}>0</text>

        {/* Bars: bookings */}
        {data.map((d, i) => {
          const x = padL + i * barW + 1;
          const bh = (d.bookings / maxBook) * innerH;
          const y = padT + innerH - bh;
          const active = hoverIdx === i;
          return (
            <rect
              key={d.day}
              x={x}
              y={y}
              width={Math.max(2, barW - 2)}
              height={bh}
              fill={active ? 'var(--brass)' : 'var(--moss)'}
              opacity={hoverIdx == null || active ? 1 : 0.45}
            />
          );
        })}

        {/* Revenue overlay line */}
        <path d={revPath} fill="none" stroke="var(--ink)" strokeWidth={1.2} opacity={0.5} />

        {/* Hover hit-areas (transparent overlay rects) */}
        {data.map((d, i) => {
          const x = padL + i * barW;
          return (
            <rect
              key={`hit-${d.day}`}
              x={x}
              y={padT}
              width={barW}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
            />
          );
        })}

        {/* Vertical guide on hover */}
        {hoverIdx != null && (
          <line
            x1={padL + hoverIdx * barW + barW / 2}
            x2={padL + hoverIdx * barW + barW / 2}
            y1={padT}
            y2={padT + innerH}
            stroke="var(--ink-faint)"
            strokeDasharray="2 2"
          />
        )}

        {/* X-axis: first / mid / last date */}
        <text x={padL} y={h - 6} style={axisTxt}>{data[0].day.slice(5)}</text>
        {data.length > 6 && (
          <text x={padL + innerW / 2 - 12} y={h - 6} style={axisTxt}>
            {data[Math.floor(data.length / 2)].day.slice(5)}
          </text>
        )}
        <text x={w - padR - 30} y={h - 6} style={axisTxt}>
          {data[data.length - 1].day.slice(5)}
        </text>

        {/* Mini-legend */}
        <g transform={`translate(${padL}, ${padT - 2})`} style={{ fontFamily: 'var(--mono)', fontSize: 8 }}>
          <rect x={0} y={-6} width={8} height={4} fill="var(--moss)" />
          <text x={11} y={-2} style={{ fill: 'var(--ink)' }}>Bookings</text>
          <line x1={64} y1={-4} x2={73} y2={-4} stroke="var(--ink)" strokeWidth={1.2} opacity={0.5} />
          <text x={76} y={-2} style={{ fill: 'var(--ink-mute)' }}>Revenue</text>
        </g>
      </svg>

      {/* Big tooltip box (the user wanted "big" hover values) */}
      {hover && (
        <div
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            background: 'var(--paper)',
            border: '1px solid var(--paper-deep)',
            borderRadius: 6,
            padding: '10px 12px',
            minWidth: 140,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 'var(--t-xs)',
              letterSpacing: 'var(--ls-extra)',
              textTransform: 'uppercase',
              color: 'var(--brass)',
              marginBottom: 4,
            }}
          >
            {hover.day}
          </div>
          <div style={tooltipRow}>
            <span style={tooltipLabel}>Bookings</span>
            <span style={tooltipValBig}>{hover.bookings}</span>
          </div>
          <div style={tooltipRow}>
            <span style={tooltipLabel}>Revenue</span>
            <span style={tooltipValBig}>{fmtMoney(hover.revenue, 'USD')}</span>
          </div>
          <div style={tooltipRow}>
            <span style={tooltipLabel}>ADR</span>
            <span style={tooltipValBig}>${Math.round(hover.adr)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

const axisTxt: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 9,
  fill: 'var(--ink-mute)',
};
const tooltipRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  gap: 10,
  marginTop: 2,
};
const tooltipLabel: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-loose)',
  textTransform: 'uppercase',
  color: 'var(--ink-mute)',
};
const tooltipValBig: React.CSSProperties = {
  fontFamily: 'var(--serif)',
  fontStyle: 'italic',
  fontSize: 'var(--t-lg)',
  fontWeight: 500,
  color: 'var(--ink)',
};

// =========================================================================
// Chart 2: revenue mix by plan type (horizontal bars)
// =========================================================================
function TypeMixChart({ rows }: { rows: TypeMixRow[] }) {
  if (rows.length === 0) return <Empty />;
  const sorted = [...rows].sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  const w = 320;
  const lineH = 22;
  const h = Math.max(180, sorted.length * lineH + 8);
  const labelW = 90;
  const valueW = 70;
  const barMaxW = w - labelW - valueW - 8;
  const max = Math.max(...sorted.map((r) => r.revenue), 1);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h }}>
      {sorted.map((r, i) => {
        const y = 4 + i * lineH;
        const barW = (r.revenue / max) * barMaxW;
        return (
          <g key={r.type}>
            <text x={labelW - 4} y={y + 14} textAnchor="end" style={mixLabel}>
              {r.type.slice(0, 14)}
            </text>
            <rect x={labelW} y={y + 4} width={barMaxW} height={14} fill="var(--paper-deep)" />
            <rect x={labelW} y={y + 4} width={barW} height={14} fill="var(--moss)" />
            <text x={labelW + barMaxW + 4} y={y + 14} style={mixVal}>
              {fmtMoney(r.revenue, 'USD')} · {r.mix.toFixed(0)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const mixLabel: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 10,
  fill: 'var(--ink)',
};
const mixVal: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 10,
  fill: 'var(--ink-soft)',
};

// =========================================================================
// Chart 3: cancel rate by plan (top 10)
// =========================================================================
function CancelChart({ rows }: { rows: CancelRow[] }) {
  if (rows.length === 0) return <Empty />;
  const sorted = [...rows]
    .filter((r) => r.bookings + r.cancellations > 0)
    .sort((a, b) => b.cancelPct - a.cancelPct)
    .slice(0, 10);
  if (sorted.length === 0) return <Empty />;

  const w = 320;
  const lineH = 18;
  const h = Math.max(180, sorted.length * lineH + 8);
  const labelW = 110;
  const valueW = 36;
  const barMaxW = w - labelW - valueW - 8;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h }}>
      {sorted.map((r, i) => {
        const y = 4 + i * lineH;
        const barW = Math.min(1, r.cancelPct / 100) * barMaxW;
        const fill =
          r.cancelPct >= 40
            ? 'var(--st-bad)'
            : r.cancelPct >= 20
            ? 'var(--brass)'
            : 'var(--moss)';
        return (
          <g key={r.name}>
            <text x={labelW - 4} y={y + 12} textAnchor="end" style={mixLabel}>
              {r.name.slice(0, 18)}
            </text>
            <rect x={labelW} y={y + 3} width={barMaxW} height={11} fill="var(--paper-deep)" />
            <rect x={labelW} y={y + 3} width={barW} height={11} fill={fill} />
            <text x={labelW + barMaxW + 4} y={y + 12} style={mixVal}>
              {r.cancelPct.toFixed(0)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Empty() {
  return (
    <div
      style={{
        height: 180,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--ink-faint)',
        fontStyle: 'italic',
      }}
    >
      No data yet
    </div>
  );
}
