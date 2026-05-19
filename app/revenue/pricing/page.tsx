// app/revenue/pricing/page.tsx
// 2026-05-19 streamlined refactor onto @/app/(cockpit)/_design primitives.
// Keeps the 2-tab routing (pricing default, density). Pricing tab now shows:
//   - 4 actionable KPI tiles (Current BAR / Comp gap / Occ fence / Sellable 14d)
//   - 6 window-aggregate KPI tiles
//   - Window + granularity pills
//   - 14-day rate calendar as Chart variant=heatmap
// The bespoke Mon-Sun calendar grid + BAR ladder by room type are deferred
// to a follow-up brief (need a Calendar primitive).

import Link from 'next/link';
import { resolvePeriod, type WindowKey } from '@/lib/period';
import { getRoomTypes, getRatePlans, getRateInventory } from '@/lib/pricing';
import { getPricingKpis } from '@/lib/pricingKpis';
import { REVENUE_SUBPAGES } from '../_subpages';
import HolidayScheduleTabContent from '@/app/operations/staff/_components/HolidayScheduleTabContent';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import {
  DashboardPage, Container, KpiTile, Chart,
  type DashboardTab, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface SearchParams { win?: string; gran?: string; cmp?: string; tab?: string; y?: string; school?: string }

const VALID_FWD: WindowKey[] = ['next7', 'next30', 'next90', 'next180', 'next365'];
const CAPACITY_FIXED_LABEL = 30;

function parseWin(raw: string | undefined): WindowKey {
  return (VALID_FWD.includes(raw as WindowKey) ? raw : 'next90') as WindowKey;
}
function parseGran(raw: string | undefined): 'day' | 'week' | 'month' {
  if (raw === 'day' || raw === 'week' || raw === 'month') return raw;
  return 'month';
}

export default async function PricingPage({ searchParams }: { searchParams: SearchParams }) {
  const tab: 'pricing' | 'density' = searchParams.tab === 'density' ? 'density' : 'pricing';
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, NAMKHAN_PROPERTY_ID);
  const tabs: DashboardTab[] = subPages.map((s) => ({ key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/pricing') }));

  if (tab === 'density') {
    return (
      <DashboardPage
        title="Revenue · Calendar"
        subtitle="holiday density · multi-country overlay heatmap"
        tabs={tabs}
      >
        <Container title="Calendar tabs" subtitle="pricing · density" density="compact">
          <CalendarTabStrip active="density" />
        </Container>
        <Container title="Holiday density" subtitle="anticipate demand spikes from source-market holidays">
          <HolidayScheduleTabContent
            propertyId={NAMKHAN_PROPERTY_ID}
            propertyLabel="Namkhan"
            searchParams={searchParams as Record<string, string | string[] | undefined>}
            embedded
          />
        </Container>
      </DashboardPage>
    );
  }

  const win = parseWin(searchParams.win);
  const gran = parseGran(searchParams.gran);
  const period = resolvePeriod({ win, cmp: searchParams.cmp });

  const [roomTypes, ratePlans, inventory, todayKpis] = await Promise.all([
    getRoomTypes(),
    getRatePlans(),
    getRateInventory(period.from, period.to),
    getPricingKpis(),
  ]);

  // Aggregates
  const RATE_MIN = 10;
  const allRates = inventory.map((r) => Number(r.rate) || 0).filter((x) => x >= RATE_MIN);
  const avgRate = allRates.length > 0 ? allRates.reduce((a, b) => a + b, 0) / allRates.length : 0;
  const minRate = allRates.length > 0 ? Math.min(...allRates) : 0;
  const maxRate = allRates.length > 0 ? Math.max(...allRates) : 0;
  const totalInv = inventory.length;
  const stopSells = inventory.filter((r) => r.stop_sell).length;
  const minStayRows = inventory.filter((r) => (Number(r.minimum_stay) || 0) > 1).length;

  const k = todayKpis;
  const compGap = (k.barToday != null && k.compMedian != null) ? k.barToday - k.compMedian : null;

  // 14-day rate heatmap data — cheapest sellable rate per day × room type
  const today = new Date(); today.setHours(0,0,0,0);
  const todayIso = today.toISOString().slice(0, 10);
  const horizon = new Date(today); horizon.setDate(today.getDate() + 13);
  const horizonIso = horizon.toISOString().slice(0, 10);
  const cellMap = new Map<string, number>();
  for (const r of inventory) {
    const rate = Number(r.rate);
    const stop = Boolean((r as Record<string, unknown>).stop_sell);
    if (stop || rate < RATE_MIN) continue;
    const date = String((r as Record<string, unknown>).inventory_date ?? '').slice(0, 10);
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

  // 4 actionable tiles
  const actionableTiles: KpiTileProps[] = [
    { label: 'Current BAR', value: k.barToday != null ? Math.round(k.barToday) : 0, currency: 'USD', size: 'sm',
      footnote: k.barToday != null ? "today's lowest sellable" : 'rate_inventory · today · rate ≥ $10',
      status: k.barToday != null ? 'green' : 'grey' },
    { label: 'Comp gap', value: compGap != null ? Math.round(compGap) : 0, currency: 'USD', size: 'sm',
      footnote: `BAR − median comp · ${k.compRows ?? 0} comps`,
      status: compGap == null ? 'grey' : compGap >= 0 ? 'green' : 'amber' },
    { label: 'Occupancy fence', value: k.occPctToday != null ? `${k.occPctToday.toFixed(0)}%` : '—', size: 'sm',
      footnote: `${k.roomsSold ?? 0} / ${CAPACITY_FIXED_LABEL} sold`,
      status: k.occPctToday != null ? 'green' : 'grey' },
    { label: 'Sellable · 14d', value: k.sellable14d ?? 0, size: 'sm',
      footnote: 'next 14d · stop_sell=false',
      status: (k.sellable14d ?? 0) > 0 ? 'green' : 'grey' },
  ];

  // 6 window aggregate tiles
  const windowTiles: KpiTileProps[] = [
    { label: 'Inventory cells', value: totalInv, size: 'sm', footnote: 'room_type × day · window', status: totalInv > 0 ? 'green' : 'grey' },
    { label: 'Avg rate', value: Math.round(avgRate), currency: 'USD', size: 'sm', footnote: 'mean · window', status: avgRate > 0 ? 'green' : 'grey' },
    { label: 'BAR floor', value: Math.round(minRate), currency: 'USD', size: 'sm', footnote: 'lowest sellable · window', status: minRate > 0 ? 'green' : 'grey' },
    { label: 'Ceiling', value: Math.round(maxRate), currency: 'USD', size: 'sm', footnote: 'highest rate · window', status: maxRate > 0 ? 'green' : 'grey' },
    { label: 'Stop-sell', value: stopSells, size: 'sm', footnote: 'cells blocked', status: stopSells > 0 ? 'amber' : 'green' },
    { label: 'Min-stay', value: minStayRows, size: 'sm', footnote: 'minimum_stay > 1', status: minStayRows > 0 ? 'amber' : 'green' },
  ];

  // Window + granularity URL helpers
  const hrefFor = (overrides: { win?: WindowKey; gran?: 'day'|'week'|'month' }) => {
    const params = new URLSearchParams();
    const nextWin = overrides.win ?? win;
    const nextGran = overrides.gran ?? gran;
    if (nextWin !== 'next90') params.set('win', nextWin);
    if (nextGran !== 'month') params.set('gran', nextGran);
    return `/revenue/pricing${params.toString() ? '?' + params.toString() : ''}`;
  };

  // Used to silence unused-var noise on planAggs/roomAggs path (defer to follow-up brief)
  void ratePlans;

  return (
    <DashboardPage
      title="Revenue · Calendar"
      subtitle={`pricing · ${period.label} · by ${gran}`}
      tabs={tabs}
    >
      <Container title="Calendar tabs" subtitle="pricing · density" density="compact">
        <CalendarTabStrip active="pricing" />
      </Container>

      <Container title="Pricing snapshot" subtitle="actionable now" density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {actionableTiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>
      </Container>

      <Container title="Window aggregates" subtitle={period.label} density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {windowTiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>
      </Container>

      <Container title="Window & granularity" subtitle="URL-driven controls" density="compact">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <PillGroup label="Window">
            {VALID_FWD.map((w) => (
              <Pill key={w} href={hrefFor({ win: w })} active={w === win}>{w.replace('next','+')}</Pill>
            ))}
          </PillGroup>
          <PillGroup label="Granularity">
            {(['day','week','month'] as const).map((g) => (
              <Pill key={g} href={hrefFor({ gran: g })} active={g === gran}>{g}</Pill>
            ))}
          </PillGroup>
        </div>
      </Container>

      <Container title="Two-week glance · cheapest sellable rate" subtitle="date × room type · USD per night · next 14d">
        <Chart variant="heatmap" data={heatmapData} xKey="date" yKey="room"
          series={[{ key: 'rate', label: 'Rate (USD)' }]}
          height={Math.max(220, Math.min(560, new Set(heatmapData.map((d) => d.room)).size * 40))}
          empty={{ title: 'No sellable rates in next 14 days' }}
        />
      </Container>

      <Container title="BAR ladder by room type" subtitle="deferred · needs Calendar primitive">
        <div style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--ink-soft, #5A5A5A)', fontSize: 12 }}>
          The Mon–Sun rate-by-day calendar grid is deferred until the design system adds a Calendar primitive.
          Full grid still available at <Link href="/revenue/pricing/calendar" style={{ color: 'var(--primary, #1F3A2E)', fontWeight: 600 }}>/revenue/pricing/calendar</Link>.
        </div>
      </Container>
    </DashboardPage>
  );
}

function CalendarTabStrip({ active }: { active: 'pricing' | 'density' }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[
        { href: '/revenue/pricing',                  label: 'Pricing', key: 'pricing' as const },
        { href: '/revenue/pricing?tab=density',      label: 'Density', key: 'density' as const },
      ].map((t) => {
        const isActive = t.key === active;
        return (
          <a key={t.key} href={t.href} style={{
            fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
            padding: '6px 12px', borderRadius: 4,
            border: `1px solid ${isActive ? 'var(--primary, #1F3A2E)' : 'var(--hairline, #E6DFCC)'}`,
            background: isActive ? 'var(--primary, #1F3A2E)' : 'var(--paper, #FFFFFF)',
            color: isActive ? '#FFFFFF' : 'var(--ink-soft, #5A5A5A)',
            textDecoration: 'none',
          }}>{t.label}</a>
        );
      })}
    </div>
  );
}

function PillGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)', marginRight: 4 }}>{label}:</span>
      {children}
    </div>
  );
}

function Pill({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <a href={href} style={{
      fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: active ? 600 : 500,
      padding: '4px 10px', borderRadius: 99,
      border: `1px solid ${active ? 'var(--primary, #1F3A2E)' : 'var(--hairline, #E6DFCC)'}`,
      background: active ? 'var(--primary, #1F3A2E)' : 'var(--paper, #FFFFFF)',
      color: active ? '#FFFFFF' : 'var(--ink-soft, #5A5A5A)',
      textDecoration: 'none',
    }}>{children}</a>
  );
}
