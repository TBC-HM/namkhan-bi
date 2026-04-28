'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useCcy } from '@/components/ui/CurrencyToggle';
import { fmtMoney, FX_LAK_PER_USD } from '@/lib/format';

export function MonthlyByDeptChart({ rows }: { rows: any[] }) {
  const { ccy } = useCcy();
  const conv = ccy === 'USD' ? 1 : FX_LAK_PER_USD;
  const grouped: Record<string, any> = {};
  rows.forEach(r => {
    const m = r.month;
    if (!grouped[m]) grouped[m] = { month: m, Rooms: 0, 'F&B': 0, 'Other Operated': 0, Retail: 0 };
    const dept = r.usali_dept;
    grouped[m][dept] = (grouped[m][dept] || 0) + Number(r.revenue || 0) * conv;
  });
  const series = Object.values(grouped).sort((a: any, b: any) => a.month.localeCompare(b.month));
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={series}>
        <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="month" stroke="#7a7670" fontSize={10} tickFormatter={(m) => m?.slice(0, 7)} />
        <YAxis stroke="#7a7670" fontSize={10} tickFormatter={(v) => fmtMoney(v / conv, ccy)} />
        <Tooltip contentStyle={{ background: '#161616', border: '1px solid #2a2a2a', fontSize: 12 }}
                 formatter={(v: any) => fmtMoney(Number(v) / conv, ccy)} />
        <Legend wrapperStyle={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }} />
        <Bar dataKey="Rooms" stackId="a" fill="#bfa980" />
        <Bar dataKey="F&B" stackId="a" fill="#7a9b6a" />
        <Bar dataKey="Other Operated" stackId="a" fill="#d4a96a" />
        <Bar dataKey="Retail" stackId="a" fill="#c25450" />
      </BarChart>
    </ResponsiveContainer>
  );
}
