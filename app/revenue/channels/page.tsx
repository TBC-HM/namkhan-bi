// app/revenue/channels/page.tsx
// 2026-05-21 v2 — single channels surface with sub-tabs (Direct · OTAs ·
// DMC & Bedbanks). PBS layout rule: KPI tiles → graphs → tables, per tab.
// Page-level period selector + watch chips sit above the sub-tabs; the
// 12-month structural view (tier rollup · top sources · monthly · group ·
// DMC perf) is appended at the bottom as a property-wide reference.
//
// Active sub-tab via `?tab=direct|ota|dmc` (default direct).
//
// Classification (matches mv_channel_economics.source_name):
//   DIRECT: direct / website / booking engine / email / walk-in /
//           witbooking / mews operations (in-house channels)
//   OTA:    booking.com / expedia / agoda / airbnb / hotels.com /
//           trip.com / hotelbeds.com OTAs (incl. CM-prefixed siteminder rows)
//   DMC:    hotelbeds / webbeds / sunhotels / khiri / trails / tui / jet2 /
//           bedbank / wholesale / reseller / dmc / destimo / sidetours
//
// What's still missing per tab (surfaced as inline captions, not silent):
//   · Direct: conversion rate (web visits → bookings). Needs Plausible/GA.
//   · OTA:    search visibility / content score / Genius status. Needs BDC
//             admin scrape — partial component lives at /channels/[source].
//   · DMC:    contract status + production-vs-target. cockpit.dmc_contracts
//             table not yet created.

import Link from 'next/link';
import {
  DashboardPage, Container, KpiTile, Chart,
  type ChartSeries, type DashboardTab, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import PageRenderer from '@/app/_components/registry/PageRenderer';
import GrossShareByTier from '@/app/_components/registry/GrossShareByTier';
import ChannelDrillDrawer from '@/app/_components/registry/ChannelDrillDrawer';
import ChannelControlsDropdown from '@/app/_components/registry/ChannelControlsDropdown';
import SortableSourcesTable from '@/app/_components/registry/SortableSourcesTable';
import TrendCategoryDropdown from '@/app/_components/registry/TrendCategoryDropdown';
import { resolvePeriod, type WindowKey } from '@/lib/period';
import {
  getChannelEconomics, getChannelEconomicsForRange,
  getChannelMixWeeklyTrend, getChannelNetValueForRange, getChannelVelocity28dByCat,
} from '@/lib/data-channels';
import { fmtMoney } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { REVENUE_SUBPAGES } from '../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import { getDmcContracts, matchSourceToContract } from '@/lib/dmc';

// PBS 2026-06-30: dropped force-dynamic. With it, every drawer ?drill= URL
// change triggered a full server re-render → 5-10s blank state below the slider.
// revalidate=60 keeps freshness; the drawer state (drill) is now just a URL
// param the client reads, no re-fetch.
export const revalidate = 60;

const PROPERTY_ID_NAMKHAN = 260955;

// PBS 2026-07-01: shared action-button style for the DMC/OTA/Direct performance strip.
const perfActionStyle: React.CSSProperties = {
  padding: '5px 12px',
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  fontWeight: 600,
  background: 'var(--primary, #1F3A2E)',
  color: '#FFFFFF',
  borderRadius: 4,
  textDecoration: 'none',
};

const OTA_RX = /booking\.com|expedia|agoda|airbnb|ctrip|trip\.com|hotels\.com|traveloka|a-expedia|a-hotels|bdc-|exp-/i;
// PBS #199: split Bedbanks (rate wholesalers) from DMCs (B2B tour operators)
const BEDBANK_RX = /hotelbeds|webbeds|sunhotels|bonotel|miki|destimo|sidetours|wbs-|wtb-|sun-|ago-/i;
const DMC_RX = /khiri|trails of|tui|jet2|tour operator|gta|tourico|wholesale|reseller|dmc/i;
const DIRECT_RX = /direct|website|booking engine|^email|walk[- ]?in|witbooking|whatsapp|mews operations|in person|telephone/i;
// PBS 2026-05-29 #43: GROUP catches Biig Holiday / Retreat Reseller / Vigeosport / Email Groups (cleared before DIRECT so "Email Groups" lands in Group, not Direct)
const GROUP_RX = /biig holiday|retreat reseller|vigeosport|email groups/i;

type Category = 'direct' | 'ota' | 'dmc' | 'bedbank' | 'group';

// PBS #199 v5: DMC is now the CATCH-ALL bucket — anything not Direct/OTA/Bedbank lands in DMC
// (B2B tour operators, agents, comp invitations, walk-on partners — historically dumped in "other"
// and made invisible to all tabs). "other" still exists in the type for safety but classify never returns it.
function classify(source: string): Category | 'other' {
  const s = (source || '').toLowerCase();
  if (GROUP_RX.test(s))    return 'group';   // PBS 2026-05-29 — before DIRECT so "Email Groups" routes here
  if (DIRECT_RX.test(s))   return 'direct';
  if (OTA_RX.test(s))      return 'ota';
  if (BEDBANK_RX.test(s))  return 'bedbank';
  return 'dmc'; // catch-all
}

// PBS #199: Namkhan does not have Bedbank business. Bedbank tab only on Donna (pid=1000001).
function visibleTabs(pid: number): Array<{ key: Category; label: string; tagline: string }> {
  const base: Array<{ key: Category; label: string; tagline: string }> = [
    { key: 'direct',  label: 'Direct',   tagline: 'in-house channels — best margin' },
    { key: 'ota',     label: 'OTAs',     tagline: 'Booking.com · Expedia · Agoda · …' },
    { key: 'dmc',     label: 'DMC',      tagline: 'Tour ops · agents · everything else B2B' },
  ];
  if (pid === 1000001) base.push({ key: 'bedbank', label: 'Bedbanks', tagline: 'Hotelbeds · WebBeds · Sunhotels · …' });
  base.push({ key: 'group', label: 'Groups', tagline: '4+ rooms · retreats · MICE · weddings' });
  return base;
}
const TAB_DEFS: Array<{ key: Category; label: string; tagline: string }> = [
  { key: 'direct',  label: 'Direct',   tagline: 'in-house channels — best margin' },
  { key: 'ota',     label: 'OTAs',     tagline: 'Booking.com · Expedia · Agoda · …' },
  { key: 'dmc',     label: 'DMC',      tagline: 'Tour ops · agents · everything else B2B' },
  { key: 'bedbank', label: 'Bedbanks', tagline: 'Hotelbeds · WebBeds · Sunhotels · …' },
];

interface Props { searchParams: Record<string, string | string[] | undefined>; propertyId?: number }

export default async function ChannelsPage({ searchParams, propertyId }: Props) {
  const pid = propertyId ?? PROPERTY_ID_NAMKHAN;
  const moneyCurrency: 'USD' | 'EUR' = pid === 1000001 ? 'EUR' : 'USD';
  const sym = moneyCurrency === 'EUR' ? '€' : '$';

  // note#13: per-source 24/25/26 aggregate for the full-screen-expandable table
  const { data: sourcesAllYears } = await supabase
    .from('v_chart_channels_sources_24_25_26')
    .select('category, source_name, res_24, res_25, res_26, res_total, rev_24, rev_25, rev_26, rev_total, rn_24, rn_25, rn_26, adr_24, adr_25, adr_26, avg_window_days, avg_los, sdly_dev_pct')
    .eq('property_id', pid)
    .order('category')
    .order('res_total', { ascending: false });
  // PBS 2026-05-31 #57: raw numeric mapper — SortableSourcesTable sorts on numbers and formats client-side
  const sourcesAllYearsRows = ((sourcesAllYears ?? []) as Array<Record<string, unknown>>).map((r) => ({
    category:        String(r.category ?? 'Other'),
    source:          String(r.source_name ?? 'Unknown'),
    res_24:          Number(r.res_24 ?? 0),
    res_25:          Number(r.res_25 ?? 0),
    res_26:          Number(r.res_26 ?? 0),
    rev_24:          r.rev_24 != null ? Number(r.rev_24) : null,
    rev_25:          r.rev_25 != null ? Number(r.rev_25) : null,
    rev_26:          r.rev_26 != null ? Number(r.rev_26) : null,
    adr_24:          r.adr_24 != null ? Number(r.adr_24) : null,
    adr_25:          r.adr_25 != null ? Number(r.adr_25) : null,
    adr_26:          r.adr_26 != null ? Number(r.adr_26) : null,
    rn_26:           r.rn_26 != null ? Number(r.rn_26) : 0,
    avg_window_days: r.avg_window_days != null ? Number(r.avg_window_days) : null,
    avg_los:         r.avg_los != null ? Number(r.avg_los) : null,
    sdly_dev_pct:    r.sdly_dev_pct != null ? Number(r.sdly_dev_pct) : null,
  }));
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, pid);
  const basePath = pid !== PROPERTY_ID_NAMKHAN ? `/h/${pid}/revenue/channels` : '/revenue/channels';
  const period = resolvePeriod(searchParams);

  const rawTab = String(searchParams.tab ?? 'direct').toLowerCase();
  // USALI task #12 — channel-group filter for Sources · 2024/25/26 table
  const chFilter = String(searchParams.ch ?? 'all').toLowerCase();
  const activeTab: Category = (TAB_DEFS.find((t) => t.key === rawTab)?.key) ?? 'direct';

  const cmpPeriod = period.cmp !== 'none' && period.compareFrom && period.compareTo
    ? { ...period, from: period.compareFrom, to: period.compareTo, cmp: 'none' as const }
    : null;

  const [channelsRaw, channelsCmp, mixWeekly, netValue, velocity, groupRows, dmcContracts, dmcPerfRes, otaPerfRes, directPerfRes] = await Promise.all([
    getChannelEconomics(period, pid).catch(() => [] as Awaited<ReturnType<typeof getChannelEconomics>>),
    cmpPeriod
      ? getChannelEconomicsForRange(cmpPeriod.from, cmpPeriod.to, pid).catch(() => [] as Array<Record<string, unknown>>)
      : Promise.resolve([] as Array<Record<string, unknown>>),
    getChannelMixWeeklyTrend('2025-01-01', new Date().toISOString().slice(0,10), pid).catch(() => [] as Array<Record<string, unknown>>),
    getChannelNetValueForRange(period.from, period.to, pid).catch(() => [] as Array<Record<string, unknown>>),
    getChannelVelocity28dByCat(pid).catch(() => [] as Array<Record<string, unknown>>),
    supabase.from('v_group_bookings_12mo').select('channel_group, source, reservations, room_nights, gross_revenue, group_adr, est_commission, net_revenue').eq('property_id', pid).order('gross_revenue', { ascending: false }).then((r) => r.data ?? [] as Array<Record<string, unknown>>),
    // PBS 2026-06-29: fetch DMC contracts so ChannelDrillDrawer can surface contract metadata + PDF preview when a source matches a partner.
    getDmcContracts().catch(() => []),
    // PBS 2026-07-01: top-8 performance tables under the KPI strip — DMC + OTA + Direct.
    supabase.from('v_dmc_performance').select('partner_short_name, country, production_status, res_12mo, rn_12mo, gross_12mo').eq('property_id', pid).order('gross_12mo', { ascending: false }).limit(8).then((r) => ({ data: (r.data ?? []) as Array<Record<string, unknown>> })).catch(() => ({ data: [] as Array<Record<string, unknown>> })),
    supabase.from('v_ota_performance').select('source_name, production_status, res_12mo, rn_12mo, gross_12mo, last_booking').eq('property_id', pid).order('gross_12mo', { ascending: false }).limit(8).then((r) => ({ data: (r.data ?? []) as Array<Record<string, unknown>> })).catch(() => ({ data: [] as Array<Record<string, unknown>> })),
    supabase.from('v_direct_performance').select('source_name, production_status, res_12mo, rn_12mo, gross_12mo, last_booking').eq('property_id', pid).order('gross_12mo', { ascending: false }).limit(8).then((r) => ({ data: (r.data ?? []) as Array<Record<string, unknown>> })).catch(() => ({ data: [] as Array<Record<string, unknown>> })),
  ]);
  const dmcPerfTop = dmcPerfRes.data;
  const otaPerfTop = otaPerfRes.data;
  const directPerfTop = directPerfRes.data;
  const channels = channelsRaw;

  // PBS 2026-06-30: append DMC partners that have NO PMS bookings to the
  // Sources · 2024/25/26 table so every contract is clickable from the
  // master channels table (not just sources with revenue history).
  if (dmcContracts.length > 0) {
    const matchedContractIds = new Set<string>();
    for (const r of sourcesAllYearsRows) {
      const m = matchSourceToContract(r.source, dmcContracts);
      if (m.contract_id) matchedContractIds.add(m.contract_id);
    }
    for (const c of dmcContracts) {
      if (matchedContractIds.has(c.contract_id)) continue;
      sourcesAllYearsRows.push({
        category: 'dmc',
        source: c.partner_short_name,
        res_24: 0, res_25: 0, res_26: 0,
        rev_24: null, rev_25: null, rev_26: null,
        adr_24: null, adr_25: null, adr_26: null,
        rn_26: 0,
        avg_window_days: null,
        avg_los: null,
        sdly_dev_pct: null,
      });
    }
  }

  // PBS 2026-06-30: filteredSources computed AFTER DMC contracts are merged.
  const filteredSources = chFilter === 'all'
    ? sourcesAllYearsRows
    : chFilter === 'rest'
    ? sourcesAllYearsRows.filter((r) => !['direct','ota','dmc'].includes(String(r.category).toLowerCase()))
    : sourcesAllYearsRows.filter((r) => String(r.category).toLowerCase() === chFilter);

  // PBS 2026-05-31 #55: trend category — if ?cat= is set, read per-category view (v_channel_trend_by_category_monthly); else aggregate (v_channels_all_time_trend)
  const trendCatRaw = String(searchParams.cat ?? 'all').toLowerCase();
  const trendCat: 'all' | 'direct' | 'ota' | 'bedbank' | 'dmc' | 'group' =
    (['all','direct','ota','bedbank','dmc','group'].includes(trendCatRaw) ? trendCatRaw : 'all') as 'all' | 'direct' | 'ota' | 'bedbank' | 'dmc' | 'group';
  const allTimeTrend = (trendCat === 'all'
    ? await supabase
        .from('v_channels_all_time_trend')
        .select('period_yyyymm, bookings, room_nights, total_revenue, adr, revpar')
        .eq('property_id', pid)
        .order('period_yyyymm', { ascending: true })
        .then((r) => r.data ?? [])
    : await supabase
        .from('v_channel_trend_by_category_monthly')
        .select('period_yyyymm, bookings, room_nights, total_revenue, adr, revpar')
        .eq('property_id', pid)
        .eq('category', trendCat)
        .order('period_yyyymm', { ascending: true })
        .then((r) => r.data ?? [])) as Array<Record<string, unknown>>;
  const trendRows = allTimeTrend.map((r) => ({
    month: String(r.period_yyyymm ?? ''),
    revenue: Number(r.total_revenue ?? 0),
    adr: Number(r.adr ?? 0),
    revpar: Number(r.revpar ?? 0),
    roomNights: Number(r.room_nights ?? 0),
  }));

  // Group all channels by category
  const byCat: Record<Category | 'other', typeof channels> = { direct: [], ota: [], dmc: [], bedbank: [], group: [], other: [] };
  for (const c of channels) byCat[classify(String(c.source_name || ''))].push(c);

  // Page-level mix tiles (across all categories)
  const totalRev = channels.reduce((s, c) => s + Number(c.gross_revenue || 0), 0);
  const sumRev = (rows: typeof channels) => rows.reduce((s, c) => s + Number(c.gross_revenue || 0), 0);
  const mixPct = (rows: typeof channels) => (totalRev ? (sumRev(rows) / totalRev) * 100 : 0);

  const pageMixTiles: KpiTileProps[] = [
    { label: 'Direct mix',  value: `${mixPct(byCat.direct).toFixed(1)}%`, size: 'sm', footnote: `${byCat.direct.length} sources · target ≥ 30%`, status: mixPct(byCat.direct) >= 30 ? 'green' : 'amber' },
    { label: 'OTA mix',     value: `${mixPct(byCat.ota).toFixed(1)}%`,    size: 'sm', footnote: `${byCat.ota.length} sources · lower = less commission drag`, status: 'amber' },
    { label: 'DMC mix',     value: `${mixPct(byCat.dmc).toFixed(1)}%`,    size: 'sm', footnote: `${byCat.dmc.length} sources · tour ops + B2B agents`, status: 'amber' },
    { label: 'Bedbank mix', value: `${mixPct(byCat.bedbank).toFixed(1)}%`,size: 'sm', footnote: `${byCat.bedbank.length} sources · net-rate exposure`, status: byCat.bedbank.length > 0 ? 'amber' : 'grey' },
    // PBS 2026-05-29 #53: Group mix tile — share of period revenue (matches Direct/OTA/DMC/Bedbank mix pattern)
    { label: 'Group mix',   value: `${mixPct(byCat.group).toFixed(1)}%`, size: 'sm', footnote: `${byCat.group.length} sources · MICE · retreats · weddings`, status: mixPct(byCat.group) >= 15 ? 'green' : byCat.group.length > 0 ? 'amber' : 'grey' },
    { label: `Revenue · ${period.label}`, value: Math.round(totalRev), currency: moneyCurrency, size: 'sm', footnote: `${channels.length} active sources` },
  ];

  // Page-level watch chips (cross-cutting)
  const totalCommission = channels.reduce((s, c) => s + Number(c.commission_usd || 0), 0);
  const commissionPctOfRev = totalRev ? (totalCommission / totalRev) * 100 : 0;
  let worstCancel = { name: '', pct: 0 };
  channels.forEach((c) => {
    const pct = Number(c.cancel_pct || 0);
    if (pct > worstCancel.pct && Number(c.bookings || 0) >= 3) worstCancel = { name: String(c.source_name), pct };
  });
  const chips: string[] = [];
  if (worstCancel.name && worstCancel.pct > 25) chips.push(`⚠ Cancel watch · ${worstCancel.name} ${worstCancel.pct.toFixed(1)}%`);
  if (commissionPctOfRev > 12) chips.push(`⚠ Commission load · ${commissionPctOfRev.toFixed(1)}% of rev (${fmtMoney(totalCommission, 'USD')})`);

  const tabs: DashboardTab[] = subPages.map((s) => ({ key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/channels') }));
  // PBS 2026-05-29 #56: URL builders preserve ALL existing searchParams and only override the targeted key (prior versions dropped ch/gst_month/etc on click)
  const buildHref = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams as Record<string, string | string[] | undefined>)) {
      if (typeof v === 'string' && v) p.set(k, v);
    }
    for (const [k, v] of Object.entries(overrides)) {
      if (v == null || v === '') p.delete(k);
      else p.set(k, v);
    }
    const qs = p.toString();
    return `${basePath}${qs ? '?' + qs : ''}`;
  };
  const hrefFor      = (newWin: WindowKey) => buildHref({ win: newWin === '30d' ? '' : newWin });
  const tabHrefFor   = (newTab: Category)  => buildHref({ tab: newTab === 'direct' ? '' : newTab });
  // PBS 2026-06-30: skip the drawer — source rows jump straight to the
  // full per-source landing page (merged DMC + channel surface).
  const drillHrefFor = (source: string)    => `${basePath}/${encodeURIComponent(source)}`;

  return (
    <DashboardPage
      title="Revenue · Channels"
      subtitle={`Channel performance · ${period.label} · ${channels.length} active sources across ${[byCat.direct, byCat.ota, byCat.dmc].filter((g) => g.length > 0).length} categories`}
      tabs={tabs}
    >
      {/* USALI tasks #14+15 — slim all-time trend (Revenue + ADR since data start) + snapshot scaffold footer */}
      <div style={{ gridColumn: '1 / -1', marginBottom: 8 }}>
        <Container title={`All-time channels trend · ${trendCat === 'all' ? 'all channels' : trendCat.toUpperCase()} · ${trendRows.length} months on record`} subtitle="Revenue + ADR per month since the earliest reservation · scaffold ready for snapshot SDLY overlay">
          <div style={{ padding: '8px 14px 0', display: 'flex', justifyContent: 'flex-end' }}>
            <TrendCategoryDropdown basePath={basePath} current={trendCat} options={[{ label: 'All channels', value: 'all' }, { label: 'Direct', value: 'direct' }, { label: 'OTA', value: 'ota' }, { label: 'Bedbanks', value: 'bedbank' }, { label: 'DMC', value: 'dmc' }, { label: 'Groups', value: 'group' }]} />
          </div>
          {trendRows.length === 0 ? (
            <div style={{ padding: 14, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
              No data on file for property {pid}.
            </div>
          ) : (
            <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)', marginBottom: 4 }}>Revenue · {sym} per month</div>
                <Chart variant="line" data={trendRows} xKey="month"
                  series={[{ key: 'revenue', label: `Revenue (${sym})`, color: 'var(--primary, #1F3A2E)' }]}
                  height={140}
                  empty={{ title: 'No revenue data' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)', marginBottom: 4 }}>ADR · {sym} per month</div>
                <Chart variant="line" data={trendRows} xKey="month"
                  series={[{ key: 'adr', label: `ADR (${sym})`, color: 'var(--terracotta, #B8542A)' }]}
                  height={140}
                  empty={{ title: 'No ADR data' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)', marginBottom: 4 }}>RevPAR · {sym} per month</div>
                <Chart variant="line" data={trendRows} xKey="month"
                  series={[{ key: 'revpar', label: `RevPAR (${sym})`, color: 'var(--sand, #B8A878)' }]}
                  height={140}
                  empty={{ title: 'No RevPAR data' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)', marginBottom: 4 }}>Sold room-nights · per month</div>
                <Chart variant="line" data={trendRows} xKey="month"
                  series={[{ key: 'roomNights', label: 'Sold room-nights', color: 'var(--primary, #1F3A2E)' }]}
                  height={140}
                  empty={{ title: 'No room-night data' }} />
              </div>
            </div>
          )}
          <div style={{ padding: '4px 14px 12px', fontSize: 11, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
            Snapshot scaffold: per-day OTB snapshots from <code>pms.otb_snapshots</code> are not yet ingested. Once shipped, a snapshot SDLY overlay will appear alongside the live line.
          </div>
        </Container>
      </div>

      {/* PBS #199 strip-1 (2026-05-25): Headline channel-mix is now a flat strip (no Container chrome). Selectors on row 1, KPI tiles on row 2. */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0 10px', borderBottom: '1px solid var(--hairline, #E6DFCC)' }}>
        <div style={{ marginBottom: 12 }}>
          <ChannelControlsDropdown
            basePath={basePath}
            windowOptions={[
              { label: '7 days',     value: '7d'   },
              { label: '30 days',    value: '30d'  },
              { label: '90 days',    value: '90d'  },
              { label: 'YTD',        value: 'ytd'  },
              { label: 'Last 365',   value: 'l12m' },
              { label: 'Last year',  value: 'ly'   },
            ]}
            currentWindow={period.win}
            defaultWindow="30d"
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {pageMixTiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>
      </div>

      {/* PBS 2026-07-01 rev2: 3 categories rolled into ONE compact comparison
          grid — same numbers, ~1/3 the vertical space, easier to scan side-by-side. */}
      <CategoryCompareGrid
        period={period}
        totalRev={totalRev}
        moneyCurrency={moneyCurrency}
        rows={{
          direct: byCat.direct as unknown as Array<Record<string, unknown>>,
          ota:    byCat.ota    as unknown as Array<Record<string, unknown>>,
          dmc:    byCat.dmc    as unknown as Array<Record<string, unknown>>,
          group:  byCat.group  as unknown as Array<Record<string, unknown>>,
        }}
      />

      {activeTab === 'direct' && <CategoryBlock category="direct" rows={byCat.direct as unknown as Array<Record<string, unknown>>} cmpRows={(channelsCmp as Array<Record<string, unknown>>).filter((c) => classify(String(c.source_name || '')) === 'direct')} mixWeekly={mixWeekly as unknown as Array<Record<string, unknown>>} velocity={velocity as unknown as Array<Record<string, unknown>>} period={period} totalRev={totalRev} netValue={(netValue as unknown as Array<Record<string, unknown>>).filter((r) => classify(String(r.source_name || r.channel || '')) === 'direct')} drillHrefFor={drillHrefFor} moneyCurrency={moneyCurrency} propertyId={pid} />}
      {activeTab === 'ota'    && <CategoryBlock category="ota"    rows={byCat.ota as unknown as Array<Record<string, unknown>>}    cmpRows={(channelsCmp as Array<Record<string, unknown>>).filter((c) => classify(String(c.source_name || '')) === 'ota')}    mixWeekly={mixWeekly as unknown as Array<Record<string, unknown>>} velocity={velocity as unknown as Array<Record<string, unknown>>} period={period} totalRev={totalRev} netValue={(netValue as unknown as Array<Record<string, unknown>>).filter((r) => classify(String(r.source_name || r.channel || '')) === 'ota')} drillHrefFor={drillHrefFor} moneyCurrency={moneyCurrency} propertyId={pid} />}
      {activeTab === 'dmc'    && <CategoryBlock category="dmc"    rows={byCat.dmc as unknown as Array<Record<string, unknown>>}    cmpRows={(channelsCmp as Array<Record<string, unknown>>).filter((c) => classify(String(c.source_name || '')) === 'dmc')}    mixWeekly={mixWeekly as unknown as Array<Record<string, unknown>>} velocity={velocity as unknown as Array<Record<string, unknown>>} period={period} totalRev={totalRev} netValue={(netValue as unknown as Array<Record<string, unknown>>).filter((r) => classify(String(r.source_name || r.channel || '')) === 'dmc')} drillHrefFor={drillHrefFor} moneyCurrency={moneyCurrency} propertyId={pid} />}
      {activeTab === 'bedbank' && pid === 1000001 && <CategoryBlock category="bedbank" rows={byCat.bedbank as unknown as Array<Record<string, unknown>>} cmpRows={(channelsCmp as Array<Record<string, unknown>>).filter((c) => classify(String(c.source_name || '')) === 'bedbank')} mixWeekly={mixWeekly as unknown as Array<Record<string, unknown>>} velocity={velocity as unknown as Array<Record<string, unknown>>} period={period} totalRev={totalRev} netValue={(netValue as unknown as Array<Record<string, unknown>>).filter((r) => classify(String(r.source_name || r.channel || '')) === 'bedbank')} drillHrefFor={drillHrefFor} moneyCurrency={moneyCurrency} propertyId={pid} />}
      {/* PBS 2026-05-29 #43: Groups tab wired via CategoryBlock — byCat.group now populated by classify() match on Biig Holiday / Retreat Reseller / Vigeosport / Email Groups */}
      {activeTab === 'group' && <CategoryBlock category="group" rows={byCat.group as unknown as Array<Record<string, unknown>>} cmpRows={(channelsCmp as Array<Record<string, unknown>>).filter((c) => classify(String(c.source_name || '')) === 'group')} mixWeekly={mixWeekly as unknown as Array<Record<string, unknown>>} velocity={velocity as unknown as Array<Record<string, unknown>>} period={period} totalRev={totalRev} netValue={(netValue as unknown as Array<Record<string, unknown>>).filter((r) => classify(String(r.source_name || r.channel || '')) === 'group')} drillHrefFor={drillHrefFor} moneyCurrency={moneyCurrency} propertyId={pid} />}

      {/* PBS 2026-07-01 rev2: top-8 performance row (DMC · OTA · Direct) now sits
          UNDER the CategoryBlock (which owns the category KPI tile header row).
          Order: main mix tiles → CategoryBlock (its own tile header) → perf strip. */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        <Container
          title="DMC Performance"
          subtitle="12 months · top 8 by gross"
          action={<Link href="/sales/b2b" style={perfActionStyle}>B2B / DMC →</Link>}
        >
          <Chart variant="table" data={dmcPerfTop} xKey="partner_short_name"
            series={[
              { key: 'country',           label: 'Ctry' },
              { key: 'production_status', label: 'Status' },
              { key: 'res_12mo',          label: 'Res' },
              { key: 'rn_12mo',           label: 'RN' },
              { key: 'gross_12mo',        label: 'Gross' },
            ]}
            height={220} empty={{ title: 'No DMC contracts on file' }} />
        </Container>
        <Container
          title="OTA Performance"
          subtitle="12 months · top 8 by gross"
        >
          <Chart variant="table" data={otaPerfTop} xKey="source_name"
            series={[
              { key: 'production_status', label: 'Status' },
              { key: 'res_12mo',          label: 'Res' },
              { key: 'rn_12mo',           label: 'RN' },
              { key: 'gross_12mo',        label: 'Gross' },
              { key: 'last_booking',      label: 'Last bkg' },
            ]}
            height={220} empty={{ title: 'No OTA bookings in the last 12 months' }} />
        </Container>
        <Container
          title="Direct Performance"
          subtitle="12 months · top 8 by gross"
        >
          <Chart variant="table" data={directPerfTop} xKey="source_name"
            series={[
              { key: 'production_status', label: 'Status' },
              { key: 'res_12mo',          label: 'Res' },
              { key: 'rn_12mo',           label: 'RN' },
              { key: 'gross_12mo',        label: 'Gross' },
              { key: 'last_booking',      label: 'Last bkg' },
            ]}
            height={220} empty={{ title: 'No Direct bookings in the last 12 months' }} />
        </Container>
      </div>

      {/* PBS #199 fix-2: top-level Sources · 2024/2025/2026 table is ALSO clickable. Click any source to open the drawer. */}
      <div style={{ gridColumn: '1 / -1' }}>
        {/* USALI task #12 — channel-group filter chips (ADD-only sibling, sits ABOVE the Container) */}
        <div style={{ padding: '8px 14px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)' }}>Filter</div>
          {[{ k: 'all', label: 'All' }, { k: 'direct', label: 'Direct' }, { k: 'ota', label: 'OTA' }, { k: 'dmc', label: 'DMC' }, { k: 'rest', label: 'Rest' }].map((c) => {
            const isActive = c.k === chFilter || (c.k === 'all' && chFilter === 'all');
            const params = new URLSearchParams();
            for (const [k, v] of Object.entries(searchParams as Record<string, string | string[] | undefined>)) {
              if (k === 'ch') continue;
              if (typeof v === 'string' && v) params.set(k, v);
            }
            if (c.k !== 'all') params.set('ch', c.k);
            const qs = params.toString();
            return (
              <Link key={c.k} href={qs ? `?${qs}` : '?'} style={{
                fontSize: 12, padding: '3px 10px', borderRadius: 4,
                border: `1px solid ${isActive ? 'var(--primary, #1F3A2E)' : 'var(--hairline, #E6DFCC)'}`,
                background: isActive ? 'var(--primary, #1F3A2E)' : 'var(--paper, #FFFFFF)',
                color: isActive ? 'var(--paper, #FFFFFF)' : 'var(--ink, #1B1B1B)',
                textDecoration: 'none', fontWeight: isActive ? 600 : 400,
              }}>{c.label}</Link>
            );
          })}
        </div>
        <Container title={`Sources · 2024 / 2025 / 2026 · ${filteredSources.length} of ${sourcesAllYearsRows.length} sources`} subtitle="every active source since 2024, grouped Direct / OTA / DMC. Click any source name to open the drawer.">
          {filteredSources.length === 0 ? (
            <div style={{ padding: 16, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>No sources data</div>
          ) : (
            <SortableSourcesTable
              rows={filteredSources.map((r) => ({ ...r, drillHref: drillHrefFor(r.source) }))}
              moneyCurrency={moneyCurrency}
            />
          )}
        </Container>
      </div>

      {/* PBS #126 (2026-05-24): 9-piece split. PageRenderer in embedded mode renders the 9 registry
          children as direct siblings of the host DashboardPage — no nested DashboardPage, no outer wrap. */}
      <PageRenderer pageSlug="channel" propertyId={pid} title="" subtitle="" embedded />

      {/* PBS 2026-05-29 — Gross share by tier moved inline into CategoryBlock row 2 */}

      {/* PBS #199 — click a row in any sources table to open this drawer; CTA → full per-channel page (Booking.com hardwired Bdc* panels render there). */}
      <ChannelDrillDrawer
        rows={[...byCat.direct, ...byCat.ota, ...byCat.dmc, ...byCat.other].map((c) => ({
          source_name:   String(c.source_name || ''),
          bookings:      Number(c.bookings || 0),
          gross_revenue: Number(c.gross_revenue || 0),
          adr:           Number(c.adr || 0),
          commission_pct: Number(c.commission_pct || 0),
          cancel_pct:    Number(c.cancel_pct || 0),
          avg_lead_days: Number(c.avg_lead_days || 0),
          avg_los:       Number(c.avg_los || 0),
          roomnights:    Number(c.roomnights || 0),
        }))}
        currencyCode={moneyCurrency}
        basePath={basePath}
        dmcContracts={dmcContracts}
      />
    </DashboardPage>
  );
}

// ─── compact 3-row comparison grid (Direct · OTAs · DMC) ────────────────────
// PBS 2026-07-01 rev2: dense side-by-side read of all 3 categories in one
// table-like card. Rows = categories, columns = metrics. Replaces the earlier
// stacked "one full KPI strip per category" layout (too much space).
function CategoryCompareGrid({
  rows, moneyCurrency, totalRev, period,
}: {
  rows: {
    direct: Array<Record<string, unknown>>;
    ota:    Array<Record<string, unknown>>;
    dmc:    Array<Record<string, unknown>>;
    group:  Array<Record<string, unknown>>;
  };
  moneyCurrency: 'USD' | 'EUR';
  totalRev: number;
  period: { label: string };
}) {
  const sym = moneyCurrency === 'EUR' ? '€' : '$';
  const compute = (list: Array<Record<string, unknown>>) => {
    const bookings   = list.reduce((s, c) => s + Number(c.bookings || 0), 0);
    const revenue    = list.reduce((s, c) => s + Number(c.gross_revenue || 0), 0);
    const roomnights = list.reduce((s, c) => s + Number(c.roomnights || 0), 0);
    const commission = list.reduce((s, c) => s + Number(c.commission_usd || 0), 0);
    const cancellations = list.reduce((s, c) => s + Number(c.cancellations || 0), 0);
    const adr        = roomnights > 0 ? revenue / roomnights : 0;
    const commPct    = revenue > 0 ? (commission / revenue) * 100 : 0;
    const netAdr     = adr * (1 - commPct / 100);
    const totalB     = bookings + cancellations;
    const cancelPct  = totalB > 0 ? (cancellations / totalB) * 100 : 0;
    const shareRev   = totalRev > 0 ? (revenue / totalRev) * 100 : 0;
    const leadW      = list.reduce((s, c) => s + Number(c.bookings || 0) * Number(c.avg_lead_days || 0), 0);
    const avgLead    = bookings > 0 ? leadW / bookings : 0;
    const sources    = list.length;
    return { bookings, revenue, adr, commPct, netAdr, cancelPct, shareRev, avgLead, sources };
  };

  const D = compute(rows.direct);
  const O = compute(rows.ota);
  const M = compute(rows.dmc);
  const G = compute(rows.group);

  const money = (n: number) => `${sym}${Math.round(n).toLocaleString('en-US')}`;
  const pct = (n: number) => `${n.toFixed(1)}%`;

  // 8 columns: category | Sources | Bkg | Rev | ADR | Comm% | Cancel% | Share%
  const headerCell: React.CSSProperties = {
    padding: '6px 10px', textAlign: 'right', fontFamily: 'var(--mono, monospace)',
    fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
    color: '#5A5A5A', fontWeight: 600, borderBottom: '1px solid #E6DFCC',
  };
  const bodyCell: React.CSSProperties = {
    padding: '8px 10px', textAlign: 'right', fontSize: 13,
    color: '#1B1B1B', fontVariantNumeric: 'tabular-nums',
    borderBottom: '1px solid #E6DFCC',
  };
  const labelCell: React.CSSProperties = {
    padding: '8px 10px', textAlign: 'left', fontSize: 13,
    color: '#1B1B1B', fontWeight: 600, borderBottom: '1px solid #E6DFCC',
  };

  const commTone = (c: number) => c > 18 ? '#B03826' : c > 12 ? '#B8542A' : '#2C5F4F';
  const cancelTone = (c: number) => c > 25 ? '#B03826' : c > 10 ? '#B8542A' : '#2C5F4F';
  const shareTone = (c: number) => c >= 30 ? '#2C5F4F' : '#B8542A';

  const row = (name: string, stats: ReturnType<typeof compute>) => (
    <tr>
      <td style={labelCell}>{name} <span style={{ color: '#8A8A8A', fontWeight: 400, fontSize: 11 }}>· {stats.sources} sources</span></td>
      <td style={bodyCell}>{stats.bookings.toLocaleString('en-US')}</td>
      <td style={bodyCell}>{money(stats.revenue)}</td>
      <td style={bodyCell}>{money(stats.adr)}</td>
      <td style={bodyCell}>{money(stats.netAdr)}</td>
      <td style={{ ...bodyCell, color: commTone(stats.commPct) }}>{pct(stats.commPct)}</td>
      <td style={{ ...bodyCell, color: cancelTone(stats.cancelPct) }}>{pct(stats.cancelPct)}</td>
      <td style={{ ...bodyCell, color: shareTone(stats.shareRev) }}>{pct(stats.shareRev)}</td>
      <td style={bodyCell}>{Math.round(stats.avgLead)}d</td>
    </tr>
  );

  return (
    <div style={{ gridColumn: '1 / -1', background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
      <div style={{ padding: '10px 14px 6px', borderBottom: '1px solid #E6DFCC' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5A5A5A', fontWeight: 600 }}>
          Category compare · {period.label}
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--sans)' }}>
        <thead>
          <tr>
            <th style={{ ...headerCell, textAlign: 'left' }}>Category</th>
            <th style={headerCell}>Bkg</th>
            <th style={headerCell}>Revenue</th>
            <th style={headerCell}>ADR</th>
            <th style={headerCell}>Net ADR</th>
            <th style={headerCell}>Comm %</th>
            <th style={headerCell}>Cancel %</th>
            <th style={headerCell}>Share %</th>
            <th style={headerCell}>Lead</th>
          </tr>
        </thead>
        <tbody>
          {row('Direct', D)}
          {row('OTAs',   O)}
          {row('DMC',    M)}
          {row('Groups', G)}
        </tbody>
      </table>
    </div>
  );
}

// ─── per-category KPI strip (mini-header + tile grid) — kept for reference ──
// PBS 2026-07-01: extracted from CategoryBlock so the same tile row can render
// for Direct, OTA, and DMC simultaneously (stacked), regardless of active tab.
// PBS 2026-07-01 rev2: superseded by CategoryCompareGrid above (too much space).
// Left in the file in case a future ask wants the full-tile version back.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CategoryKpiStrip({
  category, rows, cmpRows, moneyCurrency, totalRev, period,
}: {
  category: Category;
  rows: Array<Record<string, unknown>>;
  cmpRows: Array<Record<string, unknown>>;
  moneyCurrency: 'USD' | 'EUR';
  totalRev: number;
  period: { label: string };
}) {
  const bookings   = rows.reduce((s, c) => s + Number(c.bookings || 0), 0);
  const revenue    = rows.reduce((s, c) => s + Number(c.gross_revenue || 0), 0);
  const roomnights = rows.reduce((s, c) => s + Number(c.roomnights || 0), 0);
  const commission = rows.reduce((s, c) => s + Number(c.commission_usd || 0), 0);
  const adr        = roomnights > 0 ? revenue / roomnights : 0;
  const commPct    = revenue > 0 ? (commission / revenue) * 100 : 0;
  const netAdr     = adr * (1 - commPct / 100);
  const cancelPctTotal = (() => {
    const totalB = rows.reduce((s, c) => s + Number(c.bookings || 0) + Number(c.cancellations || 0), 0);
    const cx    = rows.reduce((s, c) => s + Number(c.cancellations || 0), 0);
    return totalB > 0 ? (cx / totalB) * 100 : 0;
  })();
  const leadWeighted = rows.reduce((s, c) => s + Number(c.bookings || 0) * Number(c.avg_lead_days || 0), 0);
  const avgLead    = bookings > 0 ? leadWeighted / bookings : 0;
  const shareOfRev = totalRev > 0 ? (revenue / totalRev) * 100 : 0;

  const cmpBookings = cmpRows.reduce((s, c) => s + Number(c.bookings || 0), 0);
  const cmpRevenue  = cmpRows.reduce((s, c) => s + Number(c.gross_revenue || 0), 0);
  const cmpRoomnights = cmpRows.reduce((s, c) => s + Number(c.roomnights || 0), 0);
  const cmpAdr = cmpRoomnights > 0 ? cmpRevenue / cmpRoomnights : 0;
  const cmpCommission = cmpRows.reduce((s, c) => s + Number(c.commission_usd || 0), 0);
  const cmpCommPct = cmpRevenue > 0 ? (cmpCommission / cmpRevenue) * 100 : 0;
  const hasCmp = cmpRows.length > 0;
  const dPct = (a: number, b: number) => b > 0 ? ((a - b) / b) * 100 : 0;

  const titleOf: Record<Category, string> = {
    direct: 'Direct', ota: 'OTAs', dmc: 'DMC', bedbank: 'Bedbanks', group: 'Groups',
  };

  const tiles: KpiTileProps[] = (() => {
    if (category === 'direct') {
      return [
        { label: 'Bookings',        value: bookings, size: 'sm', delta: hasCmp ? { value: dPct(bookings, cmpBookings), period: 'cmp', direction: bookings >= cmpBookings ? 'up' : 'down' } : undefined },
        { label: 'Revenue',         value: Math.round(revenue), currency: moneyCurrency, size: 'sm', delta: hasCmp ? { value: dPct(revenue, cmpRevenue), period: 'cmp', direction: revenue >= cmpRevenue ? 'up' : 'down' } : undefined },
        { label: 'ADR',             value: Math.round(adr), currency: moneyCurrency, size: 'sm', delta: hasCmp ? { value: dPct(adr, cmpAdr), period: 'cmp', direction: adr >= cmpAdr ? 'up' : 'down' } : undefined },
        { label: 'Share of revenue', value: `${shareOfRev.toFixed(1)}%`, size: 'sm', footnote: 'target ≥ 30%', status: shareOfRev >= 30 ? 'green' : 'amber' },
        { label: 'Avg lead time',   value: `${avgLead.toFixed(0)}d`, size: 'sm', footnote: 'booking-weighted' },
      ];
    }
    if (category === 'ota') {
      return [
        { label: 'Bookings',   value: bookings, size: 'sm', delta: hasCmp ? { value: dPct(bookings, cmpBookings), period: 'cmp', direction: bookings >= cmpBookings ? 'up' : 'down' } : undefined },
        { label: 'Revenue',    value: Math.round(revenue), currency: moneyCurrency, size: 'sm' },
        { label: 'ADR (gross)', value: Math.round(adr), currency: moneyCurrency, size: 'sm' },
        { label: 'Commission %', value: `${commPct.toFixed(1)}%`, size: 'sm', footnote: hasCmp ? `cmp ${cmpCommPct.toFixed(1)}%` : 'lower is better', status: commPct > 18 ? 'red' : commPct > 12 ? 'amber' : 'green' },
        { label: 'Net ADR',    value: Math.round(netAdr), currency: moneyCurrency, size: 'sm', footnote: 'gross × (1 − comm%)' },
        { label: 'Cancel rate', value: `${cancelPctTotal.toFixed(1)}%`, size: 'sm', status: cancelPctTotal > 25 ? 'red' : 'amber' },
      ];
    }
    return [
      { label: 'Bookings', value: bookings, size: 'sm', delta: hasCmp ? { value: dPct(bookings, cmpBookings), period: 'cmp', direction: bookings >= cmpBookings ? 'up' : 'down' } : undefined },
      { label: 'Revenue',  value: Math.round(revenue), currency: moneyCurrency, size: 'sm', delta: hasCmp ? { value: dPct(revenue, cmpRevenue), period: 'cmp', direction: revenue >= cmpRevenue ? 'up' : 'down' } : undefined },
      { label: 'ADR',      value: Math.round(adr), currency: moneyCurrency, size: 'sm', delta: hasCmp ? { value: dPct(adr, cmpAdr), period: 'cmp', direction: adr >= cmpAdr ? 'up' : 'down' } : undefined, footnote: 'pre-commission net rate' },
      { label: 'Avg lead time', value: `${avgLead.toFixed(0)}d`, size: 'sm', footnote: 'usually longer for B2B' },
      { label: 'Active contracts', value: rows.length, size: 'sm', footnote: 'distinct sources w/ bookings' },
    ];
  })();

  return (
    <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 0 10px', borderBottom: '1px solid var(--hairline, #E6DFCC)' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)' }}>
        {titleOf[category]} · {period.label} · {rows.length} active sources
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
      </div>
    </div>
  );
}

// ─── per-category block ──────────────────────────────────────────────────────
async function CategoryBlock({
  category, rows, cmpRows, mixWeekly, velocity, period, totalRev, netValue, moneyCurrency, drillHrefFor, propertyId,
}: {
  category: Category;
  rows: Array<Record<string, unknown>>;
  cmpRows: Array<Record<string, unknown>>;
  mixWeekly: Array<Record<string, unknown>>;
  velocity:  Array<Record<string, unknown>>;
  period: { label: string; from: string; to: string };
  totalRev: number;
  netValue: Array<Record<string, unknown>>;
  moneyCurrency: 'USD' | 'EUR';
  drillHrefFor: (source: string) => string;
  propertyId: number;
}) {
  const bookings = rows.reduce((s, c) => s + Number(c.bookings || 0), 0);
  const revenue  = rows.reduce((s, c) => s + Number(c.gross_revenue || 0), 0);
  const roomnights = rows.reduce((s, c) => s + Number(c.roomnights || 0), 0);
  const commission = rows.reduce((s, c) => s + Number(c.commission_usd || 0), 0);
  const adr = roomnights > 0 ? revenue / roomnights : 0;
  const commPct = revenue > 0 ? (commission / revenue) * 100 : 0;
  const netAdr = adr * (1 - commPct / 100);
  const cancelPctTotal = (() => {
    const totalB = rows.reduce((s, c) => s + Number(c.bookings || 0) + Number(c.cancellations || 0), 0);
    const cx    = rows.reduce((s, c) => s + Number(c.cancellations || 0), 0);
    return totalB > 0 ? (cx / totalB) * 100 : 0;
  })();
  const leadWeighted = rows.reduce((s, c) => s + Number(c.bookings || 0) * Number(c.avg_lead_days || 0), 0);
  const avgLead = bookings > 0 ? leadWeighted / bookings : 0;
  const shareOfRev = totalRev > 0 ? (revenue / totalRev) * 100 : 0;

  // Compare deltas
  const cmpBookings = cmpRows.reduce((s, c) => s + Number(c.bookings || 0), 0);
  const cmpRevenue  = cmpRows.reduce((s, c) => s + Number(c.gross_revenue || 0), 0);
  const cmpCommission = cmpRows.reduce((s, c) => s + Number(c.commission_usd || 0), 0);
  const cmpRoomnights = cmpRows.reduce((s, c) => s + Number(c.roomnights || 0), 0);
  const cmpAdr = cmpRoomnights > 0 ? cmpRevenue / cmpRoomnights : 0;
  const cmpCommPct = cmpRevenue > 0 ? (cmpCommission / cmpRevenue) * 100 : 0;
  const hasCmp = cmpRows.length > 0;
  const dPct = (a: number, b: number) => b > 0 ? ((a - b) / b) * 100 : 0;

  const titleOf: Record<Category, string> = {
    direct:  'Direct',
    ota:     'OTAs',
    dmc:     'DMC',
    bedbank: 'Bedbanks',
    group:   'Groups',
  };
  const missingNote: Record<Category, string> = {
    direct:  '↪ Conversion rate (visits → bookings) and returning-guest direct % — owed by Plausible / GA integration + cross-join to pms.guests_mews.',
    ota:     '↪ Search visibility · content score · Genius status — owed by BDC admin scrape (component scaffold at /channels/[source]).',
    dmc:     '↪ Contract status · net-rate vs published rack · production-vs-target — owed by cockpit.dmc_contracts table.',
    bedbank: '↪ Net-rate vs rack contract terms · allotment uplift · stop-sell breach — owed by cockpit.bedbank_contracts table.',
    group:   '↪ Group bookings (weddings · MICE · retreats) — sourced from v_group_bookings_12mo, cross-channel, owned by Sales.',
  };

  // KPI tiles per category
  const tiles: KpiTileProps[] = (() => {
    if (category === 'direct') {
      return [
        { label: 'Bookings', value: bookings, size: 'sm', delta: hasCmp ? { value: dPct(bookings, cmpBookings), period: 'cmp', direction: bookings >= cmpBookings ? 'up' : 'down' } : undefined },
        { label: 'Revenue', value: Math.round(revenue), currency: moneyCurrency, size: 'sm', delta: hasCmp ? { value: dPct(revenue, cmpRevenue), period: 'cmp', direction: revenue >= cmpRevenue ? 'up' : 'down' } : undefined },
        { label: 'ADR', value: Math.round(adr), currency: moneyCurrency, size: 'sm', delta: hasCmp ? { value: dPct(adr, cmpAdr), period: 'cmp', direction: adr >= cmpAdr ? 'up' : 'down' } : undefined },
        { label: 'Share of revenue', value: `${shareOfRev.toFixed(1)}%`, size: 'sm', footnote: 'target ≥ 30%', status: shareOfRev >= 30 ? 'green' : 'amber' },
        { label: 'Avg lead time', value: `${avgLead.toFixed(0)}d`, size: 'sm', footnote: 'booking-weighted' },
      ];
    }
    if (category === 'ota') {
      return [
        { label: 'Bookings', value: bookings, size: 'sm', delta: hasCmp ? { value: dPct(bookings, cmpBookings), period: 'cmp', direction: bookings >= cmpBookings ? 'up' : 'down' } : undefined },
        { label: 'Revenue', value: Math.round(revenue), currency: moneyCurrency, size: 'sm' },
        { label: 'ADR (gross)', value: Math.round(adr), currency: moneyCurrency, size: 'sm' },
        { label: 'Commission %', value: `${commPct.toFixed(1)}%`, size: 'sm', footnote: hasCmp ? `cmp ${cmpCommPct.toFixed(1)}%` : 'lower is better', status: commPct > 18 ? 'red' : commPct > 12 ? 'amber' : 'green' },
        { label: 'Net ADR', value: Math.round(netAdr), currency: moneyCurrency, size: 'sm', footnote: 'gross × (1 − comm%)' },
        { label: 'Cancel rate', value: `${cancelPctTotal.toFixed(1)}%`, size: 'sm', status: cancelPctTotal > 25 ? 'red' : 'amber' },
      ];
    }
    // dmc / bedbank (same shape — both are B2B intermediaries)
    // PBS 2026-05-26 #233: add STLY/cmp delta to match Direct/OTA tile branch
    return [
      { label: 'Bookings', value: bookings, size: 'sm',
        delta: hasCmp ? { value: dPct(bookings, cmpBookings), period: 'cmp', direction: bookings >= cmpBookings ? 'up' : 'down' } : undefined },
      { label: 'Revenue', value: Math.round(revenue), currency: moneyCurrency, size: 'sm',
        delta: hasCmp ? { value: dPct(revenue, cmpRevenue), period: 'cmp', direction: revenue >= cmpRevenue ? 'up' : 'down' } : undefined },
      { label: 'ADR', value: Math.round(adr), currency: moneyCurrency, size: 'sm',
        delta: hasCmp ? { value: dPct(adr, cmpAdr), period: 'cmp', direction: adr >= cmpAdr ? 'up' : 'down' } : undefined,
        footnote: category === 'bedbank' ? 'net rate (no commission)' : 'pre-commission net rate' },
      { label: 'Avg lead time', value: `${avgLead.toFixed(0)}d`, size: 'sm', footnote: category === 'bedbank' ? 'B2B allotments' : 'usually longer for B2B' },
      { label: 'Active contracts', value: rows.length, size: 'sm', footnote: 'distinct sources w/ bookings' },
    ];
  })();

  // Trend chart — RPC returns one row per (category, week_start) with category in ['Direct','OTA','Wholesale','Other'].
  // PBS #199 v9: filter by the matching category and aggregate.
  const trendCatKey = category === 'direct' ? 'Direct' : category === 'ota' ? 'OTA' : category === 'group' ? 'Other' : 'Wholesale';
  // PBS 2026-05-26: 25 vs 26 overlay. Pivot weekly trend rows into per-year series keyed by ISO week 1-53.
  const trendMap = new Map<number, { week: string; share_25: number; share_26: number }>();
  for (const r of mixWeekly as Array<Record<string, unknown>>) {
    if (String(r.category ?? '') !== trendCatKey) continue;
    const w = Number(r.week_of_year ?? 0);
    const y = Number(r.year ?? 0);
    if (!w) continue;
    const slot = trendMap.get(w) ?? { week: 'W' + String(w).padStart(2, '0'), share_25: 0, share_26: 0 };
    if (y === 2025) slot.share_25 = Number(r.share_pct ?? 0);
    else if (y === 2026) slot.share_26 = Number(r.share_pct ?? 0);
    trendMap.set(w, slot);
  }
  const trendData = Array.from(trendMap.entries()).sort((a, b) => a[0] - b[0]).map(([, v]) => v);

  // Velocity 28d — RPC returns one row per (category, day). Filter by category.
  // PBS #199 v9: same Direct/OTA/Wholesale/Other category mapping.
  // PBS 2026-05-26: 25 vs 26 overlay. Pivot by day_offset 0..27 so prior-year and current-year align on the same x position.
  const velMap = new Map<number, { day: string; n_25: number; n_26: number }>();
  for (const r of velocity as Array<Record<string, unknown>>) {
    if (String(r.category ?? '') !== trendCatKey) continue;
    const off = Number(r.day_offset ?? 0);
    const y = Number(r.year ?? 0);
    const slot = velMap.get(off) ?? { day: 'D' + String(off + 1).padStart(2, '0'), n_25: 0, n_26: 0 };
    if (y === 2025) slot.n_25 = Number(r.bookings ?? 0);
    else if (y === 2026) slot.n_26 = Number(r.bookings ?? 0);
    velMap.set(off, slot);
  }
  const velocityData = Array.from(velMap.entries()).sort((a, b) => a[0] - b[0]).map(([, v]) => v);

  // Net $/booking bar — RPC column is net_value_per_booking (PBS #199 v9 fix)
  const netData = (netValue as Array<Record<string, unknown>>).map((r) => ({
    source: String(r.source_name ?? ''),
    net_pb: Number(r.net_value_per_booking ?? 0),
  }));

  // All-sources table (every source in this category)
  const tableRows = rows
    .map((c) => {
      const netAdrR = Number(c.adr || 0) * (1 - Number(c.commission_pct || 0) / 100);
      return {
        source:    String(c.source_name ?? '—'),
        bookings:  String(c.bookings ?? 0),
        revenue:   fmtMoney(Number(c.gross_revenue ?? 0), moneyCurrency),
        adr:       fmtMoney(Number(c.adr ?? 0), moneyCurrency),
        comm_pct:  `${Number(c.commission_pct ?? 0).toFixed(0)}%`,
        net_adr:   fmtMoney(netAdrR, moneyCurrency),
        cancel:    `${Number(c.cancel_pct ?? 0).toFixed(1)}%`,
        lead:      `${Number(c.avg_lead_days ?? 0).toFixed(0)}d`,
        los:       Number(c.avg_los ?? 0).toFixed(1),
      };
    })
    .sort((a, b) => Number(b.bookings) - Number(a.bookings));

  const tableCols: ChartSeries[] = [
    { key: 'bookings', label: 'Bkg' },
    { key: 'revenue',  label: 'Rev' },
    { key: 'adr',      label: 'ADR' },
    ...(category === 'ota' ? [
      { key: 'comm_pct', label: 'Comm %' } as ChartSeries,
      { key: 'net_adr',  label: 'Net ADR' } as ChartSeries,
    ] : []),
    { key: 'cancel',   label: 'Cancel %' },
    { key: 'lead',     label: 'Lead' },
    { key: 'los',      label: 'LOS' },
  ];

  // PBS 2026-05-29 — monthly share + 3-box row data — parallelized to avoid Vercel function timeout
  const monthCatKey = category === 'direct' ? 'Direct' : category === 'ota' ? 'OTA' : category === 'group' ? 'Other' : 'Wholesale';
  const [monthlyRevRes, channelTiersRes, top10Res, groupRowsRes, dmcRowsRes, groupsSince24Res] = await Promise.all([
    supabase.from('v_channel_performance_monthly').select('month, channel_group, rooms_revenue').eq('property_id', propertyId),
    supabase.from('v_channel_mix_by_tier').select('*').eq('property_id', propertyId),
    supabase.rpc('fn_source_top10_period', { p_property_id: propertyId, p_days: 30 }),
    supabase.from('v_group_bookings_12mo').select('*').eq('property_id', propertyId).order('gross_revenue', { ascending: false }).limit(8),
    supabase.from('v_dmc_performance').select('partner_short_name, country, production_status, res_12mo, rn_12mo, gross_12mo').eq('property_id', propertyId).order('gross_12mo', { ascending: false }).limit(8),
    supabase.from('v_groups_since_2024').select('source_name, market_segment, month_label, nights, total_amount, group_signal, check_in_date').eq('property_id', propertyId),
  ]);
  const groupBookingsInline = (groupRowsRes.data ?? []) as Array<Record<string, unknown>>;
  const dmcPerfInline = (dmcRowsRes.data ?? []) as Array<Record<string, unknown>>;
  const monthlyRevRows = monthlyRevRes.data;
  const monthTotals = new Map<string, number>();
  for (const r of (monthlyRevRows ?? []) as Array<{ month: string; channel_group: string; rooms_revenue: number }>) {
    const ym = String(r.month ?? '').slice(0, 7);
    monthTotals.set(ym, (monthTotals.get(ym) ?? 0) + Number(r.rooms_revenue ?? 0));
  }
  const monthShareMap = new Map<string, { month: string; share_25: number; share_26: number }>();
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  for (const r of (monthlyRevRows ?? []) as Array<{ month: string; channel_group: string; rooms_revenue: number }>) {
    if (String(r.channel_group ?? '') !== monthCatKey) continue;
    const ym = String(r.month ?? '').slice(0, 7);
    const total = monthTotals.get(ym) ?? 0;
    if (total <= 0) continue;
    const sharePct = (Number(r.rooms_revenue ?? 0) / total) * 100;
    const yr = Number(ym.slice(0, 4));
    const mm = ym.slice(5, 7);
    const label = MONTH_NAMES[Math.max(0, parseInt(mm, 10) - 1)];
    const slot = monthShareMap.get(mm) ?? { month: label, share_25: 0, share_26: 0 };
    if (yr === 2025) slot.share_25 = sharePct;
    else if (yr === 2026) slot.share_26 = sharePct;
    monthShareMap.set(mm, slot);
  }
  const monthlyShareData = Array.from(monthShareMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
  const channelTiers = channelTiersRes.data;
  const tierData = ((channelTiers ?? []) as Array<Record<string, unknown>>).map((r) => ({
    tier: String(r.tier ?? '—'),
    reservations: Number(r.reservations ?? 0),
    gross_revenue: Number(r.gross_revenue ?? 0),
    gross_share_pct: Number(r.gross_share_pct ?? 0),
  }));
  // PBS 2026-05-29 — gross share per tier (for row 2 box 3) — derived from tierData
  const tierGrossTotal = tierData.reduce((s, r) => s + r.gross_revenue, 0);
  const grossShareData = tierData.map((r) => ({
    tier: r.tier,
    share_pct: tierGrossTotal > 0 ? Math.round((r.gross_revenue / tierGrossTotal) * 1000) / 10 : 0,
  }));
  const top10Last30dRaw = top10Res.data;
  const top10Last30d = ((top10Last30dRaw ?? []) as Array<Record<string, unknown>>).map((r) => ({
    source: String(r.source ?? '—'),
    tier: String(r.tier ?? '—'),
    reservations: Number(r.reservations ?? 0),
    gross_revenue: Number(r.gross_revenue ?? 0),
    adr: Number(r.adr ?? 0),
  }));
  // PBS 2026-05-29 v2 — tier share %% comparison (reservations vs revenue) + monthly stacked perf
  const totalResAcross = tierData.reduce((s, r) => s + r.reservations, 0);
  const totalRevAcross = tierData.reduce((s, r) => s + r.gross_revenue, 0);
  const tierShareData = tierData.map((r) => ({
    tier: r.tier,
    res_pct: totalResAcross > 0 ? Math.round((r.reservations / totalResAcross) * 1000) / 10 : 0,
    rev_pct: totalRevAcross > 0 ? Math.round((r.gross_revenue / totalRevAcross) * 1000) / 10 : 0,
  }));
  // Pivot monthlyRevRows to stacked-bar shape: one row per month, columns = channel_groups
  const monthlyGroupsSet = new Set<string>();
  const monthlyPivot = new Map<string, Record<string, string | number>>();
  for (const r of (monthlyRevRows ?? []) as Array<{ month: string; channel_group: string; rooms_revenue: number }>) {
    const ym = String(r.month ?? '').slice(0, 7);
    if (!ym) continue;
    const grp = String(r.channel_group ?? '');
    if (!grp) continue;
    monthlyGroupsSet.add(grp);
    const row = monthlyPivot.get(ym) ?? { month: ym } as Record<string, string | number>;
    row[grp] = Number(row[grp] || 0) + Number(r.rooms_revenue ?? 0);
    monthlyPivot.set(ym, row);
  }
  const monthlyPerfData = Array.from(monthlyPivot.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v).slice(-12);
  const MONTHLY_PERF_COLORS: Record<string, string> = { OTA: '#B8542A', Direct: '#1F3A2E', Wholesale: '#B8A878', Other: '#9C9C9C', 'Walk-In': '#5B7A5A' };
  const monthlyPerfSeries: ChartSeries[] = Array.from(monthlyGroupsSet).sort().map((g) => ({ key: g, label: g, color: MONTHLY_PERF_COLORS[g] || '#5A5A5A' }));

  const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };
  return (
    <>
      {/* PBS 2026-07-01 rev3: per-category KPI strip removed from CategoryBlock —
          duplicated by the top-of-page CategoryCompareGrid. Category-specific
          detail lives in the rest of this block (top 10, mix, etc.). */}

      {/* PBS 2026-07-01: dropped share-by-month + velocity-28d 2-up row per PBS
          — noise. Data lives on the per-source landing pages now. */}

      {/* PBS 2026-07-01 rev4: 3-box row equal-size. gridAutoRows:1fr + inner
          flex ensures all three Containers render at the same height regardless
          of chart content (empty state, table with 10 rows, bar chart, etc.). */}
      <div style={{ ...fullRow, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gridAutoRows: '1fr', gap: 12 }}>
        <Container title="Channel mix · res vs revenue %" subtitle="grouped bars per tier · reservations share vs gross-revenue share">
          <div style={{ minHeight: 260, display: 'flex', flexDirection: 'column' }}>
            <Chart variant="bar" data={tierShareData} xKey="tier"
              series={[
                { key: 'res_pct', label: 'Reservations %', color: '#1F3A2E' },
                { key: 'rev_pct', label: 'Revenue %',      color: '#B8542A' },
              ]}
              height={240} empty={{ title: 'No tier data' }} />
          </div>
        </Container>
        <Container title="Top 10 sources" subtitle="last 30 days · by gross revenue">
          <div style={{ minHeight: 260, display: 'flex', flexDirection: 'column' }}>
            <Chart variant="table" data={top10Last30d} xKey="source"
              series={[
                { key: 'reservations',  label: 'Bkg' },
                { key: 'gross_revenue', label: 'Rev' },
                { key: 'adr',           label: 'ADR' },
              ]}
              height={240} empty={{ title: 'No bookings in last 30 days' }} />
          </div>
        </Container>
        <Container title="Channel perf by month" subtitle="rooms revenue · stacked by channel group · last 12 months">
          <div style={{ minHeight: 260, display: 'flex', flexDirection: 'column' }}>
            <Chart variant="stacked_bar" data={monthlyPerfData} xKey="month"
              series={monthlyPerfSeries}
              height={240} empty={{ title: 'No monthly data' }} />
          </div>
        </Container>
      </div>

      {/* PBS 2026-07-01: row 2 slimmed to Group Bookings · Gross share by tier.
          DMC Performance removed — duplicated by the top DMC/OTA/Direct strip. */}
      <div style={{ ...fullRow, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        <Container title="Group Bookings" subtitle="12 months · top by gross revenue">
          <Chart variant="table" data={groupBookingsInline} xKey="source"
            series={[
              { key: 'channel_group',  label: 'Tier' },
              { key: 'reservations',   label: 'Res' },
              { key: 'room_nights',    label: 'RN' },
              { key: 'gross_revenue',  label: 'Gross' },
              { key: 'group_adr',      label: 'ADR' },
            ]}
            height={180} empty={{ title: 'No group bookings on file' }} />
        </Container>
        <Container title="Gross share by tier" subtitle="12 months · % of total gross">
          <Chart variant="bar" data={grossShareData} xKey="tier"
            series={[{ key: 'share_pct', label: 'Share of gross (%)', color: '#1F3A2E' }]}
            height={180} empty={{ title: 'No tier data' }} />
        </Container>
      </div>

      {/* PBS 2026-05-29 — row 3: Groups since 2024 (KPIs · monthly trend · top originators) */}
      {(() => {
        const groupsRows = (groupsSince24Res.data ?? []) as Array<{ source_name: string; market_segment: string; month_label: string; nights: number; total_amount: number; group_signal: string }>;
        const totalBkg = groupsRows.length;
        const totalNights = groupsRows.reduce((s, r) => s + Number(r.nights ?? 0), 0);
        const totalRev = groupsRows.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
        const avgAdr = totalNights > 0 ? Math.round(totalRev / totalNights) : 0;
        const avgSize = totalBkg > 0 ? (totalNights / totalBkg).toFixed(1) : '0';
        const monthMap = new Map<string, Record<string, string | number>>();
        for (const r of groupsRows) {
          const m = String(r.month_label ?? '');
          if (!m) continue;
          const row = monthMap.get(m) ?? { month: m, rate_or_segment: 0, classified_source: 0, source_named: 0 } as Record<string, string | number>;
          const sig = String(r.group_signal ?? 'rate_or_segment');
          row[sig] = Number(row[sig] || 0) + Number(r.total_amount ?? 0);
          monthMap.set(m, row);
        }
        const monthRows = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
        // PBS 2026-07-01: Group Performance now covers the last 12 months only
        // (same window as DMC / OTA / Direct Performance containers). We filter
        // groupsRows by check_in_date so the aggregation stays date-scoped.
        const last12moCutoff = new Date();
        last12moCutoff.setFullYear(last12moCutoff.getFullYear() - 1);
        const last12moCutoffIso = last12moCutoff.toISOString().slice(0, 10);
        const groupsRows12mo = groupsRows.filter((r) => String((r as unknown as { check_in_date?: string }).check_in_date ?? '') >= last12moCutoffIso);
        const origMap = new Map<string, { source: string; segment: string; res: number; nights: number; revenue: number; adr: number }>();
        for (const r of groupsRows12mo) {
          const key = `${r.source_name}|${r.market_segment}`;
          const slot = origMap.get(key) ?? { source: r.source_name, segment: r.market_segment, res: 0, nights: 0, revenue: 0, adr: 0 };
          slot.res += 1;
          slot.nights += Number(r.nights ?? 0);
          slot.revenue += Number(r.total_amount ?? 0);
          origMap.set(key, slot);
        }
        const originatorRows = Array.from(origMap.values()).map((r) => ({ ...r, revenue: Math.round(r.revenue), adr: r.nights > 0 ? Math.round(r.revenue / r.nights) : 0 })).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
        return (
          <div style={{ ...fullRow, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            <Container title="Groups · since 2024" subtitle={`${totalBkg} bookings · ${totalNights} nights · all-time since Jan 2024`}>
              <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                <KpiTile label="Bookings" value={totalBkg} size="sm" />
                <KpiTile label="Revenue" value={Math.round(totalRev)} currency={moneyCurrency} size="sm" />
                <KpiTile label="ADR" value={avgAdr} currency={moneyCurrency} size="sm" />
                <KpiTile label="Avg group size" value={`${avgSize} RN`} size="sm" footnote="RN per booking" />
              </div>
            </Container>
            <Container title="Groups revenue · by month" subtitle="since 2024 · stacked by source classification">
              <Chart variant="stacked_bar" data={monthRows} xKey="month"
                series={[
                  { key: 'rate_or_segment',  label: 'Rate plan / segment', color: '#1F3A2E' },
                  { key: 'classified_source', label: 'Group source',         color: '#B8542A' },
                  { key: 'source_named',     label: 'Other',                color: '#B8A878' },
                ]}
                height={180} empty={{ title: 'No groups data since 2024' }} />
            </Container>
            <Container title="Group Performance" subtitle="12 months · top 10 by revenue">
              <Chart variant="table" data={originatorRows} xKey="source"
                series={[
                  { key: 'segment',  label: 'Segment' },
                  { key: 'res',      label: 'Res' },
                  { key: 'nights',   label: 'RN' },
                  { key: 'revenue',  label: 'Rev' },
                  { key: 'adr',      label: 'ADR' },
                ]}
                height={180} empty={{ title: 'No group originators' }} />
            </Container>
          </div>
        );
      })()}

      {/* "Still owed" container removed 2026-05-26 (task #235) */}
    </>
  );
}

const subTabRow: React.CSSProperties = {
  display: 'flex', gap: 4, flexWrap: 'wrap',
  borderBottom: '1px solid var(--hairline, #E6DFCC)', paddingBottom: 0, marginBottom: 4,
};
const subTabStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex', flexDirection: 'column',
  padding: '8px 16px 10px',
  background: active ? 'var(--primary, #1F3A2E)' : 'var(--paper, #FFFFFF)',
  color:      active ? '#FFFFFF' : 'var(--ink, #1B1B1B)',
  border: `1px solid ${active ? 'var(--primary, #1F3A2E)' : 'var(--hairline, #E6DFCC)'}`,
  borderBottom: active ? `1px solid var(--primary, #1F3A2E)` : 'none',
  borderRadius: '6px 6px 0 0',
  textDecoration: 'none', cursor: 'pointer',
  marginBottom: -1,
});
const pillStyle = (active: boolean): React.CSSProperties => ({
  fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
  padding: '4px 10px', borderRadius: 99,
  border: `1px solid ${active ? 'var(--primary, #1F3A2E)' : 'var(--hairline, #E6DFCC)'}`,
  background: active ? 'var(--primary, #1F3A2E)' : 'var(--paper, #FFFFFF)',
  color: active ? '#FFFFFF' : 'var(--ink-soft, #5A5A5A)',
  fontWeight: active ? 600 : 500, textDecoration: 'none',
});
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontWeight: 600 };
const tdLabelStyle: React.CSSProperties = { padding: '8px 10px', color: 'var(--ink, #1B1B1B)', fontWeight: 500 };
const tdNumStyle: React.CSSProperties = { padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--mono, "JetBrains Mono", ui-monospace, monospace)', color: 'var(--ink, #1B1B1B)' };
const sourceLinkStyle: React.CSSProperties = { color: 'var(--primary, #1F3A2E)', textDecoration: 'none', fontWeight: 600, cursor: 'pointer' };

const chipStyle: React.CSSProperties = {
  fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
  padding: '4px 10px', borderRadius: 4,
  background: 'rgba(184, 84, 42, 0.10)',
  border: '1px solid var(--terracotta, #B8542A)',
  color: 'var(--terracotta, #B8542A)', fontWeight: 600,
};
