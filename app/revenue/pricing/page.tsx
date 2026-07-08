// app/revenue/pricing/page.tsx
// 2026-05-22 Calendar hub — 7 tabs covering every date view a revenue
// manager needs: pricing · holidays · otb_density · pickup · rate ·
// restrictions · parity. Reuses existing primitives (Chart variant=heatmap +
// PickupMatrix). Backwards-compat: legacy `?tab=density` redirects to
// `?tab=holidays` (PBS 2026-05-22 — "Density" was misleading, it was always
// just the country-holidays overlay).

import TenantLink from '@/components/nav/TenantLink';
import { resolvePeriod, type WindowKey } from '@/lib/period';
import { getRoomTypes, getRatePlans, getRateInventory } from '@/lib/pricing';
import { getPricingKpis } from '@/lib/pricingKpis';
import { REVENUE_SUBPAGES } from '../_subpages';
import HolidayScheduleTabContent from '@/app/operations/staff/_components/HolidayScheduleTabContent';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import {
  DashboardPage, Container, KpiTile, Chart, MonthCalendar,
  type DashboardTab, type KpiTileProps, type CalendarDay,
} from '@/app/(cockpit)/_design';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

// PBS 2026-06-08 — dropped 'parity' tab (richer surface at /revenue/parity using v_parity_summary/grid/open_breaches) + merged 'rate' into 'pricing' (both heatmap rate inventory)
type CalendarTab = 'pricing' | 'holidays' | 'otb_density' | 'restrictions';
const VALID_TABS: CalendarTab[] = ['pricing','holidays','otb_density','restrictions'];
const TAB_LABELS: Record<CalendarTab, string> = {
  pricing:      'Pricing & Rate',
  holidays:     'Holidays',
  otb_density:  'OTB Density',
  restrictions: 'Restrictions',
};
function parseTab(raw: string | undefined): CalendarTab {
  if (raw === 'density') return 'holidays'; // backwards-compat
  if (raw === 'rate')    return 'pricing';  // PBS 2026-06-08 — merged into Pricing
  if (raw === 'parity')  return 'pricing';  // PBS 2026-06-08 — moved to /revenue/parity
  return (VALID_TABS.includes(raw as CalendarTab) ? raw : 'pricing') as CalendarTab;
}

const VALID_FWD: WindowKey[] = ['next7','next30','next90','next180','next365'];
const CAPACITY_FIXED_LABEL = 30;
const RATE_MIN = 10;

function parseWin(raw: string | undefined): WindowKey {
  return (VALID_FWD.includes(raw as WindowKey) ? raw : 'next90') as WindowKey;
}

interface SearchParams { win?: string; gran?: string; cmp?: string; tab?: string; y?: string; school?: string; roff?: string }

const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };

export default async function PricingPage({ searchParams, propertyId }: { searchParams: SearchParams; propertyId?: number }) {
  const tab = parseTab(searchParams.tab);
  const pid = propertyId ?? NAMKHAN_PROPERTY_ID;
  const isNamkhan = pid === NAMKHAN_PROPERTY_ID;
  const capacity = isNamkhan ? 30 : 64;
  const propertyLabel = isNamkhan ? 'Namkhan' : pid === 1000001 ? 'Donna' : `Property ${pid}`;
  // PBS 2026-07-07: property-scoped display currency for Donna (EUR) — was hardcoded 'USD'.
  const moneyCurrency: 'USD' | 'EUR' = pid === 1000001 ? 'EUR' : 'USD';
  const currencySym: '€' | '$' = moneyCurrency === 'EUR' ? '€' : '$';
  const basePath = isNamkhan ? '/revenue/pricing' : `/h/${pid}/revenue/pricing`;
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, pid);
  const tabs: DashboardTab[] = subPages.map((s) => ({ key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/pricing') }));
  const win = parseWin(searchParams.win);

  // PBS 2026-07-08: sub-sub-menu re-skinned to the Lighthouse underline pattern
  // — no Container wrap, no card. Bare hairline-bottom nav for a lighter chrome.
  const stripBlock = (
    <div style={fullRow}>
      <CalendarTabStrip active={tab} basePath={basePath} />
    </div>
  );

  // ─── Tab: Holidays (was "Density") ────────────────────────────────────
  if (tab === 'holidays') {
    return (
      <DashboardPage title="Revenue · Calendar" subtitle="holidays · source-market overlay" tabs={tabs}>
        {stripBlock}
        <div style={fullRow}>
          <Container title="Holidays" subtitle="anticipate demand spikes from source-market and Lao calendars">
            <HolidayScheduleTabContent
              propertyId={pid}
              propertyLabel={propertyLabel}
              searchParams={searchParams as Record<string, string | string[] | undefined>}
              basePath={`${basePath}?tab=holidays`}
              embedded
            />
          </Container>
        </div>
      </DashboardPage>
    );
  }


  // ─── Tab: OTB Density ─────────────────────────────────────────────────
  if (tab === 'otb_density') {
    const today = new Date(); today.setUTCHours(0,0,0,0);
    const horizon = new Date(today); horizon.setUTCDate(today.getUTCDate() + 90);
    const fromIso = today.toISOString().slice(0, 10);
    const toIso = horizon.toISOString().slice(0, 10);
    const { data: pace } = await supabase
      .from('v_otb_pace')
      .select('night_date, confirmed_rooms')
      .eq('property_id', pid)
      .gte('night_date', fromIso)
      .lte('night_date', toIso)
      .order('night_date');
    const cap = capacity;
    const heat = ((pace ?? []) as Array<{ night_date: string; confirmed_rooms: number }>).map((r) => {
      const d = new Date(r.night_date + 'T00:00:00Z');
      return {
        day:   String(d.getUTCDate()).padStart(2, '0'),
        month: `${d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} ${String(d.getUTCFullYear()).slice(2)}`,
        occ:   cap > 0 ? Math.round((Number(r.confirmed_rooms ?? 0) / cap) * 100) : 0,
      };
    });
    return (
      <DashboardPage title="Revenue · Calendar" subtitle="forward OTB occupancy · next 90 days" tabs={tabs}>
        {stripBlock}
        <div style={fullRow}>
          <Container title="OTB occupancy · forward 90d" subtitle="occupancy % per night · confirmed rooms ÷ sellable · colour intensity = % occ · hover any cell for month · day · occ%">
            <Chart
              variant="heatmap"
              data={heat}
              xKey="day"
              yKey="month"
              series={[{ key: 'occ', label: 'Occ %' }]}
              valueSuffix="%"
              height={Math.max(220, Math.min(560, new Set(heat.map((c) => c.month)).size * 60))}
              empty={{ title: 'No OTB rows in next 90 days' }}
            />
          </Container>
        </div>
      </DashboardPage>
    );
  }


  // ─── Tab: Restrictions (MinLOS + stop-sell) ───────────────────────────
  // PBS 2026-07-08 SEMANTIC FIX: split BAR (base rate plan MIN) from package
  // MLS (derived/standalone MAX). Old page did MAX across ALL plans → showed
  // 12/4/3 nights on days where a walk-in on BAR flex would face MLS=1.
  // Source: public.v_rate_inventory_typed (join on rate_plans.rate_type).
  if (tab === 'restrictions') {
    const roff = Math.max(0, Math.min(11, Number(searchParams.roff ?? 0)));
    const todayD = new Date(); todayD.setUTCHours(0,0,0,0);
    const startD = new Date(todayD); startD.setUTCDate(todayD.getUTCDate() + roff * 7);
    const endD = new Date(startD); endD.setUTCDate(startD.getUTCDate() + 6);
    const fromIso = startD.toISOString().slice(0,10);
    const toIso = endD.toISOString().slice(0,10);
    const [roomTypes, invResp] = await Promise.all([
      getRoomTypes(pid),
      supabase
        .from('v_rate_inventory_typed')
        .select('room_type_id, inventory_date, minimum_stay, stop_sell, rate_plan_type')
        .eq('property_id', pid)
        .gte('inventory_date', fromIso)
        .lte('inventory_date', toIso),
    ]);
    type InvRow = {
      room_type_id: number;
      inventory_date: string;
      minimum_stay: number | null;
      stop_sell: boolean | null;
      rate_plan_type: 'base' | 'derived' | 'standalone' | null;
    };
    const inv: InvRow[] = (invResp.data ?? []) as InvRow[];
    const baseRows = inv.filter((r) => r.rate_plan_type === 'base');
    const pkgRows  = inv.filter((r) => r.rate_plan_type === 'derived' || r.rate_plan_type === 'standalone');

    const dateCols: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startD); d.setUTCDate(startD.getUTCDate() + i);
      dateCols.push(d.toISOString().slice(0,10));
    }
    const WEEKDAY = (iso: string) => {
      const dt = new Date(`${iso}T00:00:00Z`);
      return dt.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    };

    // BAR cell = MIN(minimum_stay) on base rows (99 if any stop_sell).
    const barCellMap = new Map<string, number>();
    for (const r of baseRows) {
      const stop = Boolean(r.stop_sell);
      const mls  = Number(r.minimum_stay ?? 1);
      const date = String(r.inventory_date ?? '').slice(0, 10);
      const rt   = roomTypes.find((x) => x.room_type_id === r.room_type_id);
      const rtName = rt?.room_type_name ?? `room_${r.room_type_id}`;
      const key = `${date}|${rtName}`;
      if (stop) { barCellMap.set(key, 99); continue; }
      const cur = barCellMap.get(key);
      // MIN semantics: lowest MLS on base plans = true BAR restriction.
      if (cur == null || cur === 99 || mls < cur) barCellMap.set(key, mls);
    }
    // Package cell = MAX(minimum_stay) on derived/standalone (advisory).
    const pkgCellMap = new Map<string, number>();
    for (const r of pkgRows) {
      const mls  = Number(r.minimum_stay ?? 1);
      const date = String(r.inventory_date ?? '').slice(0, 10);
      const rt   = roomTypes.find((x) => x.room_type_id === r.room_type_id);
      const rtName = rt?.room_type_name ?? `room_${r.room_type_id}`;
      const key = `${date}|${rtName}`;
      const cur = pkgCellMap.get(key);
      if (cur == null || mls > cur) pkgCellMap.set(key, mls);
    }

    const roomNames = Array.from(new Set(roomTypes.map((rt) => rt.room_type_name))).sort();
    const rhref = (n: number) => `${basePath}?tab=restrictions&roff=${n}`;
    const pillStyle: React.CSSProperties = {
      display: 'inline-block', padding: '4px 10px', border: '1px solid #000', borderRadius: 4,
      background: '#FFFFFF', color: '#000', fontSize: 11, fontWeight: 500, textDecoration: 'none',
      letterSpacing: '0.06em', textTransform: 'uppercase',
    };
    const navBlock = (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <a href={rhref(Math.max(0, roff - 1))} style={{ ...pillStyle, opacity: roff === 0 ? 0.4 : 1, pointerEvents: roff === 0 ? 'none' : 'auto' }}>← prev 7</a>
        {roff !== 0 && <a href={rhref(0)} style={pillStyle}>today</a>}
        <a href={rhref(Math.min(11, roff + 1))} style={{ ...pillStyle, opacity: roff >= 11 ? 0.4 : 1, pointerEvents: roff >= 11 ? 'none' : 'auto' }}>next 7 →</a>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#5A5A5A', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{fromIso} → {toIso}</span>
      </div>
    );

    // Donna empty state: rate_inventory doesn't feed Mews yet.
    if (baseRows.length === 0 && pkgRows.length === 0) {
      return (
        <DashboardPage title="Revenue · Calendar" subtitle={`restrictions · ${fromIso} → ${toIso}`} tabs={tabs}>
          {stripBlock}
          <div style={fullRow}>
            <Container title="Length-of-stay restrictions" subtitle={`${fromIso} → ${toIso}`}>
              {navBlock}
              <div style={{
                background: '#FAFAF7', border: '1px solid #E6DFCC', borderRadius: 6,
                padding: '32px 24px', textAlign: 'center', color: '#5A5A5A', fontSize: 13, lineHeight: 1.5,
              }}>
                Restrictions view is Cloudbeds-only. Mews restrictions ingestion is not yet wired.
              </div>
            </Container>
          </div>
        </DashboardPage>
      );
    }

    const renderGrid = (cellMap: Map<string, number>) => (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed', background: '#FFFFFF' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #E6DFCC', fontWeight: 600, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Room type</th>
            {dateCols.map((d) => (
              <th key={d} style={{ textAlign: 'center', padding: '6px 4px', borderBottom: '1px solid #E6DFCC', fontWeight: 600, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', width: 72 }}>
                {WEEKDAY(d)} {d.slice(5)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {roomNames.map((room) => (
            <tr key={room}>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #E6DFCC', fontWeight: 500, fontSize: 12, background: '#FFFFFF' }}>{room}</td>
              {dateCols.map((d) => {
                const v = cellMap.get(`${d}|${room}`);
                const bg = v === 99 ? '#FCE7E6' : (v != null && v > 1) ? '#FEF8E0' : '#FFFFFF';
                const txt = v === 99 ? '×' : v != null ? String(v) : '·';
                const color = v === 99 ? '#900' : '#1B1B1B';
                return (
                  <td key={d} style={{ padding: '6px 4px', borderBottom: '1px solid #E6DFCC', textAlign: 'center', fontVariantNumeric: 'tabular-nums', fontSize: 12, background: bg, color, width: 72 }}>
                    {txt}
                  </td>
                );
              })}
            </tr>
          ))}
          {roomNames.length === 0 && (
            <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: '#5A5A5A', background: '#FFFFFF' }}>No room types found</td></tr>
          )}
        </tbody>
      </table>
    );

    return (
      <DashboardPage title="Revenue · Calendar" subtitle={`restrictions · ${fromIso} → ${toIso}`} tabs={tabs}>
        {stripBlock}
        <div style={fullRow}>
          <Container
            title="Length-of-stay restrictions · BAR only · next 7 days"
            subtitle="MIN(minimum_stay) on rate_type='base' plans only. This is what a walk-in guest faces on the standard flex rate."
          >
            {navBlock}
            {renderGrid(barCellMap)}
          </Container>
        </div>
        <div style={fullRow}>
          <Container
            title="Package rate plan MLS (advisory)"
            subtitle="MAX(minimum_stay) across derived/standalone plans (Members, Stay 4 Pay 3, Long Stay, Retreats). NOT a BAR restriction — reflects the longest package length offered."
          >
            {renderGrid(pkgCellMap)}
          </Container>
        </div>
        <div style={fullRow}>
          <div style={{ padding: '8px 12px', fontSize: 11, color: '#5A5A5A', letterSpacing: '0.04em' }}>
            · = open · N = min nights · × = stop-sell (99)
          </div>
        </div>
      </DashboardPage>
    );
  }


  // ─── Default: Pricing tab (the original, kept intact) ────────────────
  const period = resolvePeriod({ win });
  const [roomTypes, ratePlans, inventory, todayKpis, barPromoResp] = await Promise.all([
    getRoomTypes(pid),
    getRatePlans(pid),
    getRateInventory(period.from, period.to, { propertyId: pid }),
    getPricingKpis(pid),
    // PBS 2026-07-08: split BAR (base rate plan) vs Lowest promo (cheapest derived/standalone).
    supabase.from('v_bar_and_promo_today')
      .select('bar_rate, bar_plan, bar_room, bar_min_stay, promo_rate, promo_plan, promo_room, promo_min_stay')
      .eq('property_id', pid)
      .maybeSingle(),
  ]);
  void ratePlans;
  const barPromo = (barPromoResp.data ?? null) as {
    bar_rate: number | null; bar_plan: string | null; bar_room: string | null; bar_min_stay: number | null;
    promo_rate: number | null; promo_plan: string | null; promo_room: string | null; promo_min_stay: number | null;
  } | null;

  // PBS 2026-06-08 — also build the rate heatmap (was on the dropped Rate tab)
  const _rateCellMap = new Map<string, number>();
  for (const r of inventory) {
    const rate = Number(r.rate);
    const stop = Boolean((r as unknown as Record<string, unknown>).stop_sell);
    if (stop || rate < RATE_MIN) continue;
    const date = String((r as unknown as Record<string, unknown>).inventory_date ?? '').slice(0, 10);
    const rt = roomTypes.find((x) => x.room_type_id === r.room_type_id);
    const rtName = rt?.room_type_name ?? `room_${r.room_type_id}`;
    const key = `${date}|${rtName}`;
    const cur = _rateCellMap.get(key);
    if (cur == null || rate < cur) _rateCellMap.set(key, rate);
  }
  const rateHeatmap = Array.from(_rateCellMap.entries()).map(([key, rate]) => {
    const [date, room] = key.split('|');
    return { date, room, rate: Math.round(rate) };
  });

  // PBS 2026-07-08 audit: filter stop_sell=false BEFORE aggregating (single stray
  // dev rate under a closed cell used to leak into Ceiling / BAR floor). Also,
  // stop-sell + MinLOS counts must be de-duplicated to the (date, room) level so
  // the numbers match what a manager sees on the calendar heatmap — the raw
  // rate_inventory table has one row per (date, room, rate_plan), so counting
  // rows over-inflates by ~10x (there are ~10 rate plans per room).
  const sellableRates = inventory
    .filter((r) => !r.stop_sell)
    .map((r) => Number(r.rate) || 0)
    .filter((x) => x >= RATE_MIN);
  const avgRate = sellableRates.length > 0 ? sellableRates.reduce((a, b) => a + b, 0) / sellableRates.length : 0;
  const minRate = sellableRates.length > 0 ? Math.min(...sellableRates) : 0;
  const maxRate = sellableRates.length > 0 ? Math.max(...sellableRates) : 0;
  const totalInv = inventory.length;
  const stopSellDays = new Set<string>();
  const minLosDays = new Set<string>();
  for (const r of inventory) {
    const dateKey = String((r as unknown as Record<string, unknown>).inventory_date ?? '').slice(0, 10);
    const key = `${dateKey}|${r.room_type_id}`;
    if (r.stop_sell) stopSellDays.add(key);
    if ((Number(r.minimum_stay) || 0) > 1) minLosDays.add(key);
  }
  const stopSells = stopSellDays.size;
  const minStayRows = minLosDays.size;
  // window span (days) so footnotes state the actual horizon
  const winDays = Math.max(1, Math.round(
    (new Date(period.to).getTime() - new Date(period.from).getTime()) / 86400000
  ));

  const k = todayKpis;
  const compGap = (k.barToday != null && k.compMedian != null) ? k.barToday - k.compMedian : null;

  const today = new Date(); today.setUTCHours(0,0,0,0);
  const todayIso = today.toISOString().slice(0, 10);
  const horizon = new Date(today); horizon.setUTCDate(today.getUTCDate() + 13);
  const horizonIso = horizon.toISOString().slice(0, 10);
  const cellMap = new Map<string, number>();
  for (const r of inventory) {
    const rate = Number(r.rate);
    const stop = Boolean((r as unknown as Record<string, unknown>).stop_sell);
    if (stop || rate < RATE_MIN) continue;
    const date = String((r as unknown as Record<string, unknown>).inventory_date ?? '').slice(0, 10);
    if (date < todayIso || date > horizonIso) continue;
    const rt = roomTypes.find((x) => x.room_type_id === r.room_type_id);
    const rtName = rt?.room_type_name ?? `room_${r.room_type_id}`;
    const key = `${date}|${rtName}`;
    const cur = cellMap.get(key);
    if (cur == null || rate < cur) cellMap.set(key, rate);
  }
  const heatmapData = Array.from(cellMap.entries()).map(([key, rate]) => {
    const [date, room] = key.split('|');
    return { date, room, rate: Math.round(rate) };
  });

  // PBS 2026-07-08 audit — every label & footnote rewritten so a revenue manager
  // sees (a) what the number IS and (b) where it comes from. Comp gap now shows
  // "—" when compset has no rows for today (was silently rendering 0 = "we're
  // even with the comp set", which is the wrong story). Stop-sell / MinLOS
  // counts are room-days (matches heatmap), not raw rate_inventory rows.
  // PBS 2026-07-08: two separate tiles.
  //   BAR         = lowest rate_type='base' rate  → true walk-in Best Available Rate
  //   Lowest promo = lowest across ALL derived/standalone plans (includes packages)
  // Both show the source rate_plan name in the footnote so an RM can trace the number.
  const barRate     = barPromo?.bar_rate     != null ? Number(barPromo.bar_rate)     : null;
  const promoRate   = barPromo?.promo_rate   != null ? Number(barPromo.promo_rate)   : null;
  // Comp gap is now BAR (base plan) − comp median, so it compares apples to apples.
  const compGapBar  = barRate != null && k.compMedian != null ? barRate - k.compMedian : null;

  const actionableTiles: KpiTileProps[] = [
    { label: 'BAR today', value: barRate != null ? Math.round(barRate) : '—', currency: moneyCurrency, size: 'sm',
      footnote: barRate != null && barPromo?.bar_plan
        ? `${barPromo.bar_plan} · ${barPromo.bar_min_stay ?? 1}n min · base rate plan`
        : `no base rate plan posted today`,
      status: barRate != null ? 'green' : 'grey' },
    { label: 'Lowest promo', value: promoRate != null ? Math.round(promoRate) : '—', currency: moneyCurrency, size: 'sm',
      footnote: promoRate != null && barPromo?.promo_plan
        ? `${barPromo.promo_plan} · ${barPromo.promo_min_stay ?? 1}n min`
        : `no promo rate posted today`,
      status: promoRate != null ? 'green' : 'grey' },
    { label: 'Comp gap',
      value: compGapBar != null ? Math.round(compGapBar) : '—',
      currency: moneyCurrency, size: 'sm',
      footnote: compGapBar != null
        ? `BAR ${currencySym}${Math.round(barRate!)} − comp median ${currencySym}${Math.round(k.compMedian!)} · ${k.compRows} comp rows today`
        : `no comp rows scraped for today · v_compset_competitor_rate_matrix`,
      status: compGapBar == null ? 'grey' : compGapBar >= 0 ? 'green' : 'amber' },
    { label: 'OCC today', value: k.occPctToday != null ? `${Math.round(k.occPctToday)}%` : '—', size: 'sm',
      footnote: k.occPctToday != null
        ? `${k.roomsSold ?? 0} sold ÷ ${capacity} sellable units · ${propertyLabel}`
        : `no rooms_sold row for today · v_kpi_daily`,
      status: k.occPctToday != null ? 'green' : 'grey' },
    // PBS 2026-07-08: dedupe to (date × room-type). Old count was inflated ~9× by
    // rate-plan multiplication (3,878 raw cells → 140 real room-days for Namkhan).
    { label: 'Sellable 14d', value: k.sellable14d ?? 0, size: 'sm',
      footnote: `open (date × room-type) combos · next 14d · ≥ 1 sellable rate`,
      status: (k.sellable14d ?? 0) > 0 ? 'green' : 'grey' },
  ];

  const windowLabel = `+${winDays}d`;
  const windowTiles: KpiTileProps[] = [
    { label: 'Avg posted', value: Math.round(avgRate), currency: moneyCurrency, size: 'sm',
      footnote: `mean of every open rate cell · ${windowLabel} · sellable only`,
      status: avgRate > 0 ? 'green' : 'grey' },
    { label: 'BAR floor', value: Math.round(minRate), currency: moneyCurrency, size: 'sm',
      footnote: `cheapest open rate in ${windowLabel} (${currencySym}${Math.round(minRate)}) · sellable only`,
      status: minRate > 0 ? 'green' : 'grey' },
    { label: 'BAR ceiling', value: Math.round(maxRate), currency: moneyCurrency, size: 'sm',
      footnote: `dearest open rate in ${windowLabel} (${currencySym}${Math.round(maxRate)}) · sellable only`,
      status: maxRate > 0 ? 'green' : 'grey' },
    { label: 'Stop-sell days', value: stopSells, size: 'sm',
      footnote: `room × day combos closed to sale · ${windowLabel} · rate_inventory.stop_sell=true`,
      status: stopSells > 0 ? 'amber' : 'green' },
    { label: 'MinLOS days', value: minStayRows, size: 'sm',
      footnote: `room × day combos with min-stay > 1 · ${windowLabel} · rate_inventory.minimum_stay`,
      status: minStayRows > 0 ? 'amber' : 'green' },
  ];

  // ── #138: 30-day calendar with arrow nav (URL ?off=0/30/60/90) ──────────
  const offRaw = Number((searchParams as Record<string, string | string[] | undefined>).off ?? 0);
  const calOff = Number.isFinite(offRaw) ? Math.max(0, Math.min(90, Math.trunc(offRaw))) : 0;
  const calFrom = new Date(); calFrom.setUTCHours(0, 0, 0, 0); calFrom.setUTCDate(calFrom.getUTCDate() + calOff);
  const calTo = new Date(calFrom); calTo.setUTCDate(calFrom.getUTCDate() + 29);
  const calFromIso = calFrom.toISOString().slice(0, 10);
  const calToIso = calTo.toISOString().slice(0, 10);
  const { data: pricingCal } = await supabase
    .from('v_chart_pricing_calendar_30d')
    .select('day, base_rate, rooms_available, occ_pct, occ_category, all_stop_sell, stop_sell_cells, rooms_sold, total_rooms')
    .eq('property_id', pid)
    .gte('day', calFromIso)
    .lte('day', calToIso)
    .order('day');
  const calByDay = new Map<string, Record<string, unknown>>();
  for (const r of (pricingCal ?? []) as Array<Record<string, unknown>>) calByDay.set(String(r.day).slice(0, 10), r);
  // Local calendar sym alias — mirrors moneyCurrency but kept as literal char so
  // it composes cleanly into calendar cell labels below.
  const sym = currencySym;
  const pricingCalendarDays: CalendarDay[] = (() => {
    const out: CalendarDay[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(calFrom); d.setUTCDate(calFrom.getUTCDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const row = calByDay.get(iso);
      const rate = row && row.base_rate != null ? Math.round(Number(row.base_rate)) : null;
      const avail = row && row.rooms_available != null ? Number(row.rooms_available) : null;
      const occ = row && row.occ_pct != null ? Number(row.occ_pct) : null;
      const cat = row ? String(row.occ_category ?? 'unknown') : 'unknown';
      const tone: CalendarDay['tone'] =
        row && row.all_stop_sell === true ? 'red' :
        cat === 'high' ? 'green' :
        cat === 'mid'  ? 'amber' :
        cat === 'low'  ? 'red'   :
        undefined;
      out.push({
        date: iso,
        label: rate != null ? `${sym}${rate}` : '—',
        tone,
        tooltip: [
          iso,
          rate != null ? `Base rate: ${sym}${rate}` : 'Base rate: —',
          avail != null ? `Rooms available: ${avail}` : 'Rooms available: —',
          occ != null  ? `Occ: ${occ.toFixed(1)}%` : 'Occ: —',
          `OCC category: ${cat}`,
        ].join('\n'),
      });
    }
    return out;
  })();
  const calHref = (newOff: number) => {
    const p = new URLSearchParams();
    if (newOff !== 0) p.set('off', String(newOff));
    const qs = p.toString();
    return `${basePath}${qs ? '?' + qs : ''}`;
  };
  const calRangeLabel = `${calFromIso} → ${calToIso}`;
  const calPillStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 11, padding: '4px 10px', borderRadius: 99,
    border: `1px solid ${active ? 'var(--primary, #1F3A2E)' : 'var(--hairline, #E6DFCC)'}`,
    background: active ? 'var(--primary, #1F3A2E)' : 'var(--paper, #FFFFFF)',
    color: active ? '#FFFFFF' : 'var(--ink-soft, #5A5A5A)',
    textDecoration: 'none', fontWeight: active ? 600 : 500,
    letterSpacing: '0.06em', textTransform: 'uppercase',
  });

  // PBS 2026-06-08 #124 — 3 dynamic graphs at the bottom
  const [dowResp, leadResp] = await Promise.all([
    supabase.from('v_pricing_dow_positioning').select('dow, dow_label, avg_namkhan_usd, avg_comp_median_usd, avg_comp_cheapest_usd, avg_comp_dearest_usd').order('dow'),
    supabase.from('v_pricing_leadtime_pattern').select('leadtime_bucket, avg_rate_usd, obs_count').eq('is_self', true),
  ]);
  type DowRow = { dow: number; dow_label: string; avg_namkhan_usd: number | null; avg_comp_median_usd: number | null; avg_comp_cheapest_usd: number | null; avg_comp_dearest_usd: number | null };
  type LeadRow = { leadtime_bucket: string; avg_rate_usd: number | null; obs_count: number };
  const dowData = ((dowResp.data ?? []) as DowRow[]).map((r) => ({
    dow_label: r.dow_label,
    namkhan: Number(r.avg_namkhan_usd ?? 0),
    comp_median: Number(r.avg_comp_median_usd ?? 0),
    comp_cheap: Number(r.avg_comp_cheapest_usd ?? 0),
    comp_dear: Number(r.avg_comp_dearest_usd ?? 0),
  }));
  const LEAD_ORDER = ['0-7d', '8-14d', '15-30d', '31-60d', '61-90d', '90d+'];
  const leadData = ((leadResp.data ?? []) as LeadRow[])
    .slice()
    .sort((a, b) => LEAD_ORDER.indexOf(a.leadtime_bucket) - LEAD_ORDER.indexOf(b.leadtime_bucket))
    .map((r) => ({ bucket: r.leadtime_bucket, rate: Math.round(Number(r.avg_rate_usd ?? 0)) }));
  const occRateRows: { day: string; rate: number; occ: number }[] = (() => {
    const out: { day: string; rate: number; occ: number }[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(calFrom); d.setUTCDate(calFrom.getUTCDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const row = calByDay.get(iso);
      const rate = row && row.base_rate != null ? Math.round(Number(row.base_rate)) : 0;
      const occ = row && row.occ_pct != null ? Math.round(Number(row.occ_pct) * 10) / 10 : 0;
      out.push({ day: iso.slice(5), rate, occ });
    }
    return out;
  })();

  return (
    <DashboardPage title="Revenue · Calendar" subtitle={`pricing · ${period.label}`} tabs={tabs}>
      {stripBlock}

      {/* PBS 2026-07-08: both KPI rows (actionable now + window aggregates) merged
          into a single Headline container using the HoD tile grid (minmax(160px,
          1fr) · gap 8 · compact density) so this page reads the same as /revenue. */}
      <div style={fullRow}>
        <Container
          title="Headline"
          subtitle={`snapshot · actionable now · window ${period.label}`}
          density="compact"
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            {[...actionableTiles, ...windowTiles].map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>
      </div>

      {/* PBS 2026-07-08: OCC × BAR combo moved up here from the bottom — it's the
          "at-a-glance" pricing-vs-demand read that belongs near the KPI tiles. */}
      <div style={fullRow}>
        <Container title="OCC × BAR · next 30 days" subtitle="bar: base sellable rate · line: forward OCC % per day — spot pricing gaps where high OCC meets low BAR (or vice-versa)">
          <Chart variant="combo" data={occRateRows} xKey="day"
            series={[
              { key: 'rate', label: `BAR (${moneyCurrency})`, type: 'bar' },
              { key: 'occ',  label: 'OCC %',     type: 'line' },
            ]}
            height={280}
            empty={{ title: 'No 30d rate data' }}
          />
        </Container>
      </div>

      <WindowPills win={win} basePath={basePath} />

      <div style={fullRow}>
        <Container title={`30-day pricing calendar · ${calRangeLabel}`} subtitle="hover any day for base rate · rooms available · OCC · category. arrow to slide next month (max +90d)">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 10 }}>
            <a href={calHref(Math.max(0, calOff - 30))} style={{ ...calPillStyle(false), opacity: calOff === 0 ? 0.4 : 1 }}>← prev 30d</a>
            {calOff !== 0 && <a href={calHref(0)} style={calPillStyle(false)}>today</a>}
            <a href={calHref(Math.min(90, calOff + 30))} style={{ ...calPillStyle(false), opacity: calOff >= 90 ? 0.4 : 1 }}>next 30d →</a>
          </div>
          <MonthCalendar days={pricingCalendarDays} variant="occ" />
        </Container>
      </div>

      <div style={fullRow}>
        <Container title="Two-week glance · cheapest sellable rate" subtitle={`date × room type · ${moneyCurrency} per night · next 14d`}>
          <Chart variant="heatmap" data={heatmapData} xKey="date" yKey="room"
            series={[{ key: 'rate', label: `Rate (${moneyCurrency})` }]}
            height={Math.max(220, Math.min(560, new Set(heatmapData.map((d) => d.room)).size * 40))}
            empty={{ title: 'No sellable rates in next 14 days' }}
          />
        </Container>
      </div>

      {/* PBS #124 — 3 dynamic graphs */}
      <div style={fullRow}>
        <Container title="Day-of-week rate positioning · own vs comp set" subtitle="avg sellable rate per weekday — Namkhan vs comp set median/cheapest/dearest">
          <Chart variant="bar" data={dowData} xKey="dow_label"
            series={[
              { key: 'namkhan',     label: 'Namkhan' },
              { key: 'comp_median', label: 'Comp median' },
              { key: 'comp_cheap',  label: 'Cheapest comp' },
              { key: 'comp_dear',   label: 'Dearest comp' },
            ]}
            height={280}
            empty={{ title: 'No DOW data yet' }}
          />
        </Container>
      </div>

      <div style={fullRow}>
        <Container title="Lead-time rate pattern · price by booking window" subtitle="avg sellable rate by lead-time bucket — flags pricing drift between near-in and far-out windows">
          <Chart variant="bar" data={leadData} xKey="bucket"
            series={[{ key: 'rate', label: `Avg rate (${moneyCurrency})` }]}
            height={260}
            empty={{ title: 'No lead-time data yet' }}
          />
        </Container>
      </div>

    </DashboardPage>
  );
}

function CalendarTabStrip({ active, basePath = '/revenue/pricing' }: { active: CalendarTab; basePath?: string }) {
  // PBS 2026-07-08: mirror the LighthouseNav underline pattern — flat text tabs
  // with a hairline row border and a dark-green underline for the active view.
  return (
    <nav
      role="tablist"
      aria-label="Calendar views"
      style={{
        display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
        padding: '6px 0', borderBottom: '1px solid #E6DFCC',
      }}
    >
      {VALID_TABS.map((key) => {
        const isActive = key === active;
        const href = key === 'pricing' ? basePath : `${basePath}?tab=${key}`;
        return (
          <a
            key={key}
            href={href}
            role="tab"
            aria-selected={isActive}
            style={{
              padding: '6px 10px', fontSize: 12,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? '#1B1B1B' : '#5A5A5A',
              textDecoration: 'none',
              borderBottom: `2px solid ${isActive ? '#084838' : 'transparent'}`,
            }}
          >
            {TAB_LABELS[key]}
          </a>
        );
      })}
    </nav>
  );
}

function WindowPills({ win, basePath }: { win: WindowKey; basePath: string }) {
  return (
    <div style={fullRow}>
      <Container title="Window" subtitle="forward horizon" density="compact">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
          {VALID_FWD.map((w) => {
            const active = w === win;
            const sep = basePath.includes('?') ? '&' : '?';
            const href = w === 'next90' ? basePath : `${basePath}${sep}win=${w}`;
            return (
              <a key={w} href={href} style={{
                fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: active ? 600 : 500,
                padding: '4px 10px', borderRadius: 99,
                border: `1px solid ${active ? 'var(--primary, #1F3A2E)' : 'var(--hairline, #E6DFCC)'}`,
                background: active ? 'var(--primary, #1F3A2E)' : 'var(--paper, #FFFFFF)',
                color: active ? '#FFFFFF' : 'var(--ink-soft, #5A5A5A)',
                textDecoration: 'none',
              }}>{w.replace('next', '+')}</a>
            );
          })}
        </div>
      </Container>
    </div>
  );
}

const emptyStyle: React.CSSProperties = { padding: '24px 8px', textAlign: 'center', color: 'var(--ink-soft, #5A5A5A)', fontSize: 12 };
const linkStyle: React.CSSProperties = { color: 'var(--primary, #1F3A2E)', fontWeight: 600 };
