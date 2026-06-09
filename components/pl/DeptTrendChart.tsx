'use client';

// components/pl/DeptTrendChart.tsx
//
// Restored 2026-05-05 — monthly revenue + GOP% trend chart for Operations sub-pages
// (F&B, Spa, Activities). Reads DeptPlRow[] from lib/data.getDeptPl(). Bars =
// revenue components (food/bev for F&B, single bar elsewhere) + COGS, line =
// GOP %. Always-visible above the P&L grid.
// PBS 2026-06-09 #150 — add optional breakfast-alloc series for F&B, stacked
// on top of food + bev so the chart shows revenue *as USALI would post it* if
// the monthly breakfast JE were applied.

import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import type { DeptPlRow } from '@/lib/data';

const C = {
  grid:      'var(--line-soft)',
  axis:      '#7d7565',
  food:      '#a8854a', // brass
  bev:       '#6b9379', // moss-glow
  breakfast: '#5a7da3', // slate blue — breakfast fair-value reclass (high contrast vs brass food + moss bev)
  rev:       '#a8854a',
  cogs:      '#8e3a35', // bad
  payroll:   '#c4a06b', // brass-soft
  gop:       '#1c4d3a', // moss
  bg:        '#fbf9f2',
  border:    'var(--line-soft)',
  label:     '#1c1815',
};

export default function DeptTrendChart({
  rows, dept, height = 240, breakfastByPeriod,
}: {
  rows: DeptPlRow[];
  dept: 'fnb' | 'spa' | 'activities' | 'retail';
  height?: number;
  breakfastByPeriod?: Record<string, number>;
}) {
  // Sort ascending by period for left-to-right trend
  const series = [...rows]
    .sort((a, b) => a.period.localeCompare(b.period))
    .map(r => {
      const food = Number(r.food_revenue || 0);
      const bev  = Number(r.bev_revenue || 0);
      const breakfast = Number(breakfastByPeriod?.[r.period] || 0);
      const cogs = Number(r.cogs || 0) || (Number(r.food_cost || 0) + Number(r.bev_cost || 0) + Number(r.spa_cost || 0));
      return {
        m: monthLabel(r.period),
        food, bev, breakfast,
        rev: Number(r.revenue || 0),
        cogs,
        payroll: Number(r.payroll || 0),
        gop_pct: Number(r.gop_pct || 0),
        // PBS 2026-06-09 #168 — trendlines on top of bars
        total_rev_line: dept === 'fnb' ? (food + bev + breakfast) : Number(r.revenue || 0),
        cogs_line: cogs,
      };
    })
    .filter(d => d.rev > 0 || d.cogs > 0 || d.payroll > 0 || d.breakfast > 0);

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
          <Tooltip content={(props: any) => {
            if (!props.active || !props.payload?.length) return null;
            const p = props.payload as Array<{ dataKey: string; value: number; color: string; name: string }>;
            const get = (k: string) => p.find(x => x.dataKey === k)?.value ?? 0;
            const food = get('food'); const bev = get('bev'); const bkf = get('breakfast');
            const cogs = get('cogs'); const payroll = get('payroll'); const gop = get('gop_pct');
            const totalRev = food + bev + bkf || get('rev');
            const Row = ({ label, val, color, pct }: { label: string; val: string; color?: string; pct?: boolean }) => (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '2px 0', fontSize: 11 }}>
                <span style={{ color: color ?? '#5A5A5A' }}>{label}</span>
                <span style={{ color: '#000', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{val}</span>
              </div>
            );
            return (
              <div style={{ background: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 4, padding: '8px 10px', minWidth: 180 }}>
                <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 12 }}>{props.label}</div>
                <div style={{ color: '#5A5A5A', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 4 }}>Revenue</div>
                {food > 0 && <Row label="Food" val={fmtUsd(food)} color={C.food} />}
                {bev > 0 && <Row label="Beverage" val={fmtUsd(bev)} color={C.bev} />}
                {bkf > 0 && <Row label="Breakfast alloc" val={fmtUsd(bkf)} color={C.breakfast} />}
                <Row label="Total" val={fmtUsd(totalRev)} />
                <div style={{ color: '#5A5A5A', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 6 }}>Cost</div>
                {cogs > 0 && <Row label="COGS" val={fmtUsd(cogs)} color={C.cogs} />}
                {payroll > 0 && <Row label="Payroll" val={fmtUsd(payroll)} color={C.payroll} />}
                <div style={{ color: '#5A5A5A', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 6 }}>Margin</div>
                <Row label="GOP %" val={`${Number(gop).toFixed(1)}%`} color={C.gop} pct />
              </div>
            );
          }} />
          <Legend wrapperStyle={{ fontSize: 11, color: C.axis }} />
          {dept === 'fnb' ? (
            <>
              <Bar yAxisId="usd" dataKey="food"      stackId="rev" fill={C.food}      name="Food rev" />
              <Bar yAxisId="usd" dataKey="bev"       stackId="rev" fill={C.bev}       name="Bev rev" />
              <Bar yAxisId="usd" dataKey="breakfast" stackId="rev" fill={C.breakfast} name="Breakfast alloc" />
            </>
          ) : (
            <Bar yAxisId="usd" dataKey="rev" fill={C.rev} name="Revenue" />
          )}
          <Bar yAxisId="usd" dataKey="cogs"    stackId="cost" fill={C.cogs}    name="COGS" />
          <Bar yAxisId="usd" dataKey="payroll" stackId="cost" fill={C.payroll} name="Payroll" />
          {/* PBS #168 — total revenue + COGS trendlines on the USD axis */}
          <Line yAxisId="usd" type="monotone" dataKey="total_rev_line" stroke="#000" strokeWidth={2}
                dot={{ r: 3, fill: "#000" }} activeDot={{ r: 5 }} name="Total revenue" />
          <Line yAxisId="usd" type="monotone" dataKey="cogs_line" stroke={C.cogs} strokeWidth={2} strokeDasharray="4 3"
                dot={{ r: 3, fill: C.cogs }} activeDot={{ r: 5 }} name="COGS trend" />
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
  if (k === 'breakfast') return 'Breakfast alloc';
  if (k === 'rev') return 'Revenue';
  if (k === 'cogs') return 'COGS';
  if (k === 'payroll') return 'Payroll';
  return k;
}
