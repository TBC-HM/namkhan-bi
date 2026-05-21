// app/revenue/reports/render/_renderers/PulseReport.tsx
// Pulse report — ported to primitives. Container · KpiTile · Chart(table)
// + shared ReportBrief. Data fetching unchanged.

import { Container, KpiTile, Chart, type ChartSeries } from '@/app/(cockpit)/_design';
import ReportBrief from './_shared/ReportBrief';
import { getOverviewKpis, getChannelPerf } from '@/lib/data';
import { getTacticalAlertsTop } from '@/lib/pulseData';
import type { ResolvedPeriod } from '@/lib/period';
import { fmtTableUsd } from '@/lib/format';

interface Props { period: ResolvedPeriod }

export default async function PulseReport({ period }: Props) {
  const [kpis, channels, alerts] = await Promise.all([
    getOverviewKpis(period).catch(() => ({ current: null, compare: null } as Record<string, unknown>)),
    getChannelPerf(period).catch(() => [] as Record<string, unknown>[]),
    getTacticalAlertsTop().catch(() => [] as Record<string, unknown>[]),
  ]);

  const cur = (kpis as { current?: Record<string, unknown> }).current;
  const cmp = (kpis as { compare?: Record<string, unknown> }).compare;
  const occ     = Number(cur?.occupancy_pct ?? 0);
  const adr     = Number(cur?.adr_usd ?? 0);
  const revpar  = Number(cur?.revpar_usd ?? 0);
  const trevpar = Number(cur?.trevpar_usd ?? 0);

  const cmpLabel = period.cmpLabel ? period.cmpLabel.replace(/^vs\s+/i, '') : '';
  const dOcc     = cmp ? occ     - Number(cmp.occupancy_pct ?? 0) : null;
  const dAdr     = cmp ? adr     - Number(cmp.adr_usd        ?? 0) : null;
  const dRevpar  = cmp ? revpar  - Number(cmp.revpar_usd     ?? 0) : null;
  const dTrevpar = cmp ? trevpar - Number(cmp.trevpar_usd    ?? 0) : null;

  const channelTotal = (channels as Array<Record<string, unknown>>).reduce(
    (s, c) => s + Number(c.revenue_30d || c.revenue_90d || 0), 0,
  );
  const directRev = (channels as Array<Record<string, unknown>>)
    .filter((c) => /direct|website|booking engine|email|walk[- ]?in/i.test(String(c.source_name || '')))
    .reduce((s, c) => s + Number(c.revenue_30d || c.revenue_90d || 0), 0);
  const directShare = channelTotal > 0 ? (directRev / channelTotal) * 100 : 0;
  const top5 = (channels as Array<Record<string, unknown>>).slice(0, 5);

  const briefSignal = `${period.label} · OCC ${occ.toFixed(0)}% · ADR $${adr.toFixed(0)} · RevPAR $${revpar.toFixed(0)} · TRevPAR $${trevpar.toFixed(0)}`;
  const briefBody = `${alerts.length} tactical alert${alerts.length === 1 ? '' : 's'} live · Direct share ${directShare.toFixed(0)}% across the channel set.`;
  const good: string[] = [];
  const bad:  string[] = [];
  if (occ >= 70)         good.push(`Occupancy ${occ.toFixed(0)}% — strong base.`);
  if (occ < 50)          bad.push (`Occupancy ${occ.toFixed(0)}% — soft; check pricing & channel mix.`);
  if (adr >= 200)        good.push(`ADR $${adr.toFixed(0)} — premium pricing holding.`);
  if (revpar >= 150)     good.push(`RevPAR $${revpar.toFixed(0)} — top-line healthy.`);
  if (directShare >= 30) good.push(`Direct share ${directShare.toFixed(0)}% — channel mix healthy.`);
  if (alerts.length > 0) bad.push (`${alerts.length} tactical alerts open — see panel below.`);
  if (good.length === 0) good.push('No standout strengths flagged for this period.');
  if (bad.length === 0)  bad.push ('No leakage signals flagged for this period.');

  const hasAnyData = occ > 0 || adr > 0 || revpar > 0 || channels.length > 0;
  if (!hasAnyData) {
    return (
      <Container title="No data" subtitle={`PMS returned no rows for ${period.label}`} density="compact">
        <div style={{ padding: 20, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
          Try a different window or check the upstream feed.
        </div>
      </Container>
    );
  }

  const channelRows = top5.map((c, i) => {
    const rev = Number(c.revenue_30d || c.revenue_90d || 0);
    const bookings = Number(c.bookings_30d || c.bookings_90d || 0);
    const share = channelTotal > 0 ? (rev / channelTotal) * 100 : 0;
    return {
      channel: String(c.source_name ?? `Row ${i + 1}`),
      revenue: fmtTableUsd(rev),
      bookings: bookings.toLocaleString(),
      share: `${share.toFixed(1)}%`,
    };
  });
  const channelCols: ChartSeries[] = [
    { key: 'revenue',  label: 'Revenue' },
    { key: 'bookings', label: 'Bookings' },
    { key: 'share',    label: 'Share %' },
  ];

  return (
    <>
      <ReportBrief signal={briefSignal} body={briefBody} good={good} bad={bad} />

      <Container title="Headline KPIs" subtitle="this period" density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <KpiTile label="Occupancy" value={`${occ.toFixed(1)}%`} size="sm"
            delta={dOcc != null ? { value: dOcc, period: cmpLabel, direction: dOcc >= 0 ? 'up' : 'down' } : undefined}
            footnote="period average" />
          <KpiTile label="ADR" value={Math.round(adr)} currency="USD" size="sm"
            delta={dAdr != null ? { value: dAdr, period: cmpLabel, direction: dAdr >= 0 ? 'up' : 'down' } : undefined} />
          <KpiTile label="RevPAR" value={Math.round(revpar)} currency="USD" size="sm"
            delta={dRevpar != null ? { value: dRevpar, period: cmpLabel, direction: dRevpar >= 0 ? 'up' : 'down' } : undefined} />
          <KpiTile label="TRevPAR" value={Math.round(trevpar)} currency="USD" size="sm"
            delta={dTrevpar != null ? { value: dTrevpar, period: cmpLabel, direction: dTrevpar >= 0 ? 'up' : 'down' } : undefined} />
          <KpiTile label="Direct share" value={`${directShare.toFixed(1)}%`} size="sm"
            footnote="direct ÷ total channel revenue" />
        </div>
      </Container>

      <Container title="Top channels" subtitle={`${top5.length} of ${channels.length}`} density="compact">
        <Chart variant="table" data={channelRows} xKey="channel" series={channelCols}
          empty={{ title: 'No channel revenue', hint: 'mv_channel_perf returned no rows' }} />
      </Container>

      <Container title="Live tactical alerts" subtitle={`${alerts.length} open`} density="compact">
        {alerts.length === 0 ? (
          <div style={{ padding: 8, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic', fontSize: 12 }}>
            No tactical alerts at this moment.
          </div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink, #1B1B1B)', fontSize: 13, lineHeight: 1.7 }}>
            {(alerts as Array<Record<string, unknown>>).slice(0, 3).map((a, i) => (
              <li key={i}>{String(a.title ?? a.label ?? JSON.stringify(a).slice(0, 200))}</li>
            ))}
          </ul>
        )}
      </Container>
    </>
  );
}
