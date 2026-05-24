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
import ChannelDrillDrawer from '@/app/_components/registry/ChannelDrillDrawer';
import { resolvePeriod, type WindowKey } from '@/lib/period';
import {
  getChannelEconomics, getChannelEconomicsForRange,
  getChannelMixWeeklyTrend, getChannelNetValueForRange, getChannelVelocity28dByCat,
} from '@/lib/data-channels';
import { fmtMoney } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { REVENUE_SUBPAGES } from '../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

const PROPERTY_ID_NAMKHAN = 260955;

const OTA_RX = /booking\.com|expedia|agoda|airbnb|ctrip|trip\.com|hotels\.com|traveloka|a-expedia|a-hotels|bdc-|exp-/i;
const DMC_RX = /hotelbeds|webbeds|sunhotels|gta|tourico|bonotel|miki|reseller|khiri|trails of|wholesale|destimo|sidetours|tui|jet2|wtb-|sun-|ago-|wbs-/i;
const DIRECT_RX = /direct|website|booking engine|^email|walk[- ]?in|witbooking|whatsapp|mews operations|in person|telephone/i;

type Category = 'direct' | 'ota' | 'dmc';

function classify(source: string): Category | 'other' {
  const s = (source || '').toLowerCase();
  if (DIRECT_RX.test(s)) return 'direct';
  if (OTA_RX.test(s))    return 'ota';
  if (DMC_RX.test(s))    return 'dmc';
  return 'other';
}

const TAB_DEFS: Array<{ key: Category; label: string; tagline: string }> = [
  { key: 'direct', label: 'Direct',        tagline: 'in-house channels — best margin' },
  { key: 'ota',    label: 'OTAs',          tagline: 'Booking.com · Expedia · Agoda · …' },
  { key: 'dmc',    label: 'DMC · Bedbanks', tagline: 'Hotelbeds · WebBeds · Khiri · …' },
];

interface Props { searchParams: Record<string, string | string[] | undefined>; propertyId?: number }

export default async function ChannelsPage({ searchParams, propertyId }: Props) {
  const pid = propertyId ?? PROPERTY_ID_NAMKHAN;
  const moneyCurrency: 'USD' | 'EUR' = pid === 1000001 ? 'EUR' : 'USD';
  const sym = moneyCurrency === 'EUR' ? '€' : '$';

  // note#13: per-source 24/25/26 aggregate for the full-screen-expandable table
  const { data: sourcesAllYears } = await supabase
    .from('v_chart_channels_sources_24_25_26')
    .select('category, source_name, res_24, res_25, res_26, res_total, rev_24, rev_25, rev_26, rev_total, rn_26, adr_26, avg_window_days, avg_los, sdly_dev_pct')
    .eq('property_id', pid)
    .order('category')
    .order('res_total', { ascending: false });
  const sourcesAllYearsRows = ((sourcesAllYears ?? []) as Array<Record<string, unknown>>).map((r) => {
    const dev = r.sdly_dev_pct == null ? null : Number(r.sdly_dev_pct);
    const devStr = dev == null ? '—' : (dev > 0 ? '↑ ' : dev < 0 ? '↓ ' : '→ ') + `${Math.round(dev)}%`;
    return {
      category: String(r.category ?? 'Other'),
      source:   String(r.source_name ?? 'Unknown'),
      res_24:   Number(r.res_24 ?? 0),
      res_25:   Number(r.res_25 ?? 0),
      res_26:   Number(r.res_26 ?? 0),
      rev_26:   r.rev_26 != null ? `${sym}${Math.round(Number(r.rev_26)).toLocaleString('en-US')}` : '—',
      adr_26:   r.adr_26 != null ? `${sym}${Math.round(Number(r.adr_26)).toLocaleString('en-US')}` : '—',
      rn_26:    r.rn_26 != null ? Number(r.rn_26) : 0,
      window_d: r.avg_window_days != null ? `${Math.round(Number(r.avg_window_days))}d` : '—',
      los_d:    r.avg_los != null ? `${Number(r.avg_los).toFixed(1)}n` : '—',
      sdly:     devStr,
    };
  });
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, pid);
  const basePath = pid !== PROPERTY_ID_NAMKHAN ? `/h/${pid}/revenue/channels` : '/revenue/channels';
  const period = resolvePeriod(searchParams);

  const rawTab = String(searchParams.tab ?? 'direct').toLowerCase();
  const activeTab: Category = (TAB_DEFS.find((t) => t.key === rawTab)?.key) ?? 'direct';

  const cmpPeriod = period.cmp !== 'none' && period.compareFrom && period.compareTo
    ? { ...period, from: period.compareFrom, to: period.compareTo, cmp: 'none' as const }
    : null;

  const [channelsRaw, channelsCmp, mixWeekly, netValue, velocity] = await Promise.all([
    getChannelEconomics(period, pid).catch(() => [] as Awaited<ReturnType<typeof getChannelEconomics>>),
    cmpPeriod
      ? getChannelEconomicsForRange(cmpPeriod.from, cmpPeriod.to, pid).catch(() => [] as Array<Record<string, unknown>>)
      : Promise.resolve([] as Array<Record<string, unknown>>),
    getChannelMixWeeklyTrend(period.from, period.to, pid).catch(() => [] as Array<Record<string, unknown>>),
    getChannelNetValueForRange(period.from, period.to, pid).catch(() => [] as Array<Record<string, unknown>>),
    getChannelVelocity28dByCat(pid).catch(() => [] as Array<Record<string, unknown>>),
  ]);
  const channels = channelsRaw;

  // Group all channels by category
  const byCat: Record<Category | 'other', typeof channels> = { direct: [], ota: [], dmc: [], other: [] };
  for (const c of channels) byCat[classify(String(c.source_name || ''))].push(c);

  // Page-level mix tiles (across all categories)
  const totalRev = channels.reduce((s, c) => s + Number(c.gross_revenue || 0), 0);
  const sumRev = (rows: typeof channels) => rows.reduce((s, c) => s + Number(c.gross_revenue || 0), 0);
  const mixPct = (rows: typeof channels) => (totalRev ? (sumRev(rows) / totalRev) * 100 : 0);

  const pageMixTiles: KpiTileProps[] = [
    { label: 'Direct mix',         value: `${mixPct(byCat.direct).toFixed(1)}%`, size: 'sm', footnote: `${byCat.direct.length} sources · target ≥ 30%`, status: mixPct(byCat.direct) >= 30 ? 'green' : 'amber' },
    { label: 'OTA mix',            value: `${mixPct(byCat.ota).toFixed(1)}%`,    size: 'sm', footnote: `${byCat.ota.length} sources · lower = less commission drag`, status: 'amber' },
    { label: 'DMC & Bedbanks mix', value: `${mixPct(byCat.dmc).toFixed(1)}%`,    size: 'sm', footnote: `${byCat.dmc.length} sources · net-rate exposure`, status: 'amber' },
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
  const hrefFor = (newWin: WindowKey) => {
    const p = new URLSearchParams();
    if (newWin !== '30d') p.set('win', newWin);
    if (period.cmp && period.cmp !== 'none') p.set('cmp', period.cmp);
    if (activeTab !== 'direct') p.set('tab', activeTab);
    const qs = p.toString();
    return `${basePath}${qs ? '?' + qs : ''}`;
  };
  const drillHrefFor = (source: string) => {
    const p = new URLSearchParams();
    if (period.win !== '30d') p.set('win', period.win);
    if (period.cmp && period.cmp !== 'none') p.set('cmp', period.cmp);
    if (activeTab !== 'direct') p.set('tab', activeTab);
    p.set('drill', source);
    return `${basePath}?${p.toString()}`;
  };

  const tabHrefFor = (newTab: Category) => {
    const p = new URLSearchParams();
    if (period.win !== '30d') p.set('win', period.win);
    if (period.cmp && period.cmp !== 'none') p.set('cmp', period.cmp);
    if (newTab !== 'direct') p.set('tab', newTab);
    const qs = p.toString();
    return `${basePath}${qs ? '?' + qs : ''}`;
  };

  return (
    <DashboardPage
      title="Revenue · Channels"
      subtitle={`Channel performance · ${period.label} · ${channels.length} active sources across ${[byCat.direct, byCat.ota, byCat.dmc].filter((g) => g.length > 0).length} categories`}
      tabs={tabs}
    >
      {/* PBS #187 (2026-05-24): Window + Category controls collapsed INTO the Headline
          channel-mix container — one container, three stacked rows (Window · Category · KPI tiles). */}
      <Container title="Headline · channel mix" subtitle={period.label} density="compact">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)' }}>Window</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {(['7d', '30d', '90d'] as WindowKey[]).map((k) => {
                const active = k === period.win;
                return (
                  <a key={k} href={hrefFor(k)} style={pillStyle(active)}>{k}</a>
                );
              })}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)' }}>Category</span>
            <div style={subTabRow}>
              {TAB_DEFS.map((t) => {
                const active = t.key === activeTab;
                return (
                  <Link key={t.key} href={tabHrefFor(t.key)} style={subTabStyle(active)}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{t.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {pageMixTiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>
      </Container>

      {chips.length > 0 && (
        <Container title="Watch list" subtitle="auto-detected insights · cross-category" density="compact" status="amber">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {chips.map((c, i) => (
              <span key={i} style={chipStyle}>{c}</span>
            ))}
          </div>
        </Container>
      )}

      {activeTab === 'direct' && <CategoryBlock category="direct" rows={byCat.direct as unknown as Array<Record<string, unknown>>} cmpRows={(channelsCmp as Array<Record<string, unknown>>).filter((c) => classify(String(c.source_name || '')) === 'direct')} mixWeekly={mixWeekly as unknown as Array<Record<string, unknown>>} velocity={velocity as unknown as Array<Record<string, unknown>>} period={period} totalRev={totalRev} netValue={(netValue as unknown as Array<Record<string, unknown>>).filter((r) => classify(String(r.source_name || r.channel || '')) === 'direct')} drillHrefFor={drillHrefFor} moneyCurrency={moneyCurrency} />}
      {activeTab === 'ota'    && <CategoryBlock category="ota"    rows={byCat.ota as unknown as Array<Record<string, unknown>>}    cmpRows={(channelsCmp as Array<Record<string, unknown>>).filter((c) => classify(String(c.source_name || '')) === 'ota')}    mixWeekly={mixWeekly as unknown as Array<Record<string, unknown>>} velocity={velocity as unknown as Array<Record<string, unknown>>} period={period} totalRev={totalRev} netValue={(netValue as unknown as Array<Record<string, unknown>>).filter((r) => classify(String(r.source_name || r.channel || '')) === 'ota')} drillHrefFor={drillHrefFor} moneyCurrency={moneyCurrency} />}
      {activeTab === 'dmc'    && <CategoryBlock category="dmc"    rows={byCat.dmc as unknown as Array<Record<string, unknown>>}    cmpRows={(channelsCmp as Array<Record<string, unknown>>).filter((c) => classify(String(c.source_name || '')) === 'dmc')}    mixWeekly={mixWeekly as unknown as Array<Record<string, unknown>>} velocity={velocity as unknown as Array<Record<string, unknown>>} period={period} totalRev={totalRev} netValue={(netValue as unknown as Array<Record<string, unknown>>).filter((r) => classify(String(r.source_name || r.channel || '')) === 'dmc')} drillHrefFor={drillHrefFor} moneyCurrency="USD" />}

      {/* note#13: full-screen-expandable sources table (data fetched at top via sourcesAllYears) */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title={`Sources · 2024 / 2025 / 2026 · ${sourcesAllYearsRows.length} active sources`} subtitle="every active source since 2024, grouped Direct / OTA / DMC. Click container header to expand to full screen. SDLY column compares 2026 vs 2025 reservations.">
          <Chart variant="table" data={sourcesAllYearsRows as unknown as Array<Record<string, unknown>>} xKey="source"
            series={[
              { key: 'category', label: 'Group' },
              { key: 'res_24',   label: 'Res 24' },
              { key: 'res_25',   label: 'Res 25' },
              { key: 'res_26',   label: 'Res 26' },
              { key: 'sdly',     label: 'SDLY 26 vs 25' },
              { key: 'rev_26',   label: 'Rev 26' },
              { key: 'adr_26',   label: 'ADR 26' },
              { key: 'rn_26',    label: 'RN 26' },
              { key: 'window_d', label: 'Avg window' },
              { key: 'los_d',    label: 'Avg LOS' },
            ]}
            empty={{ title: 'No sources data' }}
          />
        </Container>
      </div>

      {/* PBS #126 (2026-05-24): 9-piece split. PageRenderer in embedded mode renders the 9 registry
          children as direct siblings of the host DashboardPage — no nested DashboardPage, no outer wrap. */}
      <PageRenderer pageSlug="channel" propertyId={pid} title="" subtitle="" embedded />

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
      />
    </DashboardPage>
  );
}

// ─── per-category block ──────────────────────────────────────────────────────
function CategoryBlock({
  category, rows, cmpRows, mixWeekly, velocity, period, totalRev, netValue, moneyCurrency, drillHrefFor,
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
    direct: 'Direct',
    ota:    'OTAs',
    dmc:    'DMC · Bedbanks',
  };
  const missingNote: Record<Category, string> = {
    direct: '↪ Conversion rate (visits → bookings) and returning-guest direct % — owed by Plausible / GA integration + cross-join to pms.guests_mews.',
    ota:    '↪ Search visibility · content score · Genius status — owed by BDC admin scrape (component scaffold at /channels/[source]).',
    dmc:    '↪ Contract status · net-rate vs published rack · production-vs-target — owed by cockpit.dmc_contracts table.',
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
    // dmc
    return [
      { label: 'Bookings', value: bookings, size: 'sm' },
      { label: 'Revenue', value: Math.round(revenue), currency: moneyCurrency, size: 'sm' },
      { label: 'ADR', value: Math.round(adr), currency: moneyCurrency, size: 'sm', footnote: 'pre-commission net rate' },
      { label: 'Avg lead time', value: `${avgLead.toFixed(0)}d`, size: 'sm', footnote: 'usually longer for B2B' },
      { label: 'Active contracts', value: rows.length, size: 'sm', footnote: 'distinct sources w/ bookings' },
    ];
  })();

  // Trend chart — pluck the right column from mixWeekly
  const trendKey: 'direct' | 'ota' | 'wholesale' = category === 'direct' ? 'direct' : category === 'ota' ? 'ota' : 'wholesale';
  const trendData = (mixWeekly as Array<Record<string, unknown>>).map((r) => ({
    week:  String(r.week_start ?? r.week ?? ''),
    share: Number(r[`${trendKey}_pct`] ?? r[trendKey] ?? 0),
  }));

  // Velocity 28d, same category
  const velKey: 'direct' | 'ota' | 'other' = category === 'direct' ? 'direct' : category === 'ota' ? 'ota' : 'other';
  const velocityData = (velocity as Array<Record<string, unknown>>).map((r) => ({
    day: String(r.day ?? r.date ?? ''),
    n:   Number(r[velKey] ?? 0),
  }));

  // Net $/booking bar (already category-filtered)
  const netData = (netValue as Array<Record<string, unknown>>).map((r) => ({
    source: String(r.source_name ?? r.channel ?? ''),
    net_pb: Number(r.net_per_booking ?? r.net_pb ?? 0),
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

  const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };
  return (
    <>
      {/* KPI tiles */}
      <div style={fullRow}>
        <Container title={`${titleOf[category]} · headline`} subtitle={`${period.label} · ${rows.length} active sources`} density="compact">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
            {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>
      </div>

      {/* Two trend charts paired in a 2-up row */}
      <div style={{ ...fullRow, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        <Container title={`${titleOf[category]} share · weekly trend`} subtitle={period.label}>
          <Chart variant="line" data={trendData} xKey="week"
            series={[{ key: 'share', label: `${titleOf[category]} % of revenue`, color: '#1F3A2E' }]}
            height={220} empty={{ title: 'No mix data in window' }} />
        </Container>
        <Container title={`${titleOf[category]} velocity · 28d`} subtitle="bookings made per day">
          <Chart variant="line" data={velocityData} xKey="day"
            series={[{ key: 'n', label: 'Bookings/day', color: '#B8542A' }]}
            height={220} empty={{ title: 'No velocity in last 28 days' }} />
        </Container>
      </div>

      {netData.length > 0 && (
        <div style={fullRow}>
          <Container title={`${titleOf[category]} · net $/booking`} subtitle="cancel-adjusted">
            <Chart variant="bar" data={netData} xKey="source"
              series={[{ key: 'net_pb', label: 'Net $/booking', color: '#1F3A2E' }]}
              height={200} empty={{ title: 'No net value data' }} />
          </Container>
        </div>
      )}

      {/* Table — PBS #199: source-name cell is a Link → ?drill=<source> opens ChannelDrillDrawer (mounted at page bottom) */}
      <div style={fullRow}>
        <Container title={`${titleOf[category]} · all sources`} subtitle={`${rows.length} sources · sorted by bookings · click a source to open the drawer`}>
          {tableRows.length === 0 ? (
            <div style={{ padding: 16, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>No sources in this category for the window</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--bg, #F4EFE2)', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10, color: 'var(--ink-soft, #5A5A5A)' }}>
                    <th style={thStyle}>Source</th>
                    {tableCols.map((c) => <th key={c.key} style={{ ...thStyle, textAlign: 'right' }}>{c.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--hairline, #E6DFCC)' }}>
                      <td style={tdLabelStyle}>
                        <Link href={drillHrefFor(r.source)} style={sourceLinkStyle}>{r.source}</Link>
                      </td>
                      {tableCols.map((c) => (
                        <td key={c.key} style={tdNumStyle}>{String((r as Record<string, unknown>)[c.key] ?? '—')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Container>
      </div>

      {/* Owed / missing data note */}
      <div style={fullRow}>
        <Container title="Still owed" subtitle="data not yet wired for this category" density="compact" status="grey">
          <div style={{ fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', lineHeight: 1.5 }}>
            {missingNote[category]}
          </div>
        </Container>
      </div>
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
