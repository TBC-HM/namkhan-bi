import { Section } from '@/components/sections/Section';
import { Kpi } from '@/components/kpi/Kpi';
import { DailyRevenueChart } from '@/components/charts/DailyRevenueChart';
import {
  getKpiToday, getKpiDaily, getCaptureRates, defaultDailyRange,
  aggregateDaily, getDqIssues
} from '@/lib/data';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const today = await getKpiToday().catch(() => null);
  const range = defaultDailyRange(30);
  const daily30 = await getKpiDaily(range.from, range.to).catch(() => []);
  const capture = await getCaptureRates().catch(() => null);
  const dq = await getDqIssues().catch(() => []);
  const agg30 = aggregateDaily(daily30);
  // 90d for chart
  const range90 = defaultDailyRange(90);
  const daily90 = await getKpiDaily(range90.from, range90.to).catch(() => []);

  return (
    <div className="pt-6">
      <Section title="Overview" tag="Right Now · Last 30d">
        <div className="grid grid-cols-4 gap-3 mb-3">
          <Kpi label="In-House" value={today?.in_house ?? 0} />
          <Kpi label="Arriving Today" value={today?.arrivals_today ?? 0} />
          <Kpi label="Departing Today" value={today?.departures_today ?? 0} />
          <Kpi label="OTB Next 90d" value={today?.otb_next_90d ?? 0} />
        </div>
        <div className="grid grid-cols-5 gap-3 mb-3">
          <Kpi label="Occupancy (30d)" value={agg30?.occupancy_pct ?? 0} kind="pct" />
          <Kpi label="ADR (30d)" value={agg30?.adr ?? 0} kind="money" />
          <Kpi label="RevPAR (30d)" value={agg30?.revpar ?? 0} kind="money" />
          <Kpi label="TRevPAR (30d)" value={agg30?.trevpar ?? 0} kind="money" />
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
  const { getChannelPerf } = await import('@/lib/data');
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
