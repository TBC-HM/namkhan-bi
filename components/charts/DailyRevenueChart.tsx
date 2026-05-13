'use client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';
import { fmtMoney } from '@/lib/format';

// Pinned to USD: mv_kpi_daily has only USD-storage revenue columns
// (rooms_revenue, fnb_revenue, spa_revenue, activity_revenue) and no
// paired *_lak. Per Cowork audit 2026-05-03 currency rule, we cannot
// synthesize LAK by FX multiplication, so the chart renders USD until
// a schema migration adds paired LAK columns to mv_kpi_daily (BLOCKED:
// migration out of scope for this audit).
export function DailyRevenueChart({ data }: { data: any[] }) {
  const series = data.map(r => ({
    date: r.night_date,
    rooms: Number(r.rooms_revenue || 0),
    fnb: Number(r.fnb_revenue || 0),
    spa: Number(r.spa_revenue || 0),
    activity: Number(r.activity_revenue || 0),
    occ: Number(r.occupancy_pct || 0)
  }));
  // Color values are the resolved brand palette hex (recharts can't read CSS vars).
  // Source: styles/globals.css :root.
  const c = {
    grid:     'var(--line-soft)',  // --line-soft
    axis:     '#7d7565',  // --ink-mute
    bg:       '#1c1815',  // --ink
    border:   '#4a443c',  // --ink-soft
    label:    '#c4a06b',  // --brass-soft
    rooms:    '#a8854a',  // --brass
    fnb:      '#6b9379',  // --moss-glow
    spa:      '#8a9d83',  // --sage
    activity: 'var(--brass-soft)',  // --brass-pale
  };
  const fmtDate = (d: string) => {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" stroke={c.axis} fontSize={10} tickFormatter={(d) => d?.slice(5)} />
        <YAxis stroke={c.axis} fontSize={10} tickFormatter={(v) => fmtMoney(v, 'USD')} />
        <Tooltip
          cursor={{ stroke: c.label, strokeWidth: 1, strokeDasharray: '2 2' }}
          contentStyle={{
            background: c.bg, border: `1px solid ${c.border}`,
            fontSize: "var(--t-sm)", fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            color: 'var(--paper-warm)', borderRadius: 4, padding: '8px 12px',
          }}
          labelStyle={{ color: c.label, marginBottom: 4, fontWeight: 600 }}
          labelFormatter={(d: string) => `${fmtDate(d)} · USD · cloudbeds`}
          formatter={(v: any, name: string) => [fmtMoney(Number(v), 'USD'), name]}
        />
        <Area type="monotone" dataKey="rooms"    stackId="1" stroke={c.rooms}    fill={c.rooms}    fillOpacity={0.45} name="Rooms" />
        <Area type="monotone" dataKey="fnb"      stackId="1" stroke={c.fnb}      fill={c.fnb}      fillOpacity={0.4}  name="F&B" />
        <Area type="monotone" dataKey="spa"      stackId="1" stroke={c.spa}      fill={c.spa}      fillOpacity={0.35} name="Spa" />
        <Area type="monotone" dataKey="activity" stackId="1" stroke={c.activity} fill={c.activity} fillOpacity={0.3}  name="Activity" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
