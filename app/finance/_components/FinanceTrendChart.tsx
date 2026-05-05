// app/finance/_components/FinanceTrendChart.tsx
// Reusable revenue / GOP / net-earnings monthly trend chart for the Finance
// snapshot. All data wired from gl.pl_section_monthly — no synthetic series.

import { fmtMoney } from '@/lib/format';

export interface MonthSeriesPoint {
  period: string;       // yyyy-mm
  income: number;       // gross income
  net: number | null;   // net_earnings (may be null when month not closed)
  gop: number | null;   // optional GOP overlay
}

interface Props {
  rows: MonthSeriesPoint[];
  title: string;
  sub: string;
}

const CARD: React.CSSProperties = {
  background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)',
  borderRadius: 8, padding: '14px 16px', minHeight: 220,
};
const TITLE: React.CSSProperties = { fontSize: 'var(--t-md)', fontWeight: 600, color: 'var(--ink)', marginBottom: 2 };
const SUB: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-loose)', color: 'var(--ink-mute)',
  textTransform: 'uppercase', marginBottom: 10,
};

export default function FinanceTrendChart({ rows, title, sub }: Props) {
  return (
    <div style={CARD}>
      <div style={TITLE}>{title}</div>
      <div style={SUB}>{sub}</div>
      <Chart rows={rows} />
    </div>
  );
}

function Chart({ rows }: { rows: MonthSeriesPoint[] }) {
  const data = rows.filter((r) => r.income > 0 || (r.net != null && r.net !== 0));
  if (data.length === 0) {
    return (
      <div style={{
        height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: 'var(--t-sm)',
      }}>
        No closed months yet
      </div>
    );
  }
  const w = 520, h = 220, padL = 50, padR = 12, padT = 16, padB = 30;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const allVals = data.flatMap((r) => [r.income, r.net ?? 0, r.gop ?? 0]);
  const min = Math.min(0, ...allVals);
  const max = Math.max(...allVals, 1);
  const range = Math.max(1, max - min);
  const groupW = innerW / data.length;
  const barW = groupW * 0.55;
  const yAt = (v: number) => padT + innerH - ((v - min) / range) * innerH;

  // Net earnings line path (skip nulls).
  const netSegs: string[][] = [];
  let cur: string[] = [];
  data.forEach((r, i) => {
    if (r.net == null) {
      if (cur.length) { netSegs.push(cur); cur = []; }
      return;
    }
    const x = padL + i * groupW + groupW / 2;
    cur.push(`${cur.length === 0 ? 'M' : 'L'}${x.toFixed(1)},${yAt(r.net).toFixed(1)}`);
  });
  if (cur.length) netSegs.push(cur);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 220 }}>
      {/* Y axis */}
      <text x={4} y={padT + 6} style={axis}>{fmtMoney(max, 'USD')}</text>
      <text x={4} y={padT + innerH} style={axis}>{fmtMoney(min, 'USD')}</text>
      {/* Zero line if range straddles 0 */}
      {min < 0 && (
        <line x1={padL} x2={w - padR} y1={yAt(0)} y2={yAt(0)} stroke="var(--paper-deep)" />
      )}
      {/* Income bars */}
      {data.map((r, i) => {
        const x = padL + i * groupW + (groupW - barW) / 2;
        const y = yAt(r.income);
        const bh = yAt(0) - y;
        return (
          <rect key={r.period} x={x} y={y} width={barW} height={bh} fill="var(--moss)">
            <title>{`${r.period} · income ${fmtMoney(r.income, 'USD')}${r.net != null ? ` · net ${fmtMoney(r.net, 'USD')}` : ''}${r.gop != null ? ` · GOP ${fmtMoney(r.gop, 'USD')}` : ''}`}</title>
          </rect>
        );
      })}
      {/* Net line */}
      {netSegs.map((seg, i) => (
        <path key={`net-${i}`} d={seg.join(' ')} fill="none" stroke="var(--brass)" strokeWidth={2} />
      ))}
      {data.map((r, i) =>
        r.net != null ? (
          <circle
            key={`net-dot-${r.period}`}
            cx={padL + i * groupW + groupW / 2}
            cy={yAt(r.net)}
            r={3}
            fill="var(--brass)"
          />
        ) : null,
      )}
      {/* X axis labels — every other to avoid crowding */}
      {data.map((r, i) =>
        i % Math.max(1, Math.floor(data.length / 8)) === 0 ? (
          <text
            key={`x-${r.period}`}
            x={padL + i * groupW + groupW / 2}
            y={h - 12}
            textAnchor="middle"
            style={axis}
          >
            {r.period.slice(2)}
          </text>
        ) : null,
      )}
      <g transform={`translate(${padL}, ${padT - 4})`} style={{ fontFamily: 'var(--mono)', fontSize: 9 }}>
        <rect x={0} y={-6} width={9} height={4} fill="var(--moss)" />
        <text x={12} y={-2} style={{ fill: 'var(--ink)' }}>Income</text>
        <line x1={56} y1={-4} x2={68} y2={-4} stroke="var(--brass)" strokeWidth={2} />
        <text x={72} y={-2} style={{ fill: 'var(--brass)' }}>Net earnings</text>
      </g>
    </svg>
  );
}

const axis: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 9,
  fill: 'var(--ink-mute)',
};
