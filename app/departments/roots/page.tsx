import { Section } from '@/components/sections/Section';
import { Kpi } from '@/components/kpi/Kpi';
import { getCaptureRates, getKpiDaily, defaultDailyRange, aggregateDaily } from '@/lib/data';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { fmtMoney } from '@/lib/format';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export default async function RootsPage() {
  const r30 = defaultDailyRange(30);
  const d30 = await getKpiDaily(r30.from, r30.to).catch(() => []);
  const a30 = aggregateDaily(d30);
  const cap = await getCaptureRates().catch(() => null);

  // Top 10 F&B sellers
  const { data: topSellers } = await supabase
    .from('mv_classified_transactions')
    .select('description, amount')
    .eq('property_id', PROPERTY_ID)
    .eq('usali_dept', 'F&B')
    .gte('transaction_date', r30.from)
    .lte('transaction_date', r30.to);

  const sellerMap: Record<string, { count: number; revenue: number }> = {};
  (topSellers ?? []).forEach((t: any) => {
    const k = t.description || 'Unknown item';
    if (!sellerMap[k]) sellerMap[k] = { count: 0, revenue: 0 };
    sellerMap[k].count += 1;
    sellerMap[k].revenue += Number(t.amount || 0);
  });
  const sellers = Object.entries(sellerMap)
    .map(([name, x]) => ({ name, ...x }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 12);

  return (
    <>
      <Section title="Roots · F&B" tag="Last 30 days">
        <div className="grid grid-cols-5 gap-3">
          <Kpi label="F&B Total" value={a30?.fnb_revenue ?? 0} kind="money" />
          <Kpi label="Food" value={a30?.fnb_food_revenue ?? 0} kind="money" />
          <Kpi label="Beverage" value={a30?.fnb_beverage_revenue ?? 0} kind="money" />
          <Kpi label="F&B / Occ Rn" value={Number(cap?.fnb_per_occ_room ?? 0)} kind="money" />
          <Kpi label="F&B Capture %" value={Number(cap?.fnb_capture_pct ?? 0)} kind="pct" />
        </div>
      </Section>

      <Section title="Top Sellers · 30 days" tag={`${sellers.length} items`}>
        <table>
          <thead>
            <tr><th>Item</th><th className="text-right">Sold</th><th className="text-right">Revenue</th></tr>
          </thead>
          <tbody>
            {sellers.map(s => (
              <tr key={s.name}>
                <td>{s.name}</td>
                <td className="text-right tabular">{s.count}</td>
                <td className="text-right tabular">{fmtMoney(s.revenue, 'USD')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <div className="grid grid-cols-2 gap-6">
        <Section title="Outlet Split" greyed greyedReason="Single outlet today; split needs POS extension">
          <div className="text-muted text-sm">Roots is currently a single outlet. Multi-outlet split arrives when POS exposes outlet field.</div>
        </Section>
        <Section title="Avg Cover" greyed greyedReason="Cover count not tracked in PMS">
          <div className="text-muted text-sm">Approximation via guests/day possible; awaiting confirmed cover field.</div>
        </Section>
      </div>
    </>
  );
}
