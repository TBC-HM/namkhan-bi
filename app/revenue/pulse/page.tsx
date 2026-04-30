// app/revenue/pulse/page.tsx
// Revenue · Pulse — period-aware perf KPIs + 90d chart.
// Layout: layout.tsx already provides Banner / SubNav / FilterStrip. We render hero + grid + chart only.

import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';
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

  const dailyCompare = await getKpiDailyCompare(period).catch(() => null);
  const aggCompare = dailyCompare ? aggregateDaily(dailyCompare) : null;

  const chartTo = new Date();
  const chartFrom = new Date(chartTo.getTime() - 90 * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const d90 = await getKpiDaily(fmt(chartFrom), fmt(chartTo)).catch(() => []);

  const dlabel = `${period.days}d`;

  // Delta helper
  const delta = (cur: number, prev: number | undefined): { text?: string; tone?: 'pos' | 'neg' } => {
    if (prev == null || prev === 0) return {};
    const d = ((cur - prev) / prev) * 100;
    const sign = d >= 0 ? '+' : '';
    const lbl = period.cmp === 'stly' ? 'STLY' : 'PP';
    return {
      text: `${sign}${d.toFixed(1)}% vs ${lbl}`,
      tone: d >= 0 ? 'pos' : 'neg',
    };
  };

  const occD = delta(aggPeriod?.occupancy_pct ?? 0, aggCompare?.occupancy_pct);
  const adrD = delta(aggPeriod?.adr ?? 0, aggCompare?.adr);
  const rpD = delta(aggPeriod?.revpar ?? 0, aggCompare?.revpar);
  const trpD = delta(aggPeriod?.trevpar ?? 0, aggCompare?.trevpar);

  const totalRev = (aggPeriod?.rooms_revenue ?? 0) + (aggPeriod?.total_ancillary_revenue ?? 0);

  return (
    <>
      <PanelHero
        eyebrow={`Pulse · ${period.label}`}
        title="Revenue"
        emphasis="performance"
        sub={`${period.rangeLabel}${aggCompare ? ` · compare ${period.compareFrom} → ${period.compareTo}` : ''}`}
        kpis={
          <>
            <KpiCard
              label={`Occupancy ${dlabel}`}
              value={aggPeriod?.occupancy_pct ?? 0}
              kind="pct"
              delta={occD.text}
              deltaTone={occD.tone}
            />
            <KpiCard
              label={`ADR ${dlabel}`}
              value={aggPeriod?.adr ?? 0}
              kind="money"
              delta={adrD.text}
              deltaTone={adrD.tone}
            />
            <KpiCard
              label={`RevPAR ${dlabel}`}
              value={aggPeriod?.revpar ?? 0}
              kind="money"
              delta={rpD.text}
              deltaTone={rpD.tone}
            />
            <KpiCard
              label={`TRevPAR ${dlabel}`}
              value={aggPeriod?.trevpar ?? 0}
              kind="money"
              delta={trpD.text}
              deltaTone={trpD.tone}
            />
          </>
        }
      />

      <div className="card-grid-4">
        <KpiCard label={`Total Rev ${dlabel}`} value={totalRev} kind="money" />
        <KpiCard label={`Rooms Rev ${dlabel}`} value={aggPeriod?.rooms_revenue ?? 0} kind="money" />
        <KpiCard label={`Ancillary Rev ${dlabel}`} value={aggPeriod?.total_ancillary_revenue ?? 0} kind="money" />
        <KpiCard label="Pace vs Forecast" value={null} greyed hint="Forecast pending" />
      </div>

      <Card title="Daily Revenue" emphasis="last 90d" sub="Stacked: Rooms · F&B · Spa · Activity" source="mv_kpi_daily">
        {d90.length > 0 ? (
          <DailyRevenueChart data={d90} />
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-mute)' }}>No data.</div>
        )}
      </Card>
    </>
  );
}
