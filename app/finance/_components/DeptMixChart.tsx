// app/finance/_components/DeptMixChart.tsx
// Departmental revenue mix — wired from gl.v_usali_dept_summary for the
// active period. No fabricated departments.

import { fmtMoney } from '@/lib/format';

export interface DeptRow {
  usali_department: string;
  revenue: number | null;
  departmental_profit: number | null;
}

interface Props {
  rows: DeptRow[];
  title?: string;
  sub?: string;
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

export default function DeptMixChart({
  rows,
  title = 'Department mix',
  sub = 'Revenue + dept profit · current closed month',
}: Props) {
  const data = rows
    .map((r) => ({
      dept: r.usali_department || 'Unknown',
      rev: Number(r.revenue ?? 0),
      profit: Number(r.departmental_profit ?? 0),
    }))
    .filter((r) => r.rev > 0)
    .sort((a, b) => b.rev - a.rev)
    .slice(0, 8);

  return (
    <div style={CARD}>
      <div style={TITLE}>{title}</div>
      <div style={SUB}>{sub}</div>
      {data.length === 0 ? (
        <div
          style={{
            height: 180,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--ink-faint)',
            fontStyle: 'italic',
            fontSize: 'var(--t-sm)',
          }}
        >
          No closed-month department revenue yet.
        </div>
      ) : (
        <Chart rows={data} />
      )}
    </div>
  );
}

function Chart({ rows }: { rows: { dept: string; rev: number; profit: number }[] }) {
  const total = rows.reduce((s, r) => s + r.rev, 0);
  const w = 320;
  const lineH = 22;
  const h = Math.max(180, rows.length * lineH + 12);
  const labelW = 110;
  const valueW = 70;
  const barMaxW = w - labelW - valueW - 8;
  const max = Math.max(...rows.map((r) => r.rev), 1);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h }}>
      {rows.map((r, i) => {
        const y = 6 + i * lineH;
        const barW = (r.rev / max) * barMaxW;
        const pct = total > 0 ? (r.rev / total) * 100 : 0;
        return (
          <g key={r.dept}>
            <text x={labelW - 4} y={y + 14} textAnchor="end" style={lbl}>
              {r.dept.slice(0, 16)}
            </text>
            <rect x={labelW} y={y + 4} width={barMaxW} height={14} fill="var(--paper-deep)" />
            <rect x={labelW} y={y + 4} width={barW} height={14} fill="var(--moss)">
              <title>{`${r.dept} · rev ${fmtMoney(r.rev, 'USD')} · profit ${fmtMoney(r.profit, 'USD')} · ${pct.toFixed(0)}%`}</title>
            </rect>
            <text x={labelW + barMaxW + 4} y={y + 14} style={val}>
              {fmtMoney(r.rev, 'USD')} · {pct.toFixed(0)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const lbl: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--ink)' };
const val: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--ink-soft)' };
