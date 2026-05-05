// 3-graph row at the top of /revenue/compset, mirroring the staff page pattern.
// Pure SVG, no chart library. All data from existing views.

import type { CalendarRow, DowRow, PromoTileRow } from './graphsTypes';

interface Props {
  calendar: CalendarRow[];
  dow: DowRow[];
  tiles: PromoTileRow[];
}

const CARD: React.CSSProperties = {
  background: 'var(--paper-warm)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 8,
  padding: '14px 16px',
};

const TITLE: React.CSSProperties = {
  fontSize: 'var(--t-md)', fontWeight: 600, color: 'var(--ink)', marginBottom: 2,
};
const SUB: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-loose)', color: 'var(--ink-mute)',
  textTransform: 'uppercase', marginBottom: 10,
};

export default function CompsetGraphs({ calendar, dow, tiles }: Props) {
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
        <div style={TITLE}>Rate trend · Namkhan vs comp median</div>
        <div style={SUB}>Last 60 days of stay-date rates</div>
        <RateTrendChart calendar={calendar} />
      </div>
      <div style={CARD}>
        <div style={TITLE}>Positioning by day of week</div>
        <div style={SUB}>Avg Namkhan rate vs comp median</div>
        <DowChart dow={dow} />
      </div>
      <div style={CARD}>
        <div style={TITLE}>Promo intensity · comp set</div>
        <div style={SUB}>% of plans with active promo per hotel</div>
        <PromoIntensityChart tiles={tiles} />
      </div>
    </div>
  );
}

// ---------- Chart 1: rate trend (line over stay_date) ----------
function RateTrendChart({ calendar }: { calendar: CalendarRow[] }) {
  const rows = calendar
    .filter((r) => r.namkhan_usd != null || r.median_usd != null)
    .sort((a, b) => a.stay_date.localeCompare(b.stay_date))
    .slice(-30);
  if (rows.length === 0) return <Empty />;

  const w = 320, h = 140, pad = 28;
  const innerW = w - pad - 12;
  const innerH = h - pad - 12;
  const all: number[] = [];
  rows.forEach((r) => {
    if (r.namkhan_usd != null) all.push(Number(r.namkhan_usd));
    if (r.median_usd != null) all.push(Number(r.median_usd));
  });
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = Math.max(1, max - min);

  const xAt = (i: number) => pad + (i / Math.max(1, rows.length - 1)) * innerW;
  const yAt = (v: number) => 12 + innerH - ((v - min) / range) * innerH;

  const path = (key: 'namkhan_usd' | 'median_usd') => {
    const pts: string[] = [];
    rows.forEach((r, i) => {
      const v = r[key];
      if (v == null) return;
      pts.push(`${pts.length === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(Number(v)).toFixed(1)}`);
    });
    return pts.join(' ');
  };

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 140 }}>
      <text x={4} y={20} style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>${max.toFixed(0)}</text>
      <text x={4} y={h - 8} style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>${min.toFixed(0)}</text>
      <path d={path('median_usd')} fill="none" stroke="var(--ink-mute)" strokeWidth={1.5} strokeDasharray="4 3" />
      <path d={path('namkhan_usd')} fill="none" stroke="var(--moss)" strokeWidth={2} />
      {rows.map((r, i) =>
        r.namkhan_usd != null ? (
          <circle key={i} cx={xAt(i)} cy={yAt(Number(r.namkhan_usd))} r={2.5} fill="var(--moss)" />
        ) : null,
      )}
      <text x={pad} y={h - 2} style={{ fontFamily: 'var(--mono)', fontSize: 8, fill: 'var(--ink-faint)' }}>{rows[0].stay_date}</text>
      <text x={w - 60} y={h - 2} style={{ fontFamily: 'var(--mono)', fontSize: 8, fill: 'var(--ink-faint)' }}>{rows[rows.length - 1].stay_date}</text>
      <g transform={`translate(${pad}, ${h - 22})`} style={{ fontFamily: 'var(--mono)', fontSize: 8 }}>
        <rect x={0} y={-5} width={9} height={2} fill="var(--moss)" />
        <text x={12} y={0} style={{ fill: 'var(--ink)' }}>Namkhan</text>
        <rect x={66} y={-5} width={9} height={2} fill="var(--ink-mute)" />
        <text x={78} y={0} style={{ fill: 'var(--ink-mute)' }}>Comp median</text>
      </g>
    </svg>
  );
}

// ---------- Chart 2: day of week bars ----------
function DowChart({ dow }: { dow: DowRow[] }) {
  const rows = dow.filter((r) => r.avg_namkhan_usd != null || r.avg_comp_median_usd != null);
  if (rows.length === 0) return <Empty />;
  const w = 320, h = 140, pad = 24;
  const innerW = w - pad - 8;
  const innerH = h - pad - 12;
  const all = rows.flatMap((r) => [Number(r.avg_namkhan_usd ?? 0), Number(r.avg_comp_median_usd ?? 0)]);
  const max = Math.max(...all, 1);
  const groupW = innerW / 7;
  const barW = (groupW - 4) / 2;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 140 }}>
      <text x={4} y={20} style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>${max.toFixed(0)}</text>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => {
        const r = rows.find((x) => x.dow === i + 1);
        const x = pad + i * groupW + 2;
        const n = r?.avg_namkhan_usd != null ? Number(r.avg_namkhan_usd) : 0;
        const m = r?.avg_comp_median_usd != null ? Number(r.avg_comp_median_usd) : 0;
        const nh = (n / max) * innerH;
        const mh = (m / max) * innerH;
        const baseY = 12 + innerH;
        const dowLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
        return (
          <g key={i}>
            <rect x={x} y={baseY - nh} width={barW} height={nh} fill="var(--moss)" />
            <rect x={x + barW + 2} y={baseY - mh} width={barW} height={mh} fill="var(--ink-mute)" opacity={0.6} />
            <text x={x + groupW / 2 - 2} y={h - 4} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 8, fill: 'var(--ink-mute)' }}>{dowLabels[i]}</text>
            {n > 0 && <text x={x + barW / 2} y={baseY - nh - 2} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 7, fill: 'var(--ink)' }}>${Math.round(n)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// ---------- Chart 3: promo intensity per comp ----------
function PromoIntensityChart({ tiles }: { tiles: PromoTileRow[] }) {
  const rows = tiles.filter((t) => t.promo_frequency_pct != null);
  if (rows.length === 0) return <Empty />;
  rows.sort((a, b) => Number(b.promo_frequency_pct ?? 0) - Number(a.promo_frequency_pct ?? 0));
  const w = 320, h = Math.max(140, rows.length * 14 + 8);
  const pad = 4;
  const labelW = 110;
  const barMaxW = w - labelW - pad - 35;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h }}>
      {rows.map((r, i) => {
        const pct = Number(r.promo_frequency_pct ?? 0);
        const barW = (pct / 100) * barMaxW;
        const y = 4 + i * 14;
        const fill = pct >= 50 ? 'var(--st-bad)' : pct >= 20 ? 'var(--brass)' : pct > 0 ? 'var(--moss)' : 'var(--ink-mute)';
        const name = r.is_self ? `★ ${r.property_name}` : r.property_name;
        return (
          <g key={r.comp_id}>
            <text x={labelW - 4} y={y + 9} textAnchor="end" style={{
              fontFamily: 'var(--mono)', fontSize: 9, fill: r.is_self ? 'var(--brass)' : 'var(--ink)',
              fontWeight: r.is_self ? 600 : 400,
            }}>{name.slice(0, 22)}</text>
            <rect x={labelW} y={y + 2} width={barMaxW} height={9} fill="var(--paper-deep)" />
            <rect x={labelW} y={y + 2} width={barW} height={9} fill={fill} />
            <text x={labelW + barMaxW + 4} y={y + 9} style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink)' }}>{pct.toFixed(0)}%</text>
          </g>
        );
      })}
    </svg>
  );
}

function Empty() {
  return (
    <div style={{
      height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--ink-faint)', fontStyle: 'italic',
    }}>
      No data yet
    </div>
  );
}
