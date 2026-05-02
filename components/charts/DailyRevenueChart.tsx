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
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={series}>
        <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" stroke="#7a7670" fontSize={10} tickFormatter={(d) => d?.slice(5)} />
        <YAxis stroke="#7a7670" fontSize={10} tickFormatter={(v) => fmtMoney(v, 'USD')} />
        <Tooltip
          contentStyle={{ background: '#161616', border: '1px solid #2a2a2a', fontSize: 12 }}
          labelStyle={{ color: '#bfa980' }}
          formatter={(v: any) => fmtMoney(Number(v), 'USD')}
        />
        <Area type="monotone" dataKey="rooms" stackId="1" stroke="#bfa980" fill="rgba(191,169,128,0.45)" name="Rooms" />
        <Area type="monotone" dataKey="fnb" stackId="1" stroke="#7a9b6a" fill="rgba(122,155,106,0.4)" name="F&B" />
        <Area type="monotone" dataKey="spa" stackId="1" stroke="#9a8866" fill="rgba(154,136,102,0.35)" name="Spa" />
        <Area type="monotone" dataKey="activity" stackId="1" stroke="#d4a96a" fill="rgba(212,169,106,0.3)" name="Activity" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
