// app/departments/spa-activities/page.tsx
// Departments · Spa & Activities.

import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';
import { getCaptureRates, getKpiDaily, defaultDailyRange, aggregateDaily } from '@/lib/data';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { fmtMoney } from '@/lib/format';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export default async function SpaActivitiesPage() {
  const r30 = defaultDailyRange(30);
  const d30 = await getKpiDaily(r30.from, r30.to).catch(() => []);
  const a30 = aggregateDaily(d30);
  const cap = await getCaptureRates().catch(() => null);

  const { data: spaItems } = await supabase
    .from('mv_classified_transactions')
    .select('description, amount')
    .eq('property_id', PROPERTY_ID)
    .eq('usali_dept', 'Other Operated')
    .eq('usali_subdept', 'Spa')
    .gte('transaction_date', r30.from)
    .lte('transaction_date', r30.to);

  const { data: actItems } = await supabase
    .from('mv_classified_transactions')
    .select('description, amount')
    .eq('property_id', PROPERTY_ID)
    .eq('usali_dept', 'Other Operated')
    .eq('usali_subdept', 'Activities')
    .gte('transaction_date', r30.from)
    .lte('transaction_date', r30.to);

  const top = (rows: any[] | null) => {
    const map: Record<string, { count: number; revenue: number }> = {};
    (rows ?? []).forEach((t: any) => {
      const k = t.description || 'Unknown';
      if (!map[k]) map[k] = { count: 0, revenue: 0 };
      map[k].count += 1;
      map[k].revenue += Number(t.amount || 0);
    });
    return Object.entries(map)
      .map(([name, x]) => ({ name, ...x }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  };

  const topSpa = top(spaItems);
  const topAct = top(actItems);

  return (
    <>
      <PanelHero
        eyebrow="Spa & Activities · 30d"
        title="Wellness"
        emphasis="& experiences"
        sub="Treatments · activities · capture rates"
        kpis={
          <>
            <KpiCard label="Spa Revenue" value={a30?.spa_revenue ?? 0} kind="money" />
            <KpiCard label="Activity Revenue" value={a30?.activity_revenue ?? 0} kind="money" />
            <KpiCard
              label="Spa / Occ Rn"
              value={Number(cap?.spa_per_occ_room ?? 0)}
              kind="money"
            />
            <KpiCard
              label="Activity / Occ Rn"
              value={Number(cap?.activity_per_occ_room ?? 0)}
              kind="money"
            />
          </>
        }
      />

      <div className="card-grid-2">
        <KpiCard label="Spa Capture %" value={Number(cap?.spa_capture_pct ?? 0)} kind="pct" />
        <KpiCard label="Activity Capture %" value={Number(cap?.activity_capture_pct ?? 0)} kind="pct" />
      </div>

      <div className="card-grid-2" style={{ marginTop: 22 }}>
        <Card title="Top spa treatments" emphasis="30d" sub={`${topSpa.length} treatments`} source="mv_classified_transactions">
          {topSpa.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
              No spa transactions in window.
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Treatment</th>
                  <th className="num">Sold</th>
                  <th className="num">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topSpa.map((s) => (
                  <tr key={s.name}>
                    <td className="lbl"><strong>{s.name}</strong></td>
                    <td className="num">{s.count}</td>
                    <td className="num">{fmtMoney(s.revenue, 'USD')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Top activities" emphasis="30d" sub={`${topAct.length} activities`} source="mv_classified_transactions">
          {topAct.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
              No activity transactions in window.
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Activity</th>
                  <th className="num">Sold</th>
                  <th className="num">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topAct.map((s) => (
                  <tr key={s.name}>
                    <td className="lbl"><strong>{s.name}</strong></td>
                    <td className="num">{s.count}</td>
                    <td className="num">{fmtMoney(s.revenue, 'USD')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Card
        title="Wellness packages · therapist util"
        sub="Spa scheduler is external; package endpoint not yet synced"
        source="grey"
        className="mt-22"
      >
        <div className="stub" style={{ padding: 32 }}>
          <h3>Coming soon</h3>
          <p>Therapist load · package attach rate · slot utilization. Pending external scheduler integration.</p>
        </div>
      </Card>
    </>
  );
}
