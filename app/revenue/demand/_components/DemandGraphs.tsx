// 3 charts for /revenue/demand:
//   1. OTB vs STLY by month (paired bars)
//   2. Δ % vs STLY (over/under bars colour-coded)
//   3. ADR by month (OTB-derived line)

import { fmtMoney } from '@/lib/format';

interface PaceRow {
  ci_month: string;
  otb_roomnights: number;
  stly_roomnights: number;
  roomnights_delta: number;
  otb_revenue: number;
  stly_revenue: number;
  revenue_delta: number;
}

interface Props {
  rows: PaceRow[];
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

export default function DemandGraphs({ rows }: Props) {
  const data = [...rows].sort((a, b) => a.ci_month.localeCompare(b.ci_month));
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
        <div style={TITLE}>OTB vs STLY · by month</div>
        <div style={SUB}>Roomnights captured vs same time last year</div>
        <PairedBars rows={data} />
      </div>
      <div style={CARD}>
        <div style={TITLE}>Δ % vs STLY</div>
        <div style={SUB}>Pace lead/lag per month</div>
        <DeltaBars rows={data} />
      </div>
      <div style={CARD}>
        <div style={TITLE}>OTB ADR · by month</div>
        <div style={SUB}>Revenue ÷ roomnights · OTB</div>
        <AdrLine rows={data} />
      </div>
    </div>
  );
}

function PairedBars({ rows }: { rows: PaceRow[] }) {
  if (rows.length === 0) return <Empty />;
  const w = 320, h = 180, padL = 24, padR = 4, padT = 12, padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const max = Math.max(1, ...rows.flatMap((r) => [r.otb_roomnights, r.stly_roomnights]));
  const groupW = innerW / rows.length;
  const barW = (groupW - 4) / 2;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 180 }}>
      <text x={4} y={padT + 6} style={axis}>{max}</text>
      <text x={4} y={padT + innerH} style={axis}>0</text>
      {rows.map((r, i) => {
        const otbH = (r.otb_roomnights / max) * innerH;
        const stlyH = (r.stly_roomnights / max) * innerH;
        const x = padL + i * groupW + 2;
        const y0 = padT + innerH;
        return (
          <g key={r.ci_month}>
            <rect x={x} y={y0 - otbH} width={barW} height={otbH} fill="var(--moss)">
              <title>{`${r.ci_month.slice(0, 7)} · OTB ${r.otb_roomnights} RN`}</title>
            </rect>
            <rect x={x + barW + 2} y={y0 - stlyH} width={barW} height={stlyH} fill="var(--ink-mute)" opacity={0.55}>
              <title>{`${r.ci_month.slice(0, 7)} · STLY ${r.stly_roomnights} RN`}</title>
            </rect>
            <text x={x + groupW / 2 - 2} y={h - 14} textAnchor="middle" style={axis}>
              {r.ci_month.slice(2, 7)}
            </text>
          </g>
        );
      })}
      <g transform={`translate(${padL}, ${h - 4})`} style={{ fontFamily: 'var(--mono)', fontSize: 8 }}>
        <rect x={0} y={-5} width={9} height={4} fill="var(--moss)" />
        <text x={12} y={-2} style={{ fill: 'var(--ink)' }}>OTB</text>
        <rect x={42} y={-5} width={9} height={4} fill="var(--ink-mute)" opacity={0.55} />
        <text x={54} y={-2} style={{ fill: 'var(--ink-mute)' }}>STLY</text>
      </g>
    </svg>
  );
}

function DeltaBars({ rows }: { rows: PaceRow[] }) {
  if (rows.length === 0) return <Empty />;
  const w = 320, h = 180, padL = 24, padR = 4, padT = 12, padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const pcts = rows.map((r) => r.stly_roomnights > 0 ? (r.roomnights_delta / r.stly_roomnights) * 100 : 0);
  const maxAbs = Math.max(10, ...pcts.map((p) => Math.abs(p)));
  const groupW = innerW / rows.length;
  const barW = groupW - 4;
  const zeroY = padT + innerH / 2;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 180 }}>
      <line x1={padL} x2={w - padR} y1={zeroY} y2={zeroY} stroke="var(--ink-faint)" />
      <text x={4} y={padT + 6} style={axis}>+{Math.round(maxAbs)}%</text>
      <text x={4} y={padT + innerH - 2} style={axis}>−{Math.round(maxAbs)}%</text>
      {rows.map((r, i) => {
        const pct = pcts[i];
        const half = (Math.abs(pct) / maxAbs) * (innerH / 2);
        const x = padL + i * groupW + 2;
        const y = pct >= 0 ? zeroY - half : zeroY;
        const fill = pct >= 0 ? 'var(--moss)' : 'var(--st-bad)';
        return (
          <g key={r.ci_month}>
            <rect x={x} y={y} width={barW} height={half} fill={fill}>
              <title>{`${r.ci_month.slice(0, 7)} · ${pct >= 0 ? '+' : ''}${pct.toFixed(0)}% vs STLY`}</title>
            </rect>
            <text x={x + barW / 2} y={h - 14} textAnchor="middle" style={axis}>
              {r.ci_month.slice(2, 7)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function AdrLine({ rows }: { rows: PaceRow[] }) {
  const data = rows.map((r) => ({
    month: r.ci_month,
    adr: r.otb_roomnights > 0 ? r.otb_revenue / r.otb_roomnights : 0,
  })).filter((r) => r.adr > 0);
  if (data.length === 0) return <Empty />;
  const w = 320, h = 180, padL = 32, padR = 4, padT = 16, padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const min = Math.min(...data.map((d) => d.adr));
  const max = Math.max(...data.map((d) => d.adr));
  const range = Math.max(1, max - min);
  const xAt = (i: number) => padL + (i / Math.max(1, data.length - 1)) * innerW;
  const yAt = (v: number) => padT + innerH - ((v - min) / range) * innerH;

  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(d.adr).toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 180 }}>
      <text x={4} y={padT + 6} style={axis}>{fmtMoney(max, 'USD')}</text>
      <text x={4} y={padT + innerH} style={axis}>{fmtMoney(min, 'USD')}</text>
      <path d={path} fill="none" stroke="var(--moss)" strokeWidth={2} />
      {data.map((d, i) => (
        <circle key={d.month} cx={xAt(i)} cy={yAt(d.adr)} r={3} fill="var(--moss)">
          <title>{`${d.month.slice(0, 7)} · ADR ${fmtMoney(d.adr, 'USD')}`}</title>
        </circle>
      ))}
      {data.map((d, i) => (
        i % Math.max(1, Math.floor(data.length / 6)) === 0 ? (
          <text key={`${d.month}-x`} x={xAt(i)} y={h - 12} textAnchor="middle" style={axis}>
            {d.month.slice(2, 7)}
          </text>
        ) : null
      ))}
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

const axis: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 9,
  fill: 'var(--ink-mute)',
};
