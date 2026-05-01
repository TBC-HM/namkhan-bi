// app/revenue/pulse/page.tsx
// D5+D5b (staged): wires 8 KPIs + 2 charts (Daily revenue 90d, Channel mix 30d) on Pulse.
// Other charts (Occ by room, ADR×Occ scatter, Pickup velocity, Pace curve) keep mockup
// illustrative SVGs until per-room-type / pickup-history / pace-snapshot sources land.

import tabPulse from '../_redesign/tabPulse';
import { resolvePeriod } from '@/lib/period';
import { getKpiDaily, aggregateDaily, getChannelPerf } from '@/lib/data';
import { getPulseExtendedKpis } from '@/lib/pulseExtended';
import { fmtMoney, fmtPct } from '@/lib/format';
import { dailyRevenue90dSvg, channelMix30dSvg } from '@/lib/svgCharts';
import { replaceChartInSection } from '../_redesign/chartReplace';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

function patchKpi(html: string, labelText: string, newValue: string): string {
  const escLabel = labelText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `(<div class="kpi-label">\\s*${escLabel}\\s*</div>\\s*<div class="kpi-value">)([^<]*)(</div>)`
  );
  return html.replace(re, (_match, p1: string, _p2: string, p3: string) => p1 + newValue + p3);
}

const OTA_RX = /booking\.com|expedia|agoda|airbnb|ctrip|trip\.com|hotels\.com/i;
const DIRECT_RX = /direct|website|booking engine|email|walk[- ]?in/i;
const WHOLESALE_RX = /wholesale|tour|dmc|gta|hotelbeds|expedia partner|webbeds/i;

export default async function PulsePage({ searchParams }: Props) {
  const period = resolvePeriod(searchParams);

  // Daily revenue chart now matches the selected window (was hardcoded 90d).
  // Bug 10 fix per Cowork handoff 2026-05-01.
  const [daily, daily90, extended, channels] = await Promise.all([
    getKpiDaily(period.from, period.to).catch(() => []),
    getKpiDaily(period.from, period.to).catch(() => []),
    getPulseExtendedKpis(period),
    getChannelPerf().catch(() => []),
  ]);

  const agg = aggregateDaily(daily, period.capacityMode);

  let html = tabPulse.replace(/class="tab-content"/, 'class="tab-content active"');

  // ── KPI tile patches ─────────────────────────────────────────────────
  if (agg) {
    html = patchKpi(html, 'Occupancy', fmtPct(agg.occupancy_pct ?? 0));
    html = patchKpi(html, 'ADR',       fmtMoney(agg.adr ?? 0, 'USD'));
    html = patchKpi(html, 'RevPAR',    fmtMoney(agg.revpar ?? 0, 'USD'));
    html = patchKpi(html, 'TRevPAR',   fmtMoney(agg.trevpar ?? 0, 'USD'));
  }
  if (extended.cancelPct != null) html = patchKpi(html, 'Cancel %',  fmtPct(extended.cancelPct));
  if (extended.noShowPct != null) html = patchKpi(html, 'No-Show %', fmtPct(extended.noShowPct));
  if (extended.leadTimeDays != null) html = patchKpi(html, 'Lead Time', `${extended.leadTimeDays.toFixed(0)}d`);
  if (extended.alosNights != null)   html = patchKpi(html, 'ALOS', extended.alosNights.toFixed(1));

  // ── Chart patches ─────────────────────────────────────────────────────
  // Daily revenue · last 90d
  if (daily90.length > 0) {
    const points = daily90.map((d: any) => ({
      night_date: String(d.night_date),
      total_rev: Number(d.rooms_revenue || 0) + Number(d.total_ancillary_revenue || 0),
    }));
    const svg = dailyRevenue90dSvg(points);
    html = replaceChartInSection(html, 'Daily revenue · last 90d', svg);
  }

  // Channel mix · 30d
  if (channels.length > 0) {
    const totalRev = channels.reduce((s: number, c: any) => s + Number(c.revenue_30d || c.revenue_90d || 0), 0);
    const groupRev = (rx: RegExp) =>
      channels
        .filter((c: any) => rx.test(String(c.source_name || '')))
        .reduce((s: number, c: any) => s + Number(c.revenue_30d || c.revenue_90d || 0), 0);

    const direct = groupRev(DIRECT_RX);
    const ota = groupRev(OTA_RX);
    const wholesale = groupRev(WHOLESALE_RX);
    const other = Math.max(0, totalRev - direct - ota - wholesale);
    const pct = (n: number) => (totalRev > 0 ? (n / totalRev) * 100 : 0);

    const slices = [
      { label: 'Direct',    pct: pct(direct),    color: '#16a34a' },
      { label: 'OTA',       pct: pct(ota),       color: '#2563eb' },
      { label: 'Wholesale', pct: pct(wholesale), color: '#d97706' },
      { label: 'Other',     pct: pct(other),     color: '#9ca3af' },
    ].filter((s) => s.pct > 0);

    if (totalRev > 0 && slices.length > 0) {
      const svg = channelMix30dSvg(slices);
      html = replaceChartInSection(html, 'Channel mix · 30d', svg);
    }
  }

  // ── Period banner ─────────────────────────────────────────────────────
  const periodBanner =
    '<div style="margin: 12px 0 16px; padding: 10px 14px; background: rgba(184,133,74,0.08); border: 1px solid rgba(184,133,74,0.35); border-radius: 6px; font-size: 12px; color: var(--text); display: flex; justify-content: space-between; align-items: center;">' +
    '<div><strong>Active period:</strong> ' + period.label + ' &middot; ' + period.rangeLabel +
    (period.cmpLabel ? ' &middot; ' + period.cmpLabel : '') +
    (period.segLabel && period.seg !== 'all' ? ' &middot; ' + period.segLabel : '') + '</div>' +
    '<div style="font-family: ui-monospace, SFMono-Regular, monospace; font-size: 11px; color: var(--text-dim);">win=' + period.win + ' &middot; cmp=' + period.cmp + ' &middot; seg=' + period.seg + ' &middot; ' + period.days + 'd</div>' +
    '</div>';
  html = html.replace(/(<div class="tab-content active"[^>]*>)/, (_m, p1: string) => p1 + periodBanner);

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
