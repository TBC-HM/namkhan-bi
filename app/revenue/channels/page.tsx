// app/revenue/channels/page.tsx
// Revenue · Channels — 90d source/channel performance table.
// Includes B3 fix: filter out rows with 0 bookings AND 0 revenue.

import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';
import Insight from '@/components/sections/Insight';
import { getChannelPerf } from '@/lib/data';
import { fmtMoney } from '@/lib/format';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

const OTA_RX = /booking\.com|expedia|agoda|airbnb|ctrip|trip\.com|hotels\.com/i;
const DIRECT_RX = /direct|website|booking engine|email|walk[\- ]?in/i;

export default async function ChannelsPage() {
  const channelsRaw = await getChannelPerf().catch(() => []);

  // B3 FIX: drop fully-zero rows (e.g. "Retreat Reseller (f.eVigeosport)")
  const channels = channelsRaw.filter((c: any) =>
    Number(c.bookings_90d) > 0 || Number(c.revenue_90d) > 0
  );

  const total90Rev = channels.reduce((s: number, c: any) => s + Number(c.revenue_90d || 0), 0);
  const total90 = channels.reduce((s: number, c: any) => s + Number(c.bookings_90d || 0), 0);
  const direct = channels.find((c: any) => DIRECT_RX.test(String(c.source_name || '')));
  const ota = channels.filter((c: any) => OTA_RX.test(String(c.source_name || '')));
  const otaRev = ota.reduce((s: number, c: any) => s + Number(c.revenue_90d || 0), 0);

  const otaMix = total90Rev ? (otaRev / total90Rev) * 100 : 0;
  const directMix = total90Rev && direct ? (Number(direct.revenue_90d) / total90Rev) * 100 : 0;

  // Highest cancel-rate channel for the insight
  let worstCancel = { name: '', pct: 0 };
  channels.forEach((c: any) => {
    const pct = c.bookings_30d ? (Number(c.canceled_30d) / Number(c.bookings_30d)) * 100 : 0;
    if (pct > worstCancel.pct && Number(c.bookings_30d) >= 3) {
      worstCancel = { name: c.source_name || '—', pct };
    }
  });

  return (
    <>
      <PanelHero
        eyebrow="Channels · 90d"
        title="Channel"
        emphasis="performance"
        sub="Source mix · ADR · cancel rate · lead time"
        kpis={
          <>
            <KpiCard label="Total Bookings" value={total90} />
            <KpiCard label="Total Revenue" value={total90Rev} kind="money" />
            <KpiCard
              label="OTA Mix"
              value={otaMix}
              kind="pct"
              tone={otaMix > 70 ? 'warn' : 'neutral'}
              hint={otaMix > 70 ? 'Heavy OTA dependence' : undefined}
            />
            <KpiCard
              label="Direct Mix"
              value={directMix}
              kind="pct"
              tone={directMix < 15 ? 'warn' : 'pos'}
            />
          </>
        }
      />

      <Card
        title="Channel performance"
        emphasis="90d"
        sub="Sorted by revenue · zero-bookings rows hidden"
        source="mv_channel_perf"
      >
        <table className="tbl">
          <thead>
            <tr>
              <th>Source</th>
              <th className="num">Bookings</th>
              <th className="num">Revenue</th>
              <th className="num">% Mix</th>
              <th className="num">ADR</th>
              <th className="num">Avg Lead</th>
              <th className="num">Avg LOS</th>
              <th className="num">Cancel%</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((c: any) => {
              const cancelPct = c.bookings_30d ? (Number(c.canceled_30d) / Number(c.bookings_30d)) * 100 : 0;
              const mix = total90Rev ? (Number(c.revenue_90d) / total90Rev) * 100 : 0;
              return (
                <tr key={c.source_name}>
                  <td className="lbl"><strong>{c.source_name}</strong></td>
                  <td className="num">{c.bookings_90d}</td>
                  <td className="num">{fmtMoney(Number(c.revenue_90d), 'USD')}</td>
                  <td className="num text-mute">{mix.toFixed(0)}%</td>
                  <td className="num">{c.adr_90d ? fmtMoney(Number(c.adr_90d), 'USD') : '—'}</td>
                  <td className="num">{c.avg_lead_time_90d ? `${Number(c.avg_lead_time_90d).toFixed(0)}d` : '—'}</td>
                  <td className="num">{c.avg_los_90d ? Number(c.avg_los_90d).toFixed(1) : '—'}</td>
                  <td className={`num ${cancelPct > 20 ? 'text-bad' : ''}`}>
                    {cancelPct.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {worstCancel.name && (
        <Insight tone={worstCancel.pct > 30 ? 'alert' : 'warn'} eye="Cancel watch">
          <strong>{worstCancel.name}</strong> showing {worstCancel.pct.toFixed(1)}% cancellation in last 30d.{' '}
          Investigate rate plan, deposit policy, and lead time profile for this channel.
        </Insight>
      )}
    </>
  );
}
