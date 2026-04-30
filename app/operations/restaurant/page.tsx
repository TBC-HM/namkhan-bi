// app/departments/roots/page.tsx
// Departments · Roots (F&B).

import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';
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
      <PanelHero
        eyebrow="Roots · F&B · 30d"
        title="Roots"
        emphasis="restaurant"
        sub="Food · beverage · capture · per-occupied-roomnight"
        kpis={
          <>
            <KpiCard label="F&B Total" value={a30?.fnb_revenue ?? 0} kind="money" />
            <KpiCard label="Food" value={a30?.fnb_food_revenue ?? 0} kind="money" />
            <KpiCard label="Beverage" value={a30?.fnb_beverage_revenue ?? 0} kind="money" />
            <KpiCard
              label="F&B / Occ Rn"
              value={Number(cap?.fnb_per_occ_room ?? 0)}
              kind="money"
              tone="pos"
            />
          </>
        }
      />

      <div className="card-grid-4">
        <KpiCard
          label="F&B Capture %"
          value={Number(cap?.fnb_capture_pct ?? 0)}
          kind="pct"
        />
        <KpiCard label="Minibar Rev" value={a30?.fnb_minibar_revenue ?? 0} kind="money" />
        <KpiCard label="Avg Cover" value={null} greyed hint="POS schedule pending" />
        <KpiCard label="Cover Count" value={null} greyed hint="POS schedule pending" />
      </div>

      <Card title="Top sellers" emphasis="30d" sub={`${sellers.length} items · ranked by revenue`} source="mv_classified_transactions">
        {sellers.length === 0 ? (
          <div style={{ padding: 24, color: 'var(--ink-mute)', fontStyle: 'italic' }}>No F&B transactions in window.</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Item</th>
                <th className="num">Sold</th>
                <th className="num">Revenue</th>
                <th className="num">Avg Ticket</th>
              </tr>
            </thead>
            <tbody>
              {sellers.map((s) => (
                <tr key={s.name}>
                  <td className="lbl"><strong>{s.name}</strong></td>
                  <td className="num">{s.count}</td>
                  <td className="num">{fmtMoney(s.revenue, 'USD')}</td>
                  <td className="num text-mute">{fmtMoney(s.revenue / s.count, 'USD')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="card-grid-2" style={{ marginTop: 22 }}>
        <Card title="Outlet split" sub="Single outlet today; split needs POS extension" source="grey">
          <div className="stub" style={{ padding: 32 }}>
            <h3>Coming soon</h3>
            <p>Roots is currently a single outlet. Multi-outlet split arrives when POS exposes the outlet field.</p>
          </div>
        </Card>
        <Card title="Average cover" sub="Cover count not tracked in PMS" source="grey">
          <div className="stub" style={{ padding: 32 }}>
            <h3>Coming soon</h3>
            <p>Approximation via guests/day possible; awaiting confirmed cover field from POS.</p>
          </div>
        </Card>
      </div>
    </>
  );
}
