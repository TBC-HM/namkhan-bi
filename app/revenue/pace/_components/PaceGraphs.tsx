// app/revenue/pace/_components/PaceGraphs.tsx
//
// 3-graph row at the top of /revenue/pace, mirroring compset/rateplans/pulse.
//
// Charts:
//   1. REAL PACE CURVE — `v_pace_curve` via paceCurveSvg
//      (the graphic that was MISSING from the old pace page — what makes
//      this an actual pace page now)
//   2. OTB by stay-bucket — bars from v_otb_pace
//   3. STLY pace per bucket — % achieved vs last year at same lead time

import { paceCurveSvg } from '@/lib/svgCharts';
import type { PaceCurveRow } from '@/lib/pulseData';

export interface BucketRow {
  key: string;
  rns: number;
  rev: number;
  cxl: number;
  days: number;
  capacity: number;
  stlyRn: number;
  stlyRev: number;
}

interface Props {
  paceCurve: PaceCurveRow[];
  buckets: BucketRow[];
  formatLabel: (key: string) => string;
}

const CARD: React.CSSProperties = {
  background: 'var(--paper-warm)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 8,
  padding: '14px 16px',
  minHeight: 280,
};
const TITLE: React.CSSProperties = {
  fontSize: 'var(--t-md)', fontWeight: 600, color: 'var(--ink)', marginBottom: 2,
};
const SUB: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-loose)', color: 'var(--ink-mute)',
  textTransform: 'uppercase', marginBottom: 10,
};
const EMPTY: React.CSSProperties = {
  height: 200,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--ink-faint)',
  fontStyle: 'italic',
  fontSize: 'var(--t-sm)',
};

export default function PaceGraphs({ paceCurve, buckets, formatLabel }: Props) {
  const paceSvg = paceCurve.length > 0 ? paceCurveSvg(paceCurve) : '';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: 12,
        marginTop: 14,
      }}
    >
      {/* CHART 1 — the real pace curve */}
      <div style={CARD}>
        <div style={TITLE}>Booking pace curve</div>
        <div style={SUB}>Actual / OTB / STLY / Budget · rooms occupied · −30d → +30d</div>
        {paceSvg ? (
          <div dangerouslySetInnerHTML={{ __html: paceSvg }} style={{ width: '100%' }} />
        ) : (
          <div style={EMPTY}>No pace curve data</div>
        )}
      </div>

      {/* CHART 2 — OTB bars */}
      <div style={CARD}>
        <div style={TITLE}>OTB by stay-bucket</div>
        <div style={SUB}>Confirmed room nights in window</div>
        <BucketsChart buckets={buckets} formatLabel={formatLabel} />
      </div>

      {/* CHART 3 — STLY pace % */}
      <div style={CARD}>
        <div style={TITLE}>STLY pace per bucket</div>
        <div style={SUB}>OTB ÷ STLY actuals · % at same lead time</div>
        <StlyPaceChart buckets={buckets} formatLabel={formatLabel} />
      </div>
    </div>
  );
}

// ---------- Chart 2: OTB bars per bucket ----------
function BucketsChart({
  buckets,
  formatLabel,
}: {
  buckets: BucketRow[];
  formatLabel: (key: string) => string;
}) {
  if (buckets.length === 0) {
    return (
      <div style={EMPTY}>No on-the-books in this window.</div>
    );
  }
  const w = 320;
  const h = 220;
  const padL = 32, padR = 8, padT = 12, padB = 30;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const maxRns = Math.max(1, ...buckets.map((b) => b.rns));
  const barW = innerW / buckets.length;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 220 }}>
      <text x={4} y={padT + 8} style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>
        {maxRns}
      </text>
      <text x={4} y={padT + innerH} style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>
        0
      </text>
      {buckets.map((b, i) => {
        const bh = (b.rns / maxRns) * innerH;
        const x = padL + i * barW + 1.5;
        const y = padT + innerH - bh;
        const occ = b.capacity > 0 ? (b.rns / b.capacity) * 100 : 0;
        const fill = occ >= 70 ? 'var(--moss)' : occ >= 30 ? 'var(--brass)' : 'var(--ink-mute)';
        return (
          <g key={b.key}>
            <rect x={x} y={y} width={Math.max(2, barW - 3)} height={bh} fill={fill}>
              <title>{`${formatLabel(b.key)} · ${b.rns} RN · ${occ.toFixed(0)}% occ · $${Math.round(b.rev).toLocaleString()}`}</title>
            </rect>
            {b.rns > 0 && (
              <text
                x={x + (barW - 3) / 2}
                y={y - 2}
                textAnchor="middle"
                style={{ fontFamily: 'var(--mono)', fontSize: 8, fill: 'var(--ink)' }}
              >
                {b.rns}
              </text>
            )}
            <text
              x={x + (barW - 3) / 2}
              y={h - 8}
              textAnchor="middle"
              style={{ fontFamily: 'var(--mono)', fontSize: 8, fill: 'var(--ink-mute)' }}
            >
              {formatLabel(b.key)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------- Chart 3: STLY pace per bucket ----------
function StlyPaceChart({
  buckets,
  formatLabel,
}: {
  buckets: BucketRow[];
  formatLabel: (key: string) => string;
}) {
  const data = buckets.filter((b) => b.stlyRn > 0);
  if (data.length === 0) {
    return <div style={EMPTY}>No STLY data in window.</div>;
  }
  const w = 320;
  const h = 220;
  const padL = 36, padR = 8, padT = 12, padB = 30;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const pcts = data.map((b) => (b.rns / b.stlyRn) * 100);
  const maxPct = Math.max(150, ...pcts);
  const barW = innerW / data.length;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 220 }}>
      {/* 100% line */}
      <line
        x1={padL}
        x2={w - padR}
        y1={padT + innerH - (100 / maxPct) * innerH}
        y2={padT + innerH - (100 / maxPct) * innerH}
        stroke="var(--ink-faint)"
        strokeDasharray="3 3"
      />
      <text
        x={padL - 4}
        y={padT + innerH - (100 / maxPct) * innerH + 3}
        textAnchor="end"
        style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}
      >
        100%
      </text>
      <text x={4} y={padT + 8} style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>
        {Math.round(maxPct)}%
      </text>
      {data.map((b, i) => {
        const pct = (b.rns / b.stlyRn) * 100;
        const bh = (pct / maxPct) * innerH;
        const x = padL + i * barW + 1.5;
        const y = padT + innerH - bh;
        const fill = pct >= 100 ? 'var(--moss)' : pct >= 70 ? 'var(--brass)' : 'var(--st-bad)';
        return (
          <g key={b.key}>
            <rect x={x} y={y} width={Math.max(2, barW - 3)} height={bh} fill={fill}>
              <title>{`${formatLabel(b.key)} · OTB ${b.rns} vs STLY ${b.stlyRn} = ${pct.toFixed(0)}%`}</title>
            </rect>
            <text
              x={x + (barW - 3) / 2}
              y={y - 2}
              textAnchor="middle"
              style={{ fontFamily: 'var(--mono)', fontSize: 8, fill: 'var(--ink)' }}
            >
              {pct.toFixed(0)}%
            </text>
            <text
              x={x + (barW - 3) / 2}
              y={h - 8}
              textAnchor="middle"
              style={{ fontFamily: 'var(--mono)', fontSize: 8, fill: 'var(--ink-mute)' }}
            >
              {formatLabel(b.key)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
