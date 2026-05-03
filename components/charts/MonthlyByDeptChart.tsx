'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { fmtMoney } from '@/lib/format';

// Pinned to USD per Cowork audit 2026-05-03 currency rule.
// `mv_revenue_by_usali_dept.revenue` is stored USD-only — no paired *_lak — so
// we don't synthesize LAK via hardcoded FX. To enable LAK, add `revenue_lak`
// to the source matview first.
export function MonthlyByDeptChart({ rows }: { rows: any[] }) {
  const grouped: Record<string, any> = {};
  rows.forEach(r => {
    const m = r.month;
    if (!grouped[m]) grouped[m] = { month: m, Rooms: 0, 'F&B': 0, 'Other Operated': 0, Retail: 0 };
    const dept = r.usali_dept;
    grouped[m][dept] = (grouped[m][dept] || 0) + Number(r.revenue || 0);
  });
  const series = Object.values(grouped).sort((a: any, b: any) => a.month.localeCompare(b.month));
  // Brand-palette resolved hex (recharts can't read CSS vars).
  const c = {
    grid:   '#d8cca8', // --line-soft
    axis:   '#7d7565', // --ink-mute
    bg:     '#1c1815', // --ink
    border: '#4a443c', // --ink-soft
    label:  '#c4a06b', // --brass-soft
    rooms:  '#a8854a', // --brass
    fnb:    '#6b9379', // --moss-glow
    other:  '#d9bf8e', // --brass-pale
    retail: '#8e3a35', // --st-bad
  };
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="month" stroke={c.axis} fontSize={10} tickFormatter={(m) => m?.slice(0, 7)} />
        <YAxis stroke={c.axis} fontSize={10} tickFormatter={(v) => fmtMoney(v, 'USD')} />
        <Tooltip
          cursor={{ fill: 'rgba(196, 160, 107, 0.08)' }}
          contentStyle={{
            background: c.bg, border: `1px solid ${c.border}`,
            fontSize: 11.5, fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            color: '#f4ecd8', borderRadius: 4, padding: '8px 12px',
          }}
          labelStyle={{ color: c.label, marginBottom: 4, fontWeight: 600 }}
          labelFormatter={(m: string) => `${m?.slice(0, 7)} · USD · USALI`}
          formatter={(v: any, name: string) => [fmtMoney(Number(v), 'USD'), name]}
        />
        <Legend wrapperStyle={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }} />
        <Bar dataKey="Rooms"          stackId="a" fill={c.rooms} />
        <Bar dataKey="F&B"            stackId="a" fill={c.fnb} />
        <Bar dataKey="Other Operated" stackId="a" fill={c.other} />
        <Bar dataKey="Retail"         stackId="a" fill={c.retail} />
      </BarChart>
    </ResponsiveContainer>
  );
}
