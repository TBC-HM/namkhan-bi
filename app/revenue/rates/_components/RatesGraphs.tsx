// 3 SVG charts for /revenue/rates:
//   1. BAR per room type (avg + min-max range bars)
//   2. Restriction breakdown (CTA / CTD / stop-sell / min-stay counts)
//   3. Rate distribution histogram

import { fmtMoney } from '@/lib/format';

interface RoomTypeRow {
  name: string;
  rates: number[];
  min: number;
  max: number;
}
interface RestrictionRow {
  cta: number;
  ctd: number;
  stop: number;
  minStay: number;
  open: number;
}

interface Props {
  byType: RoomTypeRow[];
  allRates: number[];
  restrictions: RestrictionRow;
}

const CARD: React.CSSProperties = {
  background: 'var(--paper-warm)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 8,
  padding: '14px 16px',
  minHeight: 220,
};
const TITLE: React.CSSProperties = { fontSize: 'var(--t-md)', fontWeight: 600, color: 'var(--ink)', marginBottom: 2 };
const SUB: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-loose)', color: 'var(--ink-mute)',
  textTransform: 'uppercase', marginBottom: 10,
};

export default function RatesGraphs({ byType, allRates, restrictions }: Props) {
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
        <div style={TITLE}>BAR by room type</div>
        <div style={SUB}>Min / Avg / Max · per room type · USD</div>
        <RangeChart rows={byType} />
      </div>
      <div style={CARD}>
        <div style={TITLE}>Restrictions in window</div>
        <div style={SUB}>CTA · CTD · stop-sell · min-stay counts</div>
        <RestrictionsChart r={restrictions} />
      </div>
      <div style={CARD}>
        <div style={TITLE}>Rate distribution</div>
        <div style={SUB}>How rates spread across the window</div>
        <DistributionChart rates={allRates} />
      </div>
    </div>
  );
}

function RangeChart({ rows }: { rows: RoomTypeRow[] }) {
  const data = rows.filter((r) => r.rates.length > 0);
  if (data.length === 0) return <Empty />;
  const sorted = [...data].sort((a, b) => {
    const avgA = a.rates.reduce((s, n) => s + n, 0) / a.rates.length;
    const avgB = b.rates.reduce((s, n) => s + n, 0) / b.rates.length;
    return avgB - avgA;
  });
  const w = 320;
  const lineH = 22;
  const h = Math.max(180, sorted.length * lineH + 20);
  const labelW = 120;
  const valW = 56;
  const barMaxW = w - labelW - valW - 8;
  const allMin = Math.min(...sorted.map((r) => r.min));
  const allMax = Math.max(...sorted.map((r) => r.max));
  const range = Math.max(1, allMax - allMin);
  const xAt = (v: number) => labelW + ((v - allMin) / range) * barMaxW;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h }}>
      {sorted.map((r, i) => {
        const y = 6 + i * lineH;
        const avg = r.rates.reduce((s, n) => s + n, 0) / r.rates.length;
        return (
          <g key={r.name}>
            <text x={labelW - 4} y={y + 14} textAnchor="end" style={lbl}>
              {r.name.slice(0, 18)}
            </text>
            <line x1={xAt(r.min)} x2={xAt(r.max)} y1={y + 11} y2={y + 11} stroke="var(--paper-deep)" strokeWidth={6}>
              <title>{`${r.name} · range ${fmtMoney(r.min, 'USD')} – ${fmtMoney(r.max, 'USD')} · ${r.rates.length} obs · v_rates_room_type`}</title>
            </line>
            <line x1={xAt(r.min)} x2={xAt(r.max)} y1={y + 11} y2={y + 11} stroke="var(--brass-soft)" strokeWidth={4}>
              <title>{`${r.name} · ${fmtMoney(r.min, 'USD')} – ${fmtMoney(r.max, 'USD')} · avg ${fmtMoney(avg, 'USD')} · v_rates_room_type`}</title>
            </line>
            <circle cx={xAt(avg)} cy={y + 11} r={4} fill="var(--moss)">
              <title>{`${r.name} · avg ${fmtMoney(avg, 'USD')} · min ${fmtMoney(r.min, 'USD')} · max ${fmtMoney(r.max, 'USD')} · v_rates_room_type`}</title>
            </circle>
            <text x={w - 4} y={y + 14} textAnchor="end" style={val}>
              {fmtMoney(avg, 'USD')}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function RestrictionsChart({ r }: { r: RestrictionRow }) {
  const total = r.cta + r.ctd + r.stop + r.minStay + r.open;
  if (total === 0) return <Empty />;
  const w = 320;
  const h = 200;
  const lineH = 28;
  const padL = 8;
  const padR = 64;
  const barMaxW = w - padL - padR;

  const items = [
    { label: 'Open',     count: r.open,    color: 'var(--moss)' },
    { label: 'Min-stay', count: r.minStay, color: 'var(--brass)' },
    { label: 'CTA',      count: r.cta,     color: 'var(--brass-soft)' },
    { label: 'CTD',      count: r.ctd,     color: 'var(--brass-soft)' },
    { label: 'Stop-sell', count: r.stop,   color: 'var(--st-bad)' },
  ];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h }}>
      {items.map((it, i) => {
        const y = 6 + i * (lineH + 4);
        const wPx = total > 0 ? (it.count / total) * barMaxW : 0;
        return (
          <g key={it.label}>
            <rect x={padL} y={y} width={barMaxW} height={lineH} fill="var(--paper-deep)" />
            <rect x={padL} y={y} width={wPx} height={lineH} fill={it.color}>
              <title>{`${it.label} · ${it.count} of ${total} day-plans · ${total > 0 ? ((it.count / total) * 100).toFixed(0) : 0}% · v_rates_restrictions`}</title>
            </rect>
            <text x={padL + 6} y={y + lineH / 2 + 4} style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--paper-warm)', fontWeight: 600 }}>
              {it.label}
            </text>
            <text x={w - padR + 4} y={y + lineH / 2 + 4} style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--ink)', fontWeight: 600 }}>
              {it.count}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function DistributionChart({ rates }: { rates: number[] }) {
  if (rates.length === 0) return <Empty />;
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  if (max === min) return <Empty />;
  const bins = 12;
  const step = (max - min) / bins;
  const buckets = new Array(bins).fill(0);
  for (const r of rates) {
    const idx = Math.min(bins - 1, Math.floor((r - min) / step));
    buckets[idx]++;
  }
  const w = 320, h = 180, padL = 8, padR = 4, padT = 16, padB = 26;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const maxCount = Math.max(1, ...buckets);
  const barW = innerW / bins;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h }}>
      {buckets.map((c, i) => {
        const bh = (c / maxCount) * innerH;
        const x = padL + i * barW + 1;
        const y = padT + innerH - bh;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={Math.max(1, barW - 2)}
            height={bh}
            fill="var(--moss)"
          >
            <title>{`${fmtMoney(min + i * step, 'USD')} – ${fmtMoney(min + (i + 1) * step, 'USD')} · ${c} of ${rates.length} obs · ${((c / rates.length) * 100).toFixed(0)}% · v_rates_distribution`}</title>
          </rect>
        );
      })}
      <text x={padL} y={h - 8} style={axisTxt}>{fmtMoney(min, 'USD')}</text>
      <text x={w - padR - 36} y={h - 8} style={axisTxt}>{fmtMoney(max, 'USD')}</text>
      <text x={padL} y={padT - 4} style={axisTxt}>{rates.length} obs · max {maxCount}/bin</text>
    </svg>
  );
}

function Empty() {
  return (
    <div style={{
      height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: 'var(--t-sm)',
    }}>
      No data
    </div>
  );
}

const lbl: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--ink)' };
const val: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--ink-soft)' };
const axisTxt: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 9,
  fill: 'var(--ink-mute)',
};
