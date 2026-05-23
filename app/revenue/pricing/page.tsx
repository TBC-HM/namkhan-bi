// app/revenue/pricing/page.tsx
// 2026-05-22 Calendar hub — 7 tabs covering every date view a revenue
// manager needs: pricing · holidays · otb_density · pickup · rate ·
// restrictions · parity. Reuses existing primitives (Chart variant=heatmap +
// PickupMatrix). Backwards-compat: legacy `?tab=density` redirects to
// `?tab=holidays` (PBS 2026-05-22 — "Density" was misleading, it was always
// just the country-holidays overlay).

import Link from 'next/link';
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

type CalendarTab = 'pricing' | 'holidays' | 'otb_density' | 'rate' | 'restrictions' | 'parity';
const VALID_TABS: CalendarTab[] = ['pricing','holidays','otb_density','rate','restrictions','parity'];
const TAB_LABELS: Record<CalendarTab, string> = {
  pricing:      'Pricing',
  holidays:     'Holidays',
  otb_density:  'OTB Density',
  rate:         'Rate',
  restrictions: 'Restrictions',
  parity:       'Parity',
};
function parseTab(raw: string | undefined): CalendarTab {
  if (raw === 'density') return 'holidays'; // backwards-compat
  return (VALID_TABS.includes(raw as CalendarTab) ? raw : 'pricing') as CalendarTab;
}

const VALID_FWD: WindowKey[] = ['next7','next30','next90','next180','next365'];
const CAPACITY_FIXED_LABEL = 30;
const RATE_MIN = 10;

function parseWin(raw: string | undefined): WindowKey {
  return (VALID_FWD.includes(raw as WindowKey) ? raw : 'next90') as WindowKey;
}

interface SearchParams { win?: string; gran?: string; cmp?: string; tab?: string; y?: string; school?: string }

const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };

export default async function PricingPage({ searchParams, propertyId }: { searchParams: SearchParams; propertyId?: number }) {
  const tab = parseTab(searchParams.tab);
  const pid = propertyId ?? NAMKHAN_PROPERTY_ID;
  const isNamkhan = pid === NAMKHAN_PROPERTY_ID;
  const capacity = isNamkhan ? 30 : 64;
  const propertyLabel = isNamkhan ? 'Namkhan' : pid === 1000001 ? 'Donna' : `Property ${pid}`;
  const basePath = isNamkhan ? '/revenue/pricing' : `/h/${pid}/revenue/pricing`;
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, pid);
  const tabs: DashboardTab[] = subPages.map((s) => ({ key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/pricing') }));
  const win = parseWin(searchParams.win);

  const stripBlock = (
    <div style={fullRow}>
      <Container title="Calendar" subtitle="pricing · holidays · OTB density · rate · restrictions · parity" density="compact">
        <CalendarTabStrip active={tab} basePath={basePath} />
      </Container>
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
          <Container title="OTB occupancy · forward 90d" subtitle="confirmed rooms ÷ sellable · per night · colour by % occ">
            <Chart
              variant="heatmap"
              data={heat}
              xKey="day"
              yKey="month"
              series={[{ key: 'occ', label: 'Occ %' }]}
              height={Math.max(220, Math.min(560, new Set(heat.map((c) => c.month)).size * 60))}
              empty={{ title: 'No OTB rows in next 90 days' }}
            />
          </Container>
        </div>
      </DashboardPage>
    );
  }

  // ─── Tab: Rate calendar (date × room-type, extended window) ───────────
  if (tab === 'rate') {
    const period = resolvePeriod({ win });
    const [roomTypes, inventory] = await Promise.all([
      getRoomTypes(pid),
      getRateInventory(period.from, period.to, { propertyId: pid }),
    ]);
    const cellMap = new Map<string, number>();
    for (const r of inventory) {
      const rate = Number(r.rate);
      const stop = Boolean((r as unknown as Record<string, unknown>).stop_sell);
      if (stop || rate < RATE_MIN) continue;
      const date = String((r as unknown as Record<string, unknown>).inventory_date ?? '').slice(0, 10);
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
    return (
      <DashboardPage title="Revenue · Calendar" subtitle={`rate calendar · ${period.label}`} tabs={tabs}>
        {stripBlock}
        <WindowPills win={win} basePath={`${basePath}?tab=rate`} />
        <div style={fullRow}>
          <Container title="Rate calendar · date × room type" subtitle={`cheapest sellable rate · USD · ${period.label}`}>
            <Chart
              variant="heatmap"
              data={heatmapData}
              xKey="date"
              yKey="room"
              series={[{ key: 'rate', label: 'Rate (USD)' }]}
              height={Math.max(240, Math.min(720, new Set(heatmapData.map((d) => d.room)).size * 44))}
              empty={{ title: 'No sellable rates in window' }}
            />
          </Container>
        </div>
      </DashboardPage>
    );
  }

  // ─── Tab: Restrictions (MinLOS + stop-sell) ───────────────────────────
  if (tab === 'restrictions') {
    const today = new Date(); today.setUTCHours(0,0,0,0);
    const horizon = new Date(today); horizon.setUTCDate(today.getUTCDate() + 60);
    const fromIso = today.toISOString().slice(0,10);
    const toIso = horizon.toISOString().slice(0,10);
    const [roomTypes, inventory] = await Promise.all([
      getRoomTypes(pid),
      getRateInventory(fromIso, toIso, { propertyId: pid }),
    ]);
    const cellMap = new Map<string, number>();
    for (const r of inventory) {
      const stop = Boolean((r as unknown as Record<string, unknown>).stop_sell);
      const mls  = Number(r.minimum_stay ?? 1);
      const value = stop ? 99 : mls;
      const date = String((r as unknown as Record<string, unknown>).inventory_date ?? '').slice(0, 10);
      const rt = roomTypes.find((x) => x.room_type_id === r.room_type_id);
      const rtName = rt?.room_type_name ?? `room_${r.room_type_id}`;
      const key = `${date}|${rtName}`;
      const cur = cellMap.get(key);
      if (cur == null || value > cur) cellMap.set(key, value);
    }
    const data = Array.from(cellMap.entries()).map(([key, value]) => {
      const [date, room] = key.split('|');
      return { date, room, restriction: value };
    });
    return (
      <DashboardPage title="Revenue · Calendar" subtitle="restrictions · MinLOS + stop-sell · next 60d" tabs={tabs}>
        {stripBlock}
        <div style={fullRow}>
          <Container title="Restrictions calendar" subtitle="cell = nights MinLOS · 99 (red) = stop-sell · next 60d">
            <Chart
              variant="heatmap"
              data={data}
              xKey="date"
              yKey="room"
              series={[{ key: 'restriction', label: 'MinLOS · 99=stop' }]}
              height={Math.max(220, Math.min(560, new Set(data.map((d) => d.room)).size * 44))}
              empty={{ title: 'No active restrictions next 60d' }}
            />
          </Container>
        </div>
      </DashboardPage>
    );
  }

  // ─── Tab: Parity (date × OTA gap USD vs cheapest BAR) ─────────────────
  if (tab === 'parity') {
    const today = new Date(); today.setUTCHours(0,0,0,0);
    const horizon = new Date(today); horizon.setUTCDate(today.getUTCDate() + 60);
    const fromIso = today.toISOString().slice(0,10);
    const toIso = horizon.toISOString().slice(0,10);
    const [compResp, inventory] = await Promise.all([
      supabase.from('v_compset_competitor_rate_matrix')
        .select('stay_date, channel, rate_usd, is_available')
        .gte('stay_date', fromIso)
        .lte('stay_date', toIso),
      getRateInventory(fromIso, toIso, { propertyId: pid }),
    ]);
    const comp = (compResp.data ?? []) as Array<{ stay_date: string; channel: string; rate_usd: number | null; is_available: boolean | null }>;
    const bar = new Map<string, number>();
    for (const r of inventory) {
      const rate = Number(r.rate);
      const stop = Boolean((r as unknown as Record<string, unknown>).stop_sell);
      if (stop || rate < RATE_MIN) continue;
      const date = String((r as unknown as Record<string, unknown>).inventory_date ?? '').slice(0, 10);
      const cur = bar.get(date);
      if (cur == null || rate < cur) bar.set(date, rate);
    }
    const cellMap = new Map<string, number[]>();
    for (const r of comp) {
      if (r.is_available === false || r.rate_usd == null) continue;
      const ourRate = bar.get(r.stay_date);
      if (ourRate == null) continue;
      const gap = ourRate - Number(r.rate_usd);
      const key = `${r.stay_date}|${r.channel || 'unknown'}`;
      const arr = cellMap.get(key) ?? [];
      arr.push(gap);
      cellMap.set(key, arr);
    }
    const data = Array.from(cellMap.entries()).map(([key, gaps]) => {
      const [date, channel] = key.split('|');
      const avg = gaps.reduce((s, x) => s + x, 0) / gaps.length;
      return { date, channel, gap: Math.round(avg) };
    });
    return (
      <DashboardPage title="Revenue · Calendar" subtitle="parity · our BAR vs comp set · next 60d" tabs={tabs}>
        {stripBlock}
        <div style={fullRow}>
          <Container title="Parity calendar · date × OTA gap (USD)" subtitle="positive = we are MORE expensive than channel · next 60d">
            <Chart
              variant="heatmap"
              data={data}
              xKey="date"
              yKey="channel"
              series={[{ key: 'gap', label: 'Gap (USD)' }]}
              height={Math.max(220, Math.min(560, new Set(data.map((d) => d.channel)).size * 36))}
              empty={{ title: 'No comp data next 60d' }}
            />
          </Container>
        </div>
      </DashboardPage>
    );
  }

  // ─── Default: Pricing tab (the original, kept intact) ────────────────
  const period = resolvePeriod({ win });
  const [roomTypes, ratePlans, inventory, todayKpis] = await Promise.all([
    getRoomTypes(pid),
    getRatePlans(pid),
    getRateInventory(period.from, period.to, { propertyId: pid }),
    getPricingKpis(pid),
  ]);
  void ratePlans;

  const allRates = inventory.map((r) => Number(r.rate) || 0).filter((x) => x >= RATE_MIN);
  const avgRate = allRates.length > 0 ? allRates.reduce((a, b) => a + b, 0) / allRates.length : 0;
  const minRate = allRates.length > 0 ? Math.min(...allRates) : 0;
  const maxRate = allRates.length > 0 ? Math.max(...allRates) : 0;
  const totalInv = inventory.length;
  const stopSells = inventory.filter((r) => r.stop_sell).length;
  const minStayRows = inventory.filter((r) => (Number(r.minimum_stay) || 0) > 1).length;

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

  const actionableTiles: KpiTileProps[] = [
    { label: 'Current BAR', value: k.barToday != null ? Math.round(k.barToday) : 0, currency: 'USD', size: 'sm',
      footnote: k.barToday != null ? "today's lowest sellable" : 'rate_inventory · today · rate ≥ $10',
      status: k.barToday != null ? 'green' : 'grey' },
    { label: 'Comp gap', value: compGap != null ? Math.round(compGap) : 0, currency: 'USD', size: 'sm',
      footnote: `BAR − median comp · ${k.compRows ?? 0} comps`,
      status: compGap == null ? 'grey' : compGap >= 0 ? 'green' : 'amber' },
    { label: 'Occupancy fence', value: k.occPctToday != null ? `${k.occPctToday.toFixed(0)}%` : '—', size: 'sm',
      footnote: `${k.roomsSold ?? 0} / ${capacity} sold`,
      status: k.occPctToday != null ? 'green' : 'grey' },
    { label: 'Sellable · 14d', value: k.sellable14d ?? 0, size: 'sm',
      footnote: 'next 14d · stop_sell=false',
      status: (k.sellable14d ?? 0) > 0 ? 'green' : 'grey' },
  ];

  const windowTiles: KpiTileProps[] = [
    { label: 'Inventory cells', value: totalInv, size: 'sm', footnote: 'room_type × day · window', status: totalInv > 0 ? 'green' : 'grey' },
    { label: 'Avg rate', value: Math.round(avgRate), currency: 'USD', size: 'sm', footnote: 'mean · window', status: avgRate > 0 ? 'green' : 'grey' },
    { label: 'BAR floor', value: Math.round(minRate), currency: 'USD', size: 'sm', footnote: 'lowest sellable · window', status: minRate > 0 ? 'green' : 'grey' },
    { label: 'Ceiling', value: Math.round(maxRate), currency: 'USD', size: 'sm', footnote: 'highest rate · window', status: maxRate > 0 ? 'green' : 'grey' },
    { label: 'Stop-sell', value: stopSells, size: 'sm', footnote: 'cells blocked', status: stopSells > 0 ? 'amber' : 'green' },
    { label: 'Min-stay', value: minStayRows, size: 'sm', footnote: 'minimum_stay > 1', status: minStayRows > 0 ? 'amber' : 'green' },
  ];

  // ── #138: 30-day calendar with arrow nav (URL ?off=0/30/60/90) ──────────
  const offRaw = Number(searchParams.off ?? 0);
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
  const sym = pid === 1000001 ? '€' : '$';
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

  return (
    <DashboardPage title="Revenue · Calendar" subtitle={`pricing · ${period.label}`} tabs={tabs}>
      {stripBlock}

      {/* note#178: KPI stripe at the top */}
      <div style={fullRow}>
        <Container title="Pricing snapshot" subtitle="actionable now" density="compact">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {actionableTiles.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>
      </div>

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
        <Container title="Window aggregates" subtitle={period.label} density="compact">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {windowTiles.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>
      </div>
      <WindowPills win={win} basePath={basePath} />
      <div style={fullRow}>
        <Container title="Two-week glance · cheapest sellable rate" subtitle="date × room type · USD per night · next 14d">
          <Chart variant="heatmap" data={heatmapData} xKey="date" yKey="room"
            series={[{ key: 'rate', label: 'Rate (USD)' }]}
            height={Math.max(220, Math.min(560, new Set(heatmapData.map((d) => d.room)).size * 40))}
            empty={{ title: 'No sellable rates in next 14 days' }}
          />
        </Container>
      </div>
      <div style={fullRow}>
        <Container title="BAR ladder · full Mon-Sun grid" subtitle="bespoke calendar (legacy shell — port pending Calendar primitive)">
          <div style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--ink-soft, #5A5A5A)', fontSize: 12 }}>
            Full Mon–Sun rate-by-day calendar available at <Link href="/revenue/pricing/calendar" style={linkStyle}>/revenue/pricing/calendar</Link>.
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}

function CalendarTabStrip({ active, basePath = '/revenue/pricing' }: { active: CalendarTab; basePath?: string }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {VALID_TABS.map((key) => {
        const isActive = key === active;
        const href = key === 'pricing' ? basePath : `${basePath}?tab=${key}`;
        return (
          <a key={key} href={href} style={{
            fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
            padding: '6px 12px', borderRadius: 4,
            border: `1px solid ${isActive ? 'var(--primary, #1F3A2E)' : 'var(--hairline, #E6DFCC)'}`,
            background: isActive ? 'var(--primary, #1F3A2E)' : 'var(--paper, #FFFFFF)',
            color: isActive ? '#FFFFFF' : 'var(--ink-soft, #5A5A5A)',
            textDecoration: 'none',
          }}>{TAB_LABELS[key]}</a>
        );
      })}
    </div>
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
