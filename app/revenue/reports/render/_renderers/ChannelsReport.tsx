// app/revenue/reports/render/_renderers/ChannelsReport.tsx
// Channels report — ported to primitives.

import { Container, KpiTile, Chart, type ChartSeries } from '@/app/(cockpit)/_design';
import ReportBrief from './_shared/ReportBrief';
import { getChannelPerf } from '@/lib/data';
import type { ResolvedPeriod } from '@/lib/period';
import { fmtTableUsd } from '@/lib/format';

interface Props { period: ResolvedPeriod }

export default async function ChannelsReport({ period }: Props) {
  const channels = await getChannelPerf(period).catch(() => [] as Record<string, unknown>[]);

  const useShort = period.days <= 35;
  const revKey = useShort ? 'revenue_30d'   : 'revenue_90d';
  const bkKey  = useShort ? 'bookings_30d'  : 'bookings_90d';

  const arr = channels as Array<Record<string, unknown>>;
  const total = arr.reduce((s, c) => s + Number(c[revKey] ?? 0), 0);
  const totalBookings = arr.reduce((s, c) => s + Number(c[bkKey] ?? 0), 0);

  const directRev = arr
    .filter((c) => /direct|website|booking engine|email|walk[- ]?in/i.test(String(c.source_name || '')))
    .reduce((s, c) => s + Number(c[revKey] ?? 0), 0);
  const otaRev = arr
    .filter((c) => /booking\.com|expedia|agoda|hotels\.com|trip\.com/i.test(String(c.source_name || '')))
    .reduce((s, c) => s + Number(c[revKey] ?? 0), 0);
  const wholesaleRev = arr
    .filter((c) => /dmc|wholesale|gds/i.test(String(c.source_name || '')))
    .reduce((s, c) => s + Number(c[revKey] ?? 0), 0);

  const directShare    = total > 0 ? (directRev    / total) * 100 : 0;
  const otaShare       = total > 0 ? (otaRev       / total) * 100 : 0;
  const wholesaleShare = total > 0 ? (wholesaleRev / total) * 100 : 0;

  const briefSignal = `${period.label} · ${channels.length} channels · Total $${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const briefBody = `Direct ${directShare.toFixed(0)}% · OTA ${otaShare.toFixed(0)}% · Wholesale ${wholesaleShare.toFixed(0)}% across the picked window.`;
  const good: string[] = [];
  const bad:  string[] = [];
  if (directShare    >= 30) good.push(`Direct ${directShare.toFixed(0)}% — channel mix healthy.`);
  if (directShare    <  20) bad.push (`Direct ${directShare.toFixed(0)}% — push direct booking growth.`);
  if (otaShare       >= 60) bad.push (`OTA ${otaShare.toFixed(0)}% — commission drag risk.`);
  if (wholesaleShare >  40) bad.push (`Wholesale ${wholesaleShare.toFixed(0)}% — high net-rate exposure.`);
  if (good.length === 0) good.push('Channel mix within bounds.');
  if (bad.length === 0)  bad.push ('No channel concentration alarms.');

  if (channels.length === 0 || total === 0) {
    return (
      <Container title="No channel data" subtitle={`mv_channel_perf returned no rows for ${period.label}`} density="compact">
        <div style={{ padding: 20, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
          Check upstream channel data feed.
        </div>
      </Container>
    );
  }

  const rows = arr.map((c, i) => {
    const rev = Number(c[revKey] ?? 0);
    const bookings = Number(c[bkKey] ?? 0);
    const avg = bookings > 0 ? rev / bookings : 0;
    const share = total > 0 ? (rev / total) * 100 : 0;
    return {
      channel: String(c.source_name ?? `Row ${i + 1}`),
      revenue: fmtTableUsd(rev),
      bookings: bookings.toLocaleString(),
      avg: avg > 0 ? fmtTableUsd(avg) : '—',
      share: `${share.toFixed(1)}%`,
    };
  });
  const cols: ChartSeries[] = [
    { key: 'revenue',  label: 'Revenue' },
    { key: 'bookings', label: 'Bookings' },
    { key: 'avg',      label: 'Avg booking $' },
    { key: 'share',    label: 'Share %' },
  ];

  return (
    <>
      <ReportBrief signal={briefSignal} body={briefBody} good={good} bad={bad} />

      <Container title="Channel mix" subtitle="share by category" density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <KpiTile label="Total revenue" value={Math.round(total)} currency="USD" size="sm" />
          <KpiTile label="Direct share" value={`${directShare.toFixed(1)}%`} size="sm"
            status={directShare >= 30 ? 'green' : directShare < 20 ? 'amber' : 'grey'} />
          <KpiTile label="OTA share" value={`${otaShare.toFixed(1)}%`} size="sm"
            status={otaShare >= 60 ? 'amber' : 'grey'} />
          <KpiTile label="Wholesale share" value={`${wholesaleShare.toFixed(1)}%`} size="sm"
            status={wholesaleShare > 40 ? 'amber' : 'grey'} />
          <KpiTile label="Bookings" value={totalBookings} size="sm" />
        </div>
      </Container>

      <Container title="Per-channel detail" subtitle={useShort ? '30d window' : '90d window'}>
        <Chart variant="table" data={rows} xKey="channel" series={cols}
          empty={{ title: 'No channels' }} />
      </Container>
    </>
  );
}
