// app/revenue/rateplans/page.tsx
// Revenue · Rate Plans — 90d performance ranked by revenue.

import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { fmtMoney } from '@/lib/format';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export default async function RatePlansPage() {
  const { data: plans } = await supabase
    .from('rate_plans')
    .select('rate_id, rate_name, rate_type, is_active')
    .eq('property_id', PROPERTY_ID)
    .order('rate_name');

  const { data: usage } = await supabase
    .from('reservations')
    .select('rate_plan, total_amount, nights, status')
    .eq('property_id', PROPERTY_ID)
    .gte('check_in_date', new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10));

  const usageMap: Record<string, { bookings: number; revenue: number; nights: number }> = {};
  (usage ?? []).forEach((r: any) => {
    if (!r.rate_plan || r.status === 'canceled') return;
    if (!usageMap[r.rate_plan]) usageMap[r.rate_plan] = { bookings: 0, revenue: 0, nights: 0 };
    usageMap[r.rate_plan].bookings += 1;
    usageMap[r.rate_plan].revenue += Number(r.total_amount || 0);
    usageMap[r.rate_plan].nights += Number(r.nights || 0);
  });

  const ranked = Object.entries(usageMap)
    .map(([name, u]) => ({ name, ...u, adr: u.nights ? u.revenue / u.nights : 0 }))
    .sort((a, b) => b.revenue - a.revenue);

  const totalRev = ranked.reduce((s, r) => s + r.revenue, 0);
  const totalBookings = ranked.reduce((s, r) => s + r.bookings, 0);
  const activePlans = (plans ?? []).filter((p: any) => p.is_active).length;

  return (
    <>
      <PanelHero
        eyebrow="Rate plans · 90d"
        title="Rate plan"
        emphasis="performance"
        sub="By revenue · ADR · roomnight contribution"
        kpis={
          <>
            <KpiCard label="Configured Plans" value={plans?.length ?? 0} />
            <KpiCard label="Active Plans" value={activePlans} />
            <KpiCard label="Bookings 90d" value={totalBookings} />
            <KpiCard label="Revenue 90d" value={totalRev} kind="money" />
          </>
        }
      />

      <Card title="Plans" emphasis="ranked" sub="90 day performance · sorted by revenue" source="reservations">
        {ranked.length === 0 ? (
          <div style={{ padding: 24, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
            No rate plan usage in last 90 days.
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Rate Plan</th>
                <th className="num">Bookings</th>
                <th className="num">Roomnights</th>
                <th className="num">Revenue</th>
                <th className="num">ADR</th>
                <th className="num">% Mix</th>
              </tr>
            </thead>
            <tbody>
              {ranked.slice(0, 30).map((r) => (
                <tr key={r.name}>
                  <td className="lbl"><strong>{r.name}</strong></td>
                  <td className="num">{r.bookings}</td>
                  <td className="num">{r.nights}</td>
                  <td className="num">{fmtMoney(r.revenue, 'USD')}</td>
                  <td className="num">${r.adr.toFixed(0)}</td>
                  <td className="num text-mute">{totalRev ? `${((r.revenue / totalRev) * 100).toFixed(0)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
