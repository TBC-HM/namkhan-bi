// app/revenue/channels/page.tsx
// D7 (staged, not deployed): wire Channels mockup KPIs to live mv_channel_perf data.
// Direct/OTA/Wholesale mix calculated from 90d revenue. Commission $ + Channel cost remain as
// "data needed" mockup placeholders pending commission table.

import tabChannels from '../_redesign/tabChannels';
import { getChannelPerf } from '@/lib/data';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

function patchKpi(html: string, labelTextStartsWith: string, newValue: string): string {
  // Match labels that start with the given string (label may have appended `<span class="data-needed">…`).
  const escStart = labelTextStartsWith.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `(<div class="kpi-label">\\s*${escStart}[^<]*(?:<[^>]+>[^<]*</[^>]+>\\s*)*</div>\\s*<div class="kpi-value"[^>]*>)([^<]*)(</div>)`
  );
  return html.replace(re, (_match, p1: string, _p2: string, p3: string) => p1 + newValue + p3);
}

const OTA_RX = /booking\.com|expedia|agoda|airbnb|ctrip|trip\.com|hotels\.com/i;
const DIRECT_RX = /direct|website|booking engine|email|walk[- ]?in/i;
const WHOLESALE_RX = /wholesale|tour|dmc|gta|hotelbeds|expedia partner|webbeds/i;

export default async function ChannelsPage() {
  const channels = await getChannelPerf().catch(() => []);

  const valid = channels.filter(
    (c: any) => Number(c.bookings_90d || 0) > 0 || Number(c.revenue_90d || 0) > 0
  );

  const totalRev = valid.reduce((s: number, c: any) => s + Number(c.revenue_90d || 0), 0);

  const directRev = valid
    .filter((c: any) => DIRECT_RX.test(String(c.source_name || '')))
    .reduce((s: number, c: any) => s + Number(c.revenue_90d || 0), 0);
  const otaRev = valid
    .filter((c: any) => OTA_RX.test(String(c.source_name || '')))
    .reduce((s: number, c: any) => s + Number(c.revenue_90d || 0), 0);
  const wholesaleRev = valid
    .filter((c: any) => WHOLESALE_RX.test(String(c.source_name || '')))
    .reduce((s: number, c: any) => s + Number(c.revenue_90d || 0), 0);

  const pct = (n: number) => (totalRev > 0 ? Math.round((n / totalRev) * 100) : 0);

  let html = tabChannels.replace(/class="tab-content"/, 'class="tab-content active"');

  if (totalRev > 0) {
    html = patchKpi(html, 'Direct mix',    `${pct(directRev)}%`);
    html = patchKpi(html, 'OTA mix',       `${pct(otaRev)}%`);
    html = patchKpi(html, 'Wholesale mix', `${pct(wholesaleRev)}%`);
  }

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
