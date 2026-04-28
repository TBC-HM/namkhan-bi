import { Section } from '@/components/sections/Section';
import { Kpi } from '@/components/kpi/Kpi';
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
      map[k].count += 1; map[k].revenue += Number(t.amount || 0);
    });
    return Object.entries(map).map(([name, x]) => ({ name, ...x }))
      .sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  };

  const topSpa = top(spaItems);
  const topAct = top(actItems);

  return (
    <>
      <Section title="Spa & Activities" tag="Last 30 days">
        <div className="grid grid-cols-4 gap-3">
          <Kpi label="Spa Revenue" value={a30?.spa_revenue ?? 0} kind="money" />
          <Kpi label="Activity Revenue" value={a30?.activity_revenue ?? 0} kind="money" />
          <Kpi label="Spa Capture %" value={Number(cap?.spa_capture_pct ?? 0)} kind="pct" />
          <Kpi label="Activity Capture %" value={Number(cap?.activity_capture_pct ?? 0)} kind="pct" />
        </div>
      </Section>

      <div className="grid grid-cols-2 gap-6">
        <Section title="Top Spa Treatments · 30d">
          {topSpa.length === 0
            ? <div className="text-muted text-sm py-4 text-center">No spa transactions in window.</div>
            : (
            <table><thead><tr><th>Treatment</th><th className="text-right">Sold</th><th className="text-right">Revenue</th></tr></thead>
              <tbody>{topSpa.map(s => (<tr key={s.name}><td>{s.name}</td><td className="text-right tabular">{s.count}</td><td className="text-right tabular">{fmtMoney(s.revenue, 'USD')}</td></tr>))}</tbody>
            </table>
          )}
        </Section>
        <Section title="Top Activities · 30d">
          {topAct.length === 0
            ? <div className="text-muted text-sm py-4 text-center">No activity transactions in window.</div>
            : (
            <table><thead><tr><th>Activity</th><th className="text-right">Sold</th><th className="text-right">Revenue</th></tr></thead>
              <tbody>{topAct.map(s => (<tr key={s.name}><td>{s.name}</td><td className="text-right tabular">{s.count}</td><td className="text-right tabular">{fmtMoney(s.revenue, 'USD')}</td></tr>))}</tbody>
            </table>
          )}
        </Section>
      </div>

      <Section title="Wellness Packages · Therapist Utilization" greyed greyedReason="Spa scheduler is external; package endpoint not yet synced">
        <div className="text-muted text-sm">Therapist load · package attach rate · slot utilization. Pending external scheduler integration.</div>
      </Section>
    </>
  );
}
