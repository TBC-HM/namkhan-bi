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

// paceCurveSvg was reverted from svgCharts.ts during multi-session race —
// inline a minimal SVG fallback locally so the page still ships.
import type { PaceCurveRow } from '@/lib/pulseData';

function paceCurveSvg(rows: PaceCurveRow[]): string {
  if (!rows.length) return '';
  const w = 600, h = 220, padL = 40, padR = 12, padT = 16, padB = 28;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const all: number[] = [];
  for (const r of rows) {
    if (r.rooms_actual != null) all.push(Number(r.rooms_actual));
    if (r.rooms_otb != null) all.push(Number(r.rooms_otb));
    if (r.rooms_stly_daily_avg != null) all.push(Number(r.rooms_stly_daily_avg));
    if (r.rooms_budget_daily_avg != null) all.push(Number(r.rooms_budget_daily_avg));
  }
  const max = Math.max(1, ...all);
  const xStep = innerW / Math.max(1, rows.length - 1);
  const xy = (i: number, v: number) => `${(padL + i * xStep).toFixed(1)},${(padT + innerH - (v / max) * innerH).toFixed(1)}`;
  const series = (key: 'rooms_actual' | 'rooms_otb' | 'rooms_stly_daily_avg' | 'rooms_budget_daily_avg') => {
    const pts: string[] = [];
    rows.forEach((r, i) => { const v = (r as any)[key]; if (v != null) pts.push(`${pts.length === 0 ? 'M' : 'L'}${xy(i, Number(v))}`); });
    return pts.join(' ');
  };
  // Build per-point invisible hit-circles carrying full tooltip text.
  const pointCircles = rows
    .map((r, i) => {
      const cx = (padL + i * xStep).toFixed(1);
      const date = r.day ?? (r as any).stay_date ?? (r as any).date ?? `i=${i}`;
      const pieces: string[] = [String(date)];
      if (r.rooms_actual != null) pieces.push(`actual ${Math.round(Number(r.rooms_actual))}`);
      if (r.rooms_otb != null) pieces.push(`OTB ${Math.round(Number(r.rooms_otb))}`);
      if (r.rooms_stly_daily_avg != null) pieces.push(`STLY ${Math.round(Number(r.rooms_stly_daily_avg))}`);
      if (r.rooms_budget_daily_avg != null) pieces.push(`budget ${Math.round(Number(r.rooms_budget_daily_avg))}`);
      pieces.push('v_pace_curve');
      const txt = pieces.join(' · ').replace(/&/g, '&amp;').replace(/</g, '&lt;');
      // Stack 4 invisible circles at the four series y-values for that day.
      const ys: string[] = [];
      const pushY = (v: number | null | undefined) => {
        if (v == null) return;
        ys.push((padT + innerH - (Number(v) / max) * innerH).toFixed(1));
      };
      pushY(r.rooms_actual);
      pushY(r.rooms_otb);
      pushY(r.rooms_stly_daily_avg);
      pushY(r.rooms_budget_daily_avg);
      return ys.map((cy) => `<circle cx="${cx}" cy="${cy}" r="6" fill="transparent"><title>${txt}</title></circle>`).join('');
    })
    .join('');
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:200px">
    <path d="${series('rooms_actual')}" fill="none" stroke="#1a2e21" stroke-width="2"><title>Pace · actual occupied · ${rows.length} days · v_pace_curve</title></path>
    <path d="${series('rooms_otb')}" fill="none" stroke="#a8854a" stroke-width="1.5"><title>Pace · OTB · ${rows.length} days · v_pace_curve</title></path>
    <path d="${series('rooms_stly_daily_avg')}" fill="none" stroke="#999" stroke-width="1" stroke-dasharray="3 2"><title>Pace · STLY daily avg · ${rows.length} days · v_pace_curve</title></path>
    <path d="${series('rooms_budget_daily_avg')}" fill="none" stroke="#3B5BFF" stroke-width="1" stroke-dasharray="3 2"><title>Pace · budget daily avg · ${rows.length} days · v_pace_curve</title></path>
    ${pointCircles}
    <text x="${padL}" y="${padT + 8}" font-size="9" fill="#7d7565">${max}</text>
    <text x="${padL}" y="${h - 6}" font-size="9" fill="#7d7565">0</text>
  </svg>`;
}

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
              <title>{`${formatLabel(b.key)} · ${b.rns} RN · ${occ.toFixed(0)}% occ · $${Math.round(b.rev).toLocaleString()} rev · ${b.cxl} cxl · v_otb_pace`}</title>
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
              <title>{`${formatLabel(b.key)} · OTB ${b.rns} vs STLY ${b.stlyRn} = ${pct.toFixed(0)}% · v_otb_pace`}</title>
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
