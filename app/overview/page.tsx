// app/overview/page.tsx
// Owner overview — Beyond Circle layout.
// Hero strip + 3 KPI rows + channel mix card.

import Banner from '@/components/nav/Banner';
import FilterStrip from '@/components/nav/FilterStrip';
import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import Insight from '@/components/sections/Insight';
import KpiCard from '@/components/kpi/KpiCard';
import { DailyRevenueChart } from '@/components/charts/DailyRevenueChart';
import { PILLAR_HEADER } from '@/components/nav/subnavConfig';
import {
  getKpiToday, getKpiDaily, getCaptureRates,
  aggregateDaily, getDqIssues, getChannelPerf,
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

  // 90d for chart — independent of selected period
  const chartTo = new Date();
  const chartFrom = new Date(chartTo.getTime() - 90 * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const daily90 = await getKpiDaily(fmt(chartFrom), fmt(chartTo)).catch(() => []);

  const ch = await getChannelPerf().catch(() => []);
  // exclude zero-revenue rows (B3 fix)
  const topChannels = ch
    .filter((c: any) => Number(c.revenue_30d) > 0 || Number(c.bookings_30d) > 0)
    .slice(0, 6);
  const total30 = topChannels.reduce((s: number, c: any) => s + Number(c.revenue_30d || 0), 0);

  const header = PILLAR_HEADER.overview;
  const refreshTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Vientiane' });

  return (
    <>
      <Banner
        eyebrow={header.eyebrow}
        title={header.title}
        titleEmphasis={header.emphasis}
        meta={
          <>
            <strong>Operator Intelligence</strong><br />
            Refreshed {refreshTime} ICT
          </>
        }
      />

      <FilterStrip
        baseHref="/overview"
        currentWin={String(searchParams.win || '30d')}
        rangeLabel={`${period.from.slice(8, 10)} ${monthShort(period.from)} → ${period.to.slice(8, 10)} ${monthShort(period.to)} ${period.to.slice(0, 4)}`}
        liveSource="Cloudbeds · Supabase · live"
      />

      <div className="panel">
        {/* Hero strip — headline + 4 today KPIs */}
        <PanelHero
          eyebrow="Today · live"
          title="Right Now"
          emphasis={`· ${period.label}`}
          sub="In-house, arriving, departing, on-the-books"
          kpis={
            <>
              <KpiCard label="In-House" value={today?.in_house ?? 0} />
              <KpiCard label="Arriving Today" value={today?.arrivals_today ?? 0} />
              <KpiCard label="Departing Today" value={today?.departures_today ?? 0} />
              <KpiCard label="OTB Next 90d" value={today?.otb_next_90d ?? 0} />
            </>
          }
        />

        {/* Performance row */}
        <div className="card-grid-5">
          <KpiCard label={`Occupancy (${period.days}d)`} value={agg?.occupancy_pct ?? 0} kind="pct" />
          <KpiCard label={`ADR (${period.days}d)`} value={agg?.adr ?? 0} kind="money" />
          <KpiCard label={`RevPAR (${period.days}d)`} value={agg?.revpar ?? 0} kind="money" />
          <KpiCard label={`TRevPAR (${period.days}d)`} value={agg?.trevpar ?? 0} kind="money" />
          <KpiCard label="GOPPAR" value={null} greyed hint="Cost data needed" />
        </div>

        {/* Mix row */}
        <div className="card-grid-6">
          <KpiCard label="Cancellation %" value={Number(today?.cancellation_pct_90d ?? 0)} kind="pct" />
          <KpiCard label="No-show %" value={Number(today?.no_show_pct_90d ?? 0)} kind="pct" />
          <KpiCard label="F&B / Occ Rn" value={Number(capture?.fnb_per_occ_room ?? 0)} kind="money" showSecondaryCurrency={false} />
          <KpiCard label="Spa / Occ Rn" value={Number(capture?.spa_per_occ_room ?? 0)} kind="money" showSecondaryCurrency={false} />
          <KpiCard label="Activity / Occ Rn" value={Number(capture?.activity_per_occ_room ?? 0)} kind="money" showSecondaryCurrency={false} />
          <KpiCard
            label="Open DQ Issues"
            value={dq.length}
            tone={dq.length > 0 ? 'warn' : 'pos'}
          />
        </div>

        {/* Revenue chart */}
        <Card title="Revenue & Occupancy" emphasis="trend" sub="Last 90 days · daily" source="mv_kpi_daily">
          {daily90.length > 0
            ? <DailyRevenueChart data={daily90} />
            : <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-mute)' }}>No data in window.</div>
          }
        </Card>

        {/* Channel mix + greyed forecast */}
        <div className="card-grid-2" style={{ marginTop: 22 }}>
          <Card title="Channel" emphasis="mix" sub="Top sources · 30d" source="mv_channel_perf">
            {topChannels.length === 0 ? (
              <div style={{ padding: 24, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
                No channel revenue in last 30 days.
              </div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th className="num">Bookings</th>
                    <th className="num">Revenue 30d</th>
                    <th className="num">% Mix</th>
                  </tr>
                </thead>
                <tbody>
                  {topChannels.map((c: any) => (
                    <tr key={c.source_name}>
                      <td className="lbl"><strong>{c.source_name || '—'}</strong></td>
                      <td className="num">{c.bookings_30d}</td>
                      <td className="num">${Number(c.revenue_30d).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                      <td className="num text-mute">
                        {total30 ? `${((Number(c.revenue_30d) / total30) * 100).toFixed(0)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Forecast" emphasis="vs Budget" sub="Coming soon — budget upload pending">
            <div style={{ position: 'relative', minHeight: 180 }}>
              <div className="card-grid-2" style={{ marginBottom: 0 }}>
                <KpiCard label="Forecast Occ" value={null} greyed />
                <KpiCard label="Forecast Revenue" value={null} greyed kind="money" />
              </div>
              <div className="greyed-out-overlay">
                <div className="greyed-out-overlay-content">
                  Coming soon
                  <small>Budget upload pending</small>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Insight strip */}
        {dq.length > 0 ? (
          <Insight tone="warn" eye="DQ alert">
            <strong>{dq.length} open data-quality issues.</strong> Fix or document before SLH review.
            See <em>Agents · DQ Roster</em>.
          </Insight>
        ) : (
          <Insight tone="info" eye="Health">
            <strong>All KPI feeds green.</strong> Last sync {refreshTime} ICT.
            Cancellation {Number(today?.cancellation_pct_90d ?? 0).toFixed(1)}% over 90d — within tolerance.
          </Insight>
        )}
      </div>
    </>
  );
}

function monthShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short' });
}
