// app/revenue/channels/page.tsx
// 2026-05-19 refactor onto @/app/(cockpit)/_design primitives.
// Single tree, both properties. Data fetches UNCHANGED.
// Bespoke SVG charts (channelMixTrendSvg/NetValueBars/Velocity3Line) replaced
// with Chart variant=line/bar. Matrix table → Chart variant=heatmap.

import {
  DashboardPage, Container, KpiTile, Chart,
  type ChartSeries, type DashboardTab, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { resolvePeriod, type WindowKey } from '@/lib/period';
import {
  getChannelEconomics, getChannelEconomicsForRange, getChannelXRoomtype, pivotChannelXRoom,
  getChannelMixWeeklyTrend, getChannelNetValueForRange, getChannelVelocity28dByCat,
} from '@/lib/data-channels';
import { fmtMoney } from '@/lib/format';
import { REVENUE_SUBPAGES } from '../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

const OTA_RX       = /booking\.com|expedia|agoda|airbnb|ctrip|trip\.com|hotels\.com|traveloka/i;
const DIRECT_RX    = /direct|website|booking engine|email|walk[\- ]?in/i;
const WHOLESALE_RX = /hotelbeds|gta|tourico|wholesale|bonotel|miki|reseller|khiri|trails of/i;

const PROPERTY_ID_NAMKHAN = 260955;

function healthLabel(c: Record<string, unknown>): string {
  const cancelPct = Number(c.cancel_pct ?? 0);
  const bookings  = Number(c.bookings ?? 0);
  const adr       = Number(c.adr ?? 0);
  const commPct   = Number(c.commission_pct ?? 0);
  const name      = String(c.source_name ?? '');
  if (bookings >= 3 && cancelPct >= 50) return 'CANCEL ⚠';
  if (bookings >= 3 && cancelPct >= 25) return 'CANCEL';
  if (commPct === 0 && DIRECT_RX.test(name)) return '★ BEST MARGIN';
  if (commPct >= 20) return 'PARITY ⚠';
  if (bookings === 1 && adr > 1500) return 'ANOMALY';
  if (bookings >= 5 && cancelPct < 10) return 'HEALTHY';
  if (bookings <= 2) return 'LOW VOLUME';
  return 'MONITOR';
}

interface Props { searchParams: Record<string, string | string[] | undefined>; propertyId?: number }

export default async function ChannelsPage({ searchParams, propertyId }: Props) {
  const pid = propertyId ?? PROPERTY_ID_NAMKHAN;
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, pid);
  const basePath = pid !== PROPERTY_ID_NAMKHAN ? `/h/${pid}/revenue/channels` : '/revenue/channels';
  const period = resolvePeriod(searchParams);

  const cmpPeriod = period.cmp !== 'none' && period.compareFrom && period.compareTo
    ? { ...period, from: period.compareFrom, to: period.compareTo, cmp: 'none' as const }
    : null;

  const [channelsRaw, matrixRaw, channelsCmp, mixWeekly, netValue, velocity] = await Promise.all([
    getChannelEconomics(period, pid).catch(() => [] as Awaited<ReturnType<typeof getChannelEconomics>>),
    getChannelXRoomtype(period, pid).catch(() => [] as Awaited<ReturnType<typeof getChannelXRoomtype>>),
    cmpPeriod
      ? getChannelEconomicsForRange(cmpPeriod.from, cmpPeriod.to, pid).catch(() => [] as Array<Record<string, unknown>>)
      : Promise.resolve([] as Array<Record<string, unknown>>),
    getChannelMixWeeklyTrend(period.from, period.to, pid).catch(() => [] as Array<Record<string, unknown>>),
    getChannelNetValueForRange(period.from, period.to, pid).catch(() => [] as Array<Record<string, unknown>>),
    getChannelVelocity28dByCat(pid).catch(() => [] as Array<Record<string, unknown>>),
  ]);
  const channels = channelsRaw;

  // Aggregates
  const totalRev      = channels.reduce((s, c) => s + Number(c.gross_revenue || 0), 0);
  const totalBookings = channels.reduce((s, c) => s + Number(c.bookings || 0), 0);
  const totalCommission = channels.reduce((s, c) => s + Number(c.commission_usd || 0), 0);
  const totalRoomnights = channels.reduce((s, c) => s + Number(c.roomnights || 0), 0);

  const direct    = channels.filter((c) => DIRECT_RX.test(String(c.source_name || '')));
  const ota       = channels.filter((c) => OTA_RX.test(String(c.source_name || '')));
  const wholesale = channels.filter((c) => WHOLESALE_RX.test(String(c.source_name || '')));

  const directMix    = totalRev ? (direct.reduce((s, c) => s + Number(c.gross_revenue || 0), 0)    / totalRev) * 100 : 0;
  const otaMix       = totalRev ? (ota.reduce((s, c) => s + Number(c.gross_revenue || 0), 0)       / totalRev) * 100 : 0;
  const wholesaleMix = totalRev ? (wholesale.reduce((s, c) => s + Number(c.gross_revenue || 0), 0) / totalRev) * 100 : 0;
  const commissionPctOfRev = totalRev ? (totalCommission / totalRev) * 100 : 0;
  const channelCostPerOcc = totalRoomnights ? totalCommission / totalRoomnights : 0;
  const leadWeighted = channels.reduce((s, c) => s + Number(c.bookings || 0) * Number(c.avg_lead_days || 0), 0);
  const avgLead = totalBookings ? leadWeighted / totalBookings : 0;

  // Compare deltas (cmp → percent change vs prior period)
  const cmpArr = channelsCmp as Array<Record<string, unknown>>;
  const cmpTotalRev        = cmpArr.reduce((s, c) => s + Number(c.gross_revenue || 0), 0);
  const cmpTotalCommission = cmpArr.reduce((s, c) => s + Number(c.commission_usd || 0), 0);
  const cmpRoomnights      = cmpArr.reduce((s, c) => s + Number(c.roomnights || 0), 0);
  const cmpDirectMix       = cmpTotalRev ? (cmpArr.filter((c) => DIRECT_RX.test(String(c.source_name || ''))).reduce((s, c) => s + Number(c.gross_revenue || 0), 0) / cmpTotalRev) * 100 : 0;
  const cmpOtaMix          = cmpTotalRev ? (cmpArr.filter((c) => OTA_RX.test(String(c.source_name || ''))).reduce((s, c) => s + Number(c.gross_revenue || 0), 0) / cmpTotalRev) * 100 : 0;
  const cmpWholesaleMix    = cmpTotalRev ? (cmpArr.filter((c) => WHOLESALE_RX.test(String(c.source_name || ''))).reduce((s, c) => s + Number(c.gross_revenue || 0), 0) / cmpTotalRev) * 100 : 0;
  const cmpAvgLead = (() => {
    const totalB = cmpArr.reduce((s, c) => s + Number(c.bookings || 0), 0);
    if (!totalB) return 0;
    return cmpArr.reduce((s, c) => s + Number(c.bookings || 0) * Number(c.avg_lead_days || 0), 0) / totalB;
  })();
  const cmpChannelCostPerOcc = cmpRoomnights ? cmpTotalCommission / cmpRoomnights : 0;
  const cmpLabel = cmpPeriod ? (period.cmpLabel ?? 'prior').replace(/^vs\s+/i, '') : 'STLY';

  const pctChange = (now: number, prior: number) => prior > 0 ? ((now - prior) / prior) * 100 : 0;

  // Worst cancel-rate channel
  let worstCancel = { name: '', pct: 0 };
  channels.forEach((c) => {
    const pct = Number(c.cancel_pct || 0);
    if (pct > worstCancel.pct && Number(c.bookings || 0) >= 3) {
      worstCancel = { name: c.source_name, pct };
    }
  });

  // KPI tiles
  const tiles: KpiTileProps[] = [
    { label: `Commissions · ${period.label}`, value: Math.round(totalCommission), currency: 'USD', size: 'sm',
      delta: cmpPeriod ? { value: -pctChange(totalCommission, cmpTotalCommission), period: cmpLabel,
        direction: totalCommission <= cmpTotalCommission ? 'up' : 'down', isGoodWhenUp: true } : undefined,
      footnote: 'less = better', status: totalCommission > 0 ? 'amber' : 'grey' },
    { label: 'Direct mix', value: `${directMix.toFixed(1)}%`, size: 'sm',
      delta: cmpPeriod ? { value: pctChange(directMix, cmpDirectMix), period: cmpLabel,
        direction: directMix >= cmpDirectMix ? 'up' : 'down' } : undefined,
      footnote: 'target ≥ 30%', status: directMix >= 30 ? 'green' : directMix > 0 ? 'amber' : 'grey' },
    { label: 'OTA mix', value: `${otaMix.toFixed(1)}%`, size: 'sm',
      delta: cmpPeriod ? { value: -pctChange(otaMix, cmpOtaMix), period: cmpLabel,
        direction: otaMix <= cmpOtaMix ? 'up' : 'down', isGoodWhenUp: true } : undefined,
      footnote: 'lower = less dependency', status: otaMix > 0 ? 'amber' : 'grey' },
    { label: 'Wholesale mix', value: `${wholesaleMix.toFixed(1)}%`, size: 'sm',
      delta: cmpPeriod ? { value: -pctChange(wholesaleMix, cmpWholesaleMix), period: cmpLabel,
        direction: wholesaleMix <= cmpWholesaleMix ? 'up' : 'down', isGoodWhenUp: true } : undefined,
      footnote: 'lower = less leakage', status: wholesaleMix > 0 ? 'amber' : 'grey' },
    { label: 'Avg lead time', value: avgLead.toFixed(0), unit: 'd', size: 'sm',
      delta: cmpPeriod ? { value: pctChange(avgLead, cmpAvgLead), period: cmpLabel,
        direction: avgLead >= cmpAvgLead ? 'up' : 'down' } : undefined,
      footnote: 'days · booking-weighted', status: avgLead > 0 ? 'green' : 'grey' },
    { label: 'Channel cost / occ RN', value: Math.round(channelCostPerOcc), currency: 'USD', size: 'sm',
      delta: cmpPeriod ? { value: -pctChange(channelCostPerOcc, cmpChannelCostPerOcc), period: cmpLabel,
        direction: channelCostPerOcc <= cmpChannelCostPerOcc ? 'up' : 'down', isGoodWhenUp: true } : undefined,
      footnote: 'USD per occ RN · lower = better', status: channelCostPerOcc > 0 ? 'amber' : 'grey' },
  ];

  // Channel table rows (pre-formatted strings — no functions)
  const channelRows = channels.map((c) => {
    const netAdr = Number(c.adr || 0) * (1 - Number(c.commission_pct || 0) / 100);
    return {
      source:    c.source_name,
      bookings:  String(c.bookings ?? 0),
      revenue:   fmtMoney(Number(c.gross_revenue ?? 0), 'USD'),
      adr:       fmtMoney(Number(c.adr ?? 0), 'USD'),
      comm_pct:  `${Number(c.commission_pct ?? 0).toFixed(0)}%`,
      net_adr:   fmtMoney(netAdr, 'USD'),
      cancel:    `${Number(c.cancel_pct ?? 0).toFixed(1)}%`,
      lead:      `${Number(c.avg_lead_days ?? 0).toFixed(0)}d`,
      los:       Number(c.avg_los ?? 0).toFixed(1),
      health:    healthLabel(c),
    };
  });

  // Mix weekly trend → simple line chart over weeks
  const mixTrendData = (mixWeekly as Array<Record<string, unknown>>).map((r) => ({
    week:      String(r.week_start ?? r.week ?? ''),
    direct:    Number(r.direct_pct ?? r.direct ?? 0),
    ota:       Number(r.ota_pct ?? r.ota ?? 0),
    wholesale: Number(r.wholesale_pct ?? r.wholesale ?? 0),
  }));

  // Net $/booking bar
  const netValueData = (netValue as Array<Record<string, unknown>>).map((r) => ({
    source:  String(r.source_name ?? r.channel ?? ''),
    net_pb:  Number(r.net_per_booking ?? r.net_pb ?? 0),
  }));

  // Velocity (28d) — multi-line by category
  const velocityData = (velocity as Array<Record<string, unknown>>).map((r) => ({
    day:    String(r.day ?? r.date ?? ''),
    direct: Number(r.direct ?? 0),
    ota:    Number(r.ota ?? 0),
    other:  Number(r.other ?? 0),
  }));

  // Matrix → heatmap data (long-form rows {room, ota, revenue})
  const { sources: matSources, roomTypes: matRooms, cells } = pivotChannelXRoom(matrixRaw);
  const matrixHeatmap = matRooms.flatMap((rt) =>
    matSources.slice(0, 6).map((src) => ({
      room:    rt,
      ota:     src,
      revenue: Math.round(Number(cells[`${src}|${rt}`]?.revenue ?? 0)),
    })));

  // Tabs + period href
  const tabs: DashboardTab[] = subPages.map((s) => ({ key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/channels') }));
  const hrefFor = (newWin: WindowKey) => {
    const p = new URLSearchParams();
    if (newWin !== '30d') p.set('win', newWin);
    if (period.cmp && period.cmp !== 'none') p.set('cmp', period.cmp);
    const qs = p.toString();
    return `${basePath}${qs ? '?' + qs : ''}`;
  };
  const winOptions: Array<{ k: WindowKey; label: string }> = [
    { k: '7d', label: '7d' }, { k: '30d', label: '30d' }, { k: '90d', label: '90d' },
  ];

  // Insight chips
  const chips: string[] = [];
  if (worstCancel.name && worstCancel.pct > 25) chips.push(`⚠ Cancel watch · ${worstCancel.name} ${worstCancel.pct.toFixed(1)}%`);
  if (commissionPctOfRev > 12) chips.push(`⚠ Commission load · ${commissionPctOfRev.toFixed(1)}% of rev (${fmtMoney(totalCommission, 'USD')})`);

  return (
    <DashboardPage
      title="Revenue · Channels"
      subtitle={`Channel performance · ${period.label}`}
      tabs={tabs}
    >
      <Container title="Headline" subtitle={period.label} density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>
      </Container>

      <Container title="Window" subtitle="period selector" density="compact">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {winOptions.map((o) => {
            const active = o.k === period.win;
            return (
              <a key={o.k} href={hrefFor(o.k)} style={{
                fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
                padding: '4px 10px', borderRadius: 99,
                border: `1px solid ${active ? 'var(--primary, #1F3A2E)' : 'var(--hairline, #E6DFCC)'}`,
                background: active ? 'var(--primary, #1F3A2E)' : 'var(--paper, #FFFFFF)',
                color: active ? '#FFFFFF' : 'var(--ink-soft, #5A5A5A)',
                fontWeight: active ? 600 : 500, textDecoration: 'none',
              }}>{o.label}</a>
            );
          })}
        </div>
      </Container>

      {chips.length > 0 && (
        <Container title="Watch list" subtitle="auto-detected insights" density="compact" status="amber">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {chips.map((c, i) => (
              <span key={i} style={{
                fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
                padding: '4px 10px', borderRadius: 4,
                background: 'rgba(184, 84, 42, 0.10)',
                border: '1px solid var(--terracotta, #B8542A)',
                color: 'var(--terracotta, #B8542A)', fontWeight: 600,
              }}>{c}</span>
            ))}
          </div>
        </Container>
      )}

      <Container title="Channel mix · weekly trend" subtitle={period.label}>
        <Chart variant="line" data={mixTrendData} xKey="week"
          series={[
            { key: 'direct',    label: 'Direct',    color: '#1F3A2E' },
            { key: 'ota',       label: 'OTA',       color: '#B8542A' },
            { key: 'wholesale', label: 'Wholesale', color: '#B8A878' },
          ]}
          height={220}
          empty={{ title: 'No mix data in window' }}
        />
      </Container>

      <Container title="Net $/booking · cancel-adjusted" subtitle={period.label}>
        <Chart variant="bar" data={netValueData} xKey="source"
          series={[{ key: 'net_pb', label: 'Net $/booking', color: '#1F3A2E' }]}
          height={220}
          empty={{ title: 'No net value data in window' }}
        />
      </Container>

      <Container title="Booking velocity · 28d" subtitle="by category">
        <Chart variant="line" data={velocityData} xKey="day"
          series={[
            { key: 'direct', label: 'Direct', color: '#1F3A2E' },
            { key: 'ota',    label: 'OTA',    color: '#B8542A' },
            { key: 'other',  label: 'Other',  color: '#B8A878' },
          ]}
          height={220}
          empty={{ title: 'No velocity data in last 28 days' }}
        />
      </Container>

      <Container title={`Channel performance · ${period.label}`} subtitle="mv_channel_economics">
        <Chart variant="table" data={channelRows} xKey="source"
          series={[
            { key: 'bookings', label: 'Bkg' },
            { key: 'revenue',  label: 'Rev' },
            { key: 'adr',      label: 'ADR' },
            { key: 'comm_pct', label: 'Comm %' },
            { key: 'net_adr',  label: 'Net ADR' },
            { key: 'cancel',   label: 'Cancel %' },
            { key: 'lead',     label: 'Lead' },
            { key: 'los',      label: 'LOS' },
            { key: 'health',   label: 'Health' },
          ]}
          empty={{ title: 'No channel data in selected window' }}
        />
      </Container>

      {matRooms.length > 0 && matSources.length > 0 && (
        <Container title="OTA × Room Type matrix" subtitle={`mv_channel_x_roomtype · ${period.label}`}>
          <Chart variant="heatmap" data={matrixHeatmap} xKey="ota" yKey="room"
            series={[{ key: 'revenue', label: 'Revenue' }]}
            height={Math.max(180, matRooms.length * 36)}
            empty={{ title: 'No matrix data' }}
          />
        </Container>
      )}
    </DashboardPage>
  );
}
