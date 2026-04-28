import { Section } from '@/components/sections/Section';
import { Kpi } from '@/components/kpi/Kpi';
import { DailyRevenueChart } from '@/components/charts/DailyRevenueChart';
import { getKpiDaily, defaultDailyRange, aggregateDaily } from '@/lib/data';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export default async function PulsePage() {
  const r30 = defaultDailyRange(30);
  const r90 = defaultDailyRange(90);
  const d30 = await getKpiDaily(r30.from, r30.to).catch(() => []);
  const d90 = await getKpiDaily(r90.from, r90.to).catch(() => []);
  const a30 = aggregateDaily(d30);
  const a90 = aggregateDaily(d90);

  return (
    <>
      <Section title="Pulse" tag="Last 30 / 90 days">
        <div className="grid grid-cols-4 gap-3 mb-3">
          <Kpi label="Occupancy 30d" value={a30?.occupancy_pct ?? 0} kind="pct" />
          <Kpi label="ADR 30d" value={a30?.adr ?? 0} kind="money" />
          <Kpi label="RevPAR 30d" value={a30?.revpar ?? 0} kind="money" />
          <Kpi label="TRevPAR 30d" value={a30?.trevpar ?? 0} kind="money" />
        </div>
        <div className="grid grid-cols-4 gap-3">
          <Kpi label="Total Rev 30d" value={(a30?.rooms_revenue ?? 0) + (a30?.total_ancillary_revenue ?? 0)} kind="money" />
          <Kpi label="Rooms Rev 30d" value={a30?.rooms_revenue ?? 0} kind="money" />
          <Kpi label="Ancillary Rev 30d" value={a30?.total_ancillary_revenue ?? 0} kind="money" />
          <Kpi label="Pace vs Forecast" value={null} greyed hint="Forecast pending" />
        </div>
      </Section>

      <Section title="Daily Revenue · Last 90d" tag="Stacked: Rooms · F&B · Spa · Activity">
        {d90.length > 0
          ? <DailyRevenueChart data={d90} />
          : <div className="text-muted text-sm py-12 text-center">No data.</div>}
      </Section>
    </>
  );
}
