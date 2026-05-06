'use client';

// components/pl/DeptTrendChart.tsx
//
// Restored 2026-05-05 — monthly revenue + GOP% trend chart for Operations sub-pages
// (F&B, Spa, Activities). Reads DeptPlRow[] from lib/data.getDeptPl(). Bars =
// revenue components (food/bev for F&B, single bar elsewhere) + COGS, line =
// GOP %. Always-visible above the P&L grid.

import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import type { DeptPlRow } from '@/lib/data';

const C = {
  grid:    '#d8cca8',
  axis:    '#7d7565',
  food:    '#a8854a', // brass
  bev:     '#6b9379', // moss-glow
  rev:     '#a8854a',
  cogs:    '#8e3a35', // bad
  payroll: '#c4a06b', // brass-soft
  gop:     '#1c4d3a', // moss
  bg:      '#fbf9f2',
  border:  '#d8cca8',
  label:   '#1c1815',
};

export default function DeptTrendChart({
  rows, dept, height = 240,
}: {
  rows: DeptPlRow[];
  dept: 'fnb' | 'spa' | 'activities' | 'retail';
  height?: number;
}) {
  // Sort ascending by period for left-to-right trend
  const series = [...rows]
    .sort((a, b) => a.period.localeCompare(b.period))
    .map(r => ({
      m: monthLabel(r.period),
      food: Number(r.food_revenue || 0),
      bev:  Number(r.bev_revenue || 0),
      rev:  Number(r.revenue || 0),
      cogs: Number(r.cogs || 0) || (Number(r.food_cost || 0) + Number(r.bev_cost || 0) + Number(r.spa_cost || 0)),
      payroll: Number(r.payroll || 0),
      gop_pct: Number(r.gop_pct || 0),
    }))
    .filter(d => d.rev > 0 || d.cogs > 0 || d.payroll > 0);

  if (series.length === 0) {
    return (
      <div style={{ padding: 20, color: '#8a8170', fontStyle: 'italic', fontSize: 13 }}>
        No P&amp;L data in window.
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <ComposedChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={C.grid} strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="m" tick={{ fill: C.axis, fontSize: 11 }} />
          <YAxis yAxisId="usd" tick={{ fill: C.axis, fontSize: 11 }} tickFormatter={fmtUsdShort} />
          <YAxis yAxisId="pct" orientation="right" tick={{ fill: C.gop, fontSize: 11 }}
                 tickFormatter={(v: number) => `${Math.round(v)}%`} domain={[-50, 100]} />
          <Tooltip
            contentStyle={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.label, fontSize: 12 }}
            formatter={(v: any, k: any) => k === 'gop_pct' ? [`${Number(v).toFixed(1)}%`, 'GOP %']
              : [fmtUsd(Number(v)), labelOf(k)]}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: C.axis }} />
          {dept === 'fnb' ? (
            <>
              <Bar yAxisId="usd" dataKey="food" stackId="rev" fill={C.food} name="Food rev" />
              <Bar yAxisId="usd" dataKey="bev"  stackId="rev" fill={C.bev}  name="Bev rev" />
            </>
          ) : (
            <Bar yAxisId="usd" dataKey="rev" fill={C.rev} name="Revenue" />
          )}
          <Bar yAxisId="usd" dataKey="cogs"    stackId="cost" fill={C.cogs}    name="COGS" />
          <Bar yAxisId="usd" dataKey="payroll" stackId="cost" fill={C.payroll} name="Payroll" />
          <Line yAxisId="pct" type="monotone" dataKey="gop_pct" stroke={C.gop} strokeWidth={2}
                dot={{ r: 3, fill: C.gop }} activeDot={{ r: 5 }} name="GOP %" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function monthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number);
  if (!y || !m) return yyyymm;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}
function fmtUsdShort(v: number): string {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(0)}k`;
  return `$${Math.round(v)}`;
}
function fmtUsd(v: number): string {
  return `$${Math.round(v).toLocaleString()}`;
}
function labelOf(k: string): string {
  if (k === 'food') return 'Food rev';
  if (k === 'bev') return 'Bev rev';
  if (k === 'rev') return 'Revenue';
  if (k === 'cogs') return 'COGS';
  if (k === 'payroll') return 'Payroll';
  return k;
}
