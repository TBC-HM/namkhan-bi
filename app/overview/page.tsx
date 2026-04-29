import { Section } from '@/components/sections/Section';
import { Kpi } from '@/components/kpi/Kpi';
import { DailyRevenueChart } from '@/components/charts/DailyRevenueChart';
import {
  getKpiToday, getKpiDaily, getCaptureRates,
  aggregateDaily, getDqIssues, getChannelPerf
} from '@/lib/data';
import { resolvePeriod } from '@/lib/period';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function OverviewPage({ searchParams }: Props) {
  const period = resolvePeriod(searchParams);

  const today = await getKpiToday().catch(() => null);
  const daily = await getKpiDaily(period).catch(() => []);
  const capture = await getCaptureRates().catch(() => null);
  const dq = await getDqIssues().catch(() => []);
  const agg = aggregateDaily(daily);

  // 90d for chart — independent of selected period so the chart context is stable
  const chartTo = new Date();
  const chartFrom = new Date(chartTo.getTime() - 90 * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const daily90 = await getKpiDaily(fmt(chartFrom), fmt(chartTo)).catch(() => []);

  return (
    <div className="pt-6">
      <Section title="Overview" tag={`Right Now · ${period.label}`}>
        <div className="grid grid-cols-4 gap-3 mb-3">
          <Kpi label="In-House" value={today?.in_house ?? 0} />
          <Kpi label="Arriving Today" value={today?.arrivals_today ?? 0} />
          <Kpi label="Departing Today" value={today?.departures_today ?? 0} />
          <Kpi label="OTB Next 90d" value={today?.otb_next_90d ?? 0} />
        </div>
        <div className="grid grid-cols-5 gap-3 mb-3">
          <Kpi label={`Occupancy (${period.days}d)`} value={agg?.occupancy_pct ?? 0} kind="pct" />
          <Kpi label={`ADR (${period.days}d)`} value={agg?.adr ?? 0} kind="money" />
          <Kpi label={`RevPAR (${period.days}d)`} value={agg?.revpar ?? 0} kind="money" />
          <Kpi label={`TRevPAR (${period.days}d)`} value={agg?.trevpar ?? 0} kind="money" />
          <Kpi label="GOPPAR" value={null} greyed hint="Cost data needed" />
        </div>
        <div className="grid grid-cols-6 gap-3">
          <Kpi label="Cancellation %" value={Number(today?.cancellation_pct_90d ?? 0)} kind="pct" />
          <Kpi label="No-show %" value={Number(today?.no_show_pct_90d ?? 0)} kind="pct" />
          <Kpi label="F&B / Occ Rn" value={Number(capture?.fnb_per_occ_room ?? 0)} kind="money" />
          <Kpi label="Spa / Occ Rn" value={Number(capture?.spa_per_occ_room ?? 0)} kind="money" />
          <Kpi label="Activity / Occ Rn" value={Number(capture?.activity_per_occ_room ?? 0)} kind="money" />
          <Kpi label="Open DQ Issues" value={dq.length} status={dq.length > 0 ? 'warn' : 'good'} />
        </div>
        <div className="text-muted text-xs mt-3 tabular">
          Active filter: <strong>{period.label}</strong> · {period.rangeLabel}
        </div>
      </Section>

      <Section title="Revenue & Occupancy" tag="Last 90 days · daily">
        {daily90.length > 0 ? (
          <DailyRevenueChart data={daily90} />
        ) : (
          <div className="text-muted text-sm py-12 text-center">No data in window.</div>
        )}
      </Section>

      <div className="grid grid-cols-2 gap-6">
        <Section title="Forecast vs Budget" tag="Coming soon" greyed greyedReason="Budget upload pending">
          <div className="grid grid-cols-2 gap-3">
            <Kpi label="Forecast vs Budget · Occ" value={null} greyed />
            <Kpi label="Forecast vs Budget · Revenue" value={null} greyed kind="money" />
          </div>
        </Section>
        <Section title="Channel Mix" tag="Top sources · 30d">
          <ChannelTeaser />
        </Section>
      </div>
    </div>
  );
}

async function ChannelTeaser() {
  const ch = await getChannelPerf().catch(() => []);
  const top = ch.slice(0, 6);
  const total30 = top.reduce((s, c) => s + Number(c.revenue_30d || 0), 0);
  return (
    <table>
      <thead>
        <tr>
          <th>Source</th><th className="text-right">Bookings</th>
          <th className="text-right">Revenue 30d</th><th className="text-right">% Mix</th>
        </tr>
      </thead>
      <tbody>
        {top.map((c: any) => (
          <tr key={c.source_name}>
            <td>{c.source_name}</td>
            <td className="text-right">{c.bookings_30d}</td>
            <td className="text-right tabular">{Number(c.revenue_30d).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
            <td className="text-right tabular text-muted">
              {total30 ? `${((Number(c.revenue_30d) / total30) * 100).toFixed(0)}%` : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
