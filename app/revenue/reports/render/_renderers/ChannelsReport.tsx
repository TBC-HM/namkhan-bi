// app/revenue/reports/render/_renderers/ChannelsReport.tsx
// Channels report — channel mix table with revenue, bookings, ADR and
// commission per channel for the picked period. Server component.

import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import Brief from '@/components/page/Brief';
import { getChannelPerf } from '@/lib/data';
import type { ResolvedPeriod } from '@/lib/period';
import { fmtTableUsd } from '@/lib/format';

interface Props { period: ResolvedPeriod }

export default async function ChannelsReport({ period }: Props) {
  const channels = await getChannelPerf(period).catch(() => [] as any[]);

  // Pick the right window column on the existing fixed-window mat view.
  const useShort = period.days <= 35;
  const revKey   = useShort ? 'revenue_30d'   : 'revenue_90d';
  const bkKey    = useShort ? 'bookings_30d'  : 'bookings_90d';

  const total = channels.reduce((s: number, c: any) => s + Number(c[revKey] ?? 0), 0);
  const totalBookings = channels.reduce((s: number, c: any) => s + Number(c[bkKey] ?? 0), 0);

  const directRev = channels
    .filter((c: any) => /direct|website|booking engine|email|walk[- ]?in/i.test(String(c.source_name || '')))
    .reduce((s: number, c: any) => s + Number(c[revKey] ?? 0), 0);
  const otaRev = channels
    .filter((c: any) => /booking\.com|expedia|agoda|hotels\.com|trip\.com/i.test(String(c.source_name || '')))
    .reduce((s: number, c: any) => s + Number(c[revKey] ?? 0), 0);
  const wholesaleRev = channels
    .filter((c: any) => /dmc|wholesale|gds/i.test(String(c.source_name || '')))
    .reduce((s: number, c: any) => s + Number(c[revKey] ?? 0), 0);

  const directShare    = total > 0 ? (directRev    / total) * 100 : 0;
  const otaShare       = total > 0 ? (otaRev       / total) * 100 : 0;
  const wholesaleShare = total > 0 ? (wholesaleRev / total) * 100 : 0;

  const briefSignal =
    `${period.label} · ${channels.length} channels · ` +
    `Total $${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const briefBody =
    `Direct ${directShare.toFixed(0)}% · OTA ${otaShare.toFixed(0)}% · ` +
    `Wholesale ${wholesaleShare.toFixed(0)}% across the picked window.`;
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
      <div data-panel style={{
        padding: 24, color: '#7d7565', fontStyle: 'italic', textAlign: 'center',
        background: '#0f0d0a', border: '1px solid #1f1c15', borderRadius: 10,
      }}>
        No channel revenue captured for {period.label}. Mat view mv_channel_perf returned no rows.
      </div>
    );
  }

  return (
    <>
      <Brief brief={{ signal: briefSignal, body: briefBody, good, bad }} actions={null} />

      <div style={{ height: 14 }} />

      <Panel title="Channel mix" eyebrow="share by category" hideExpander>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <KpiBox value={total} unit="usd" label="Total revenue" />
          <KpiBox value={directShare}    unit="pct" label="Direct share" />
          <KpiBox value={otaShare}       unit="pct" label="OTA share" />
          <KpiBox value={wholesaleShare} unit="pct" label="Wholesale share" />
          <KpiBox value={totalBookings}  unit="count" label="Bookings" />
        </div>
      </Panel>

      <div style={{ height: 14 }} />

      <Panel title="Per-channel detail" eyebrow={useShort ? '30d window' : '90d window'} hideExpander>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Channel</th>
                <th className="num">Revenue</th>
                <th className="num">Bookings</th>
                <th className="num">Avg booking $</th>
                <th className="num">Share %</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c: any, i: number) => {
                const rev = Number(c[revKey] ?? 0);
                const bookings = Number(c[bkKey] ?? 0);
                const avg = bookings > 0 ? rev / bookings : 0;
                const share = total > 0 ? (rev / total) * 100 : 0;
                return (
                  <tr key={c.source_name ?? i}>
                    <td className="lbl">{c.source_name ?? '—'}</td>
                    <td className="num">{fmtTableUsd(rev)}</td>
                    <td className="num">{bookings.toLocaleString()}</td>
                    <td className="num">{avg > 0 ? fmtTableUsd(avg) : '—'}</td>
                    <td className="num">{share.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
