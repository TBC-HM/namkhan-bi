import { Section } from '@/components/sections/Section';
import { Kpi } from '@/components/kpi/Kpi';
import { DailyRevenueChart } from '@/components/charts/DailyRevenueChart';
import { getKpiDaily, aggregateDaily, getKpiDailyCompare } from '@/lib/data';
import { resolvePeriod } from '@/lib/period';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function PulsePage({ searchParams }: Props) {
  const period = resolvePeriod(searchParams);

  const dailyPeriod = await getKpiDaily(period).catch(() => []);
  const aggPeriod = aggregateDaily(dailyPeriod);

  // Compare data when user picked vs STLY / Prior Period
  const dailyCompare = await getKpiDailyCompare(period).catch(() => null);
  const aggCompare = dailyCompare ? aggregateDaily(dailyCompare) : null;

  // Stable 90d chart context regardless of period selection
  const chartTo = new Date();
  const chartFrom = new Date(chartTo.getTime() - 90 * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const d90 = await getKpiDaily(fmt(chartFrom), fmt(chartTo)).catch(() => []);

  const dlabel = `${period.days}d`;

  // Helper for delta rendering
  const delta = (cur: number, prev: number | undefined): string | undefined => {
    if (prev == null || prev === 0) return undefined;
    const d = ((cur - prev) / prev) * 100;
    const sign = d >= 0 ? '+' : '';
    return `${sign}${d.toFixed(1)}% vs ${period.cmp === 'stly' ? 'STLY' : 'PP'}`;
  };

  return (
    <>
      <Section title="Pulse" tag={period.label}>
        <div className="grid grid-cols-4 gap-3 mb-3">
          <Kpi label={`Occupancy ${dlabel}`} value={aggPeriod?.occupancy_pct ?? 0} kind="pct"
               hint={delta(aggPeriod?.occupancy_pct ?? 0, aggCompare?.occupancy_pct)} />
          <Kpi label={`ADR ${dlabel}`} value={aggPeriod?.adr ?? 0} kind="money"
               hint={delta(aggPeriod?.adr ?? 0, aggCompare?.adr)} />
          <Kpi label={`RevPAR ${dlabel}`} value={aggPeriod?.revpar ?? 0} kind="money"
               hint={delta(aggPeriod?.revpar ?? 0, aggCompare?.revpar)} />
          <Kpi label={`TRevPAR ${dlabel}`} value={aggPeriod?.trevpar ?? 0} kind="money"
               hint={delta(aggPeriod?.trevpar ?? 0, aggCompare?.trevpar)} />
        </div>
        <div className="grid grid-cols-4 gap-3">
          <Kpi label={`Total Rev ${dlabel}`}
               value={(aggPeriod?.rooms_revenue ?? 0) + (aggPeriod?.total_ancillary_revenue ?? 0)}
               kind="money" />
          <Kpi label={`Rooms Rev ${dlabel}`} value={aggPeriod?.rooms_revenue ?? 0} kind="money" />
          <Kpi label={`Ancillary Rev ${dlabel}`} value={aggPeriod?.total_ancillary_revenue ?? 0} kind="money" />
          <Kpi label="Pace vs Forecast" value={null} greyed hint="Forecast pending" />
        </div>
        <div className="text-muted text-xs mt-3 tabular">
          Active filter: <strong>{period.label}</strong> · {period.rangeLabel}
          {aggCompare && ` · compare ${period.compareFrom} → ${period.compareTo}`}
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
