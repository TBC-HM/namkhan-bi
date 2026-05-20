// app/revenue/compset/page.tsx
// 2026-05-20: primitives-based compset, shared between /revenue/compset
// (Namkhan default) and /h/[id]/revenue/compset (delegates with propertyId).
// Legacy preserved at /revenue/compset/legacy.

import {
  DashboardPage, Container, KpiTile, Chart,
  type ChartSeries, type DashboardTab, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { REVENUE_SUBPAGES } from '../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface PropertySummaryRow {
  comp_id: string; set_name: string | null; property_name: string; is_self: boolean | null;
  star_rating: number | null; rooms: number | null; latest_usd: number | null; latest_channel: string | null;
  last_shop_date: string | null; last_shop_human: string | null; avg_30d_usd: number | null;
  obs_count_30d: number | null; min_30d_usd: number | null; max_30d_usd: number | null;
  pct_vs_median: number | null; review_score: number | null; review_count: number | null;
  channels_with_reviews: number | null; has_bdc: boolean | null; has_agoda: boolean | null;
  has_expedia: boolean | null; has_trip: boolean | null; has_direct: boolean | null;
}
interface RateMatrixRow { comp_id: string; stay_date: string; rate_usd: number | null; channel: string | null }
interface PromoTileRow {
  comp_id: string; property_name: string; is_self: boolean | null;
  latest_rate_usd: number | null; promo_frequency_pct: number | null; avg_discount_pct: number | null;
  max_discount_seen: number | null; pattern_label: string | null;
  days_with_promo: number | null; days_with_data: number | null;
}
interface RatePlanRow {
  category: string | null; plan_name: string;
  competitors_offering: number | null; comps_offering_excl_self: number | null; channels_seen: number | null;
  avg_rate_usd: number | null; avg_discount_when_promoted: number | null; namkhan_offers: boolean | null;
}

function fmtUSD(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return '$' + Math.round(Number(n)).toLocaleString('en-US');
}
function fmtPct(n: number | null | undefined, decimals = 1): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return `${Number(n).toFixed(decimals)}%`;
}
function fmtSignedPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const v = Number(n);
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}${Math.abs(v).toFixed(1)}%`;
}
function todayIso(): string { return new Date().toISOString().slice(0, 10); }
function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function daysBetweenToday(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso + 'T00:00:00Z').getTime();
  const today = new Date(todayIso() + 'T00:00:00Z').getTime();
  return Math.floor((today - t) / 86_400_000);
}

interface Props { propertyId?: number }

export default async function CompsetPage({ propertyId }: Props = {}) {
  const pid = propertyId ?? PROPERTY_ID;
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, pid);
  const tabs: DashboardTab[] = subPages.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/compset'),
  }));

  const [{ data: properties }, { data: matrix }, { data: promoTiles }, { data: ratePlans }] = await Promise.all([
    supabase.from('v_compset_property_summary')
      .select('comp_id, set_name, property_name, is_self, star_rating, rooms, latest_usd, latest_channel, last_shop_date, last_shop_human, avg_30d_usd, obs_count_30d, min_30d_usd, max_30d_usd, pct_vs_median, review_score, review_count, channels_with_reviews, has_bdc, has_agoda, has_expedia, has_trip, has_direct')
      .order('latest_usd', { ascending: false, nullsFirst: false })
      .limit(50),
    supabase.from('v_compset_competitor_rate_matrix')
      .select('comp_id, stay_date, rate_usd, channel')
      .order('stay_date', { ascending: true })
      .limit(2000),
    supabase.from('v_compset_promo_tiles')
      .select('comp_id, property_name, is_self, latest_rate_usd, promo_frequency_pct, avg_discount_pct, max_discount_seen, pattern_label, days_with_promo, days_with_data')
      .order('promo_frequency_pct', { ascending: false, nullsFirst: false })
      .limit(20),
    supabase.from('v_compset_rate_plan_landscape')
      .select('category, plan_name, competitors_offering, comps_offering_excl_self, channels_seen, avg_rate_usd, avg_discount_when_promoted, namkhan_offers')
      .order('competitors_offering', { ascending: false, nullsFirst: false })
      .limit(30),
  ]);

  const props = (properties ?? []) as PropertySummaryRow[];
  const mat = (matrix ?? []) as RateMatrixRow[];
  const promos = (promoTiles ?? []) as PromoTileRow[];
  const plans = (ratePlans ?? []) as RatePlanRow[];

  // Performance context — public.v_kpi_daily + v_otb_pace, scoped by property
  const anchor = todayIso();
  const yest = shiftDate(anchor, -1);
  const stly = shiftDate(yest, -365);
  const { data: kpiRows } = await supabase
    .from('v_kpi_daily')
    .select('night_date, adr, revpar, trevpar')
    .eq('property_id', pid)
    .in('night_date', [yest, stly])
    .order('night_date', { ascending: false });
  const yestRow = (kpiRows ?? []).find((r) => r.night_date === yest) ?? null;
  const stlyRow = (kpiRows ?? []).find((r) => r.night_date === stly) ?? null;
  const adrYest = Number(yestRow?.adr ?? 0);
  const revparYest = Number(yestRow?.revpar ?? 0);
  const trevparYest = Number(yestRow?.trevpar ?? 0);
  const adrStly = Number(stlyRow?.adr ?? 0);
  const revparStly = Number(stlyRow?.revpar ?? 0);
  const adrDelta = adrStly > 0 ? ((adrYest - adrStly) / adrStly) * 100 : null;
  const revparDelta = revparStly > 0 ? ((revparYest - revparStly) / revparStly) * 100 : null;

  const recentFrom = shiftDate(anchor, -2);
  const { data: paceRows } = await supabase
    .from('v_otb_pace')
    .select('night_date, confirmed_rooms')
    .eq('property_id', pid)
    .gte('night_date', recentFrom)
    .lte('night_date', anchor);
  const pickupToday = (paceRows ?? []).filter((r) => r.night_date === anchor)
    .reduce((s, r) => s + Number(r.confirmed_rooms || 0), 0);
  const pickupYest = (paceRows ?? []).filter((r) => r.night_date === yest)
    .reduce((s, r) => s + Number(r.confirmed_rooms || 0), 0);

  // Headline
  const self = props.find((p) => p.is_self === true) ?? null;
  const others = props.filter((p) => !p.is_self);
  const compSetSize = others.length;
  const compsWithRate = others.filter((p) => p.latest_usd != null);
  const avgCompRate = compsWithRate.length > 0
    ? compsWithRate.reduce((s, p) => s + Number(p.latest_usd || 0), 0) / compsWithRate.length : 0;
  const ourRate = Number(self?.latest_usd ?? 0);
  const ourGap = ourRate > 0 && avgCompRate > 0 ? ((ourRate - avgCompRate) / avgCompRate) * 100 : 0;
  const lastShop = props.map((p) => p.last_shop_date).filter((d): d is string => !!d).sort().pop() ?? null;
  const rankedAll = [...props].filter((p) => p.latest_usd != null).sort((a, b) => Number(b.latest_usd) - Number(a.latest_usd));
  const ourRank = self ? rankedAll.findIndex((p) => p.comp_id === self.comp_id) + 1 : 0;
  const totalRanked = rankedAll.length;

  const headlineTiles: KpiTileProps[] = [
    { label: 'Comp set size', value: compSetSize, size: 'sm', footnote: 'competitors tracked', status: compSetSize > 0 ? 'green' : 'grey' },
    { label: 'Our rate', value: Math.round(ourRate), currency: 'USD', size: 'sm', footnote: self?.latest_channel ?? 'no recent shop', status: ourRate > 0 ? 'green' : 'grey' },
    { label: 'Avg comp rate', value: Math.round(avgCompRate), currency: 'USD', size: 'sm', footnote: 'mean of competitors', status: avgCompRate > 0 ? 'green' : 'grey' },
    { label: 'vs Compset median', value: fmtSignedPct(ourGap), size: 'sm', footnote: ourGap >= 0 ? 'priced above' : 'priced below',
      status: ourRate === 0 || avgCompRate === 0 ? 'grey' : Math.abs(ourGap) > 15 ? 'amber' : 'green' },
    { label: 'Our rank', value: ourRank > 0 ? `${ourRank} / ${totalRanked}` : '—', size: 'sm', footnote: 'by latest rate', status: ourRank > 0 ? 'green' : 'grey' },
    { label: 'Last shop', value: lastShop ?? '—', size: 'sm', footnote: self?.last_shop_human ?? 'no observations', status: lastShop ? 'green' : 'grey' },
  ];
  const contextTiles: KpiTileProps[] = [
    { label: 'RevPAR · yesterday', value: Math.round(revparYest), currency: 'USD', size: 'sm',
      delta: revparDelta != null ? { value: revparDelta, period: 'STLY', direction: revparDelta >= 0 ? 'up' : 'down' } : undefined,
      footnote: 'v_kpi_daily', status: revparYest > 0 ? 'green' : 'grey' },
    { label: 'ADR · yesterday', value: Math.round(adrYest), currency: 'USD', size: 'sm',
      delta: adrDelta != null ? { value: adrDelta, period: 'STLY', direction: adrDelta >= 0 ? 'up' : 'down' } : undefined,
      footnote: 'v_kpi_daily', status: adrYest > 0 ? 'green' : 'grey' },
    { label: 'TRevPAR · yesterday', value: Math.round(trevparYest), currency: 'USD', size: 'sm',
      footnote: 'rooms + F&B + ancillary', status: trevparYest > 0 ? 'green' : 'grey' },
    { label: 'Pickup · 24h', value: pickupToday, size: 'sm',
      footnote: `vs ${pickupYest} yesterday · v_otb_pace`, status: pickupToday > 0 ? 'green' : 'grey' },
  ];
  const competitorRatesNum = compsWithRate.map((p) => Number(p.latest_usd));
  const maxComp = competitorRatesNum.length ? Math.max(...competitorRatesNum) : 0;
  const minComp = competitorRatesNum.length ? Math.min(...competitorRatesNum) : 0;
  const spread = maxComp - minComp;
  const selfPromo = promos.find((p) => p.is_self === true);
  const daysFresh = daysBetweenToday(lastShop);
  const signalTiles: KpiTileProps[] = [
    { label: 'Compset spread', value: Math.round(spread), currency: 'USD', size: 'sm',
      footnote: `${fmtUSD(minComp)} → ${fmtUSD(maxComp)}`, status: spread > 0 ? 'green' : 'grey' },
    { label: 'Our promo frequency', value: fmtPct(selfPromo?.promo_frequency_pct, 0), size: 'sm',
      footnote: selfPromo ? `${selfPromo.days_with_promo ?? 0} / ${selfPromo.days_with_data ?? 0} days promoted` : 'not in promo data',
      status: selfPromo ? (Number(selfPromo.promo_frequency_pct ?? 0) > 0 ? 'amber' : 'green') : 'grey' },
    { label: 'Our pattern', value: selfPromo?.pattern_label ?? '—', size: 'sm',
      footnote: 'price-move cadence', status: selfPromo?.pattern_label ? 'green' : 'grey' },
    { label: 'Data freshness', value: daysFresh != null ? `${daysFresh}d` : '—', size: 'sm',
      footnote: lastShop ? `last shop ${lastShop}` : 'never shopped',
      status: daysFresh == null ? 'grey' : daysFresh <= 2 ? 'green' : daysFresh <= 7 ? 'amber' : 'red' },
  ];

  // Rate trend
  const topCompIds = new Set([...rankedAll.slice(0, 6).map((p) => p.comp_id)]);
  const compNameById = new Map(props.map((p) => [p.comp_id, p.property_name]));
  const pivot: Map<string, Record<string, number | string>> = new Map();
  for (const r of mat) {
    if (!topCompIds.has(r.comp_id)) continue;
    if (r.rate_usd == null) continue;
    const row = pivot.get(r.stay_date) ?? { stay_date: r.stay_date };
    const name = compNameById.get(r.comp_id) ?? r.comp_id.slice(0, 6);
    const cur = Number(row[name] ?? 0);
    const count = Number(row[`${name}__n`] ?? 0);
    row[name] = (cur * count + Number(r.rate_usd)) / (count + 1);
    row[`${name}__n`] = count + 1;
    pivot.set(r.stay_date, row);
  }
  const trendData = Array.from(pivot.values()).map((r) => {
    const clean: Record<string, number | string> = { stay_date: String(r.stay_date) };
    for (const k of Object.keys(r)) {
      if (k.endsWith('__n') || k === 'stay_date') continue;
      clean[k] = Math.round(Number(r[k]));
    }
    return clean;
  }).sort((a, b) => String(a.stay_date).localeCompare(String(b.stay_date)));

  const palette = ['#1F3A2E', '#B8542A', '#B8A878', '#2E7D32', '#6E8B65', '#C8843E', '#5A5A5A', '#8FA585'];
  const trendSeries: ChartSeries[] = Array.from(topCompIds).map((id, i) => {
    const name = compNameById.get(id) ?? id.slice(0, 6);
    const prop = props.find((p) => p.comp_id === id);
    return { key: name, label: prop?.is_self ? `★ ${name}` : name, color: palette[i % palette.length] };
  });

  const propertyRows = props.map((p) => ({
    property: p.is_self ? `★ ${p.property_name}` : p.property_name,
    stars: p.star_rating != null ? `${p.star_rating}★` : '—',
    rooms: p.rooms ?? '—',
    latest: fmtUSD(p.latest_usd),
    avg_30d: fmtUSD(p.avg_30d_usd),
    range: p.min_30d_usd != null && p.max_30d_usd != null ? `${fmtUSD(p.min_30d_usd)}–${fmtUSD(p.max_30d_usd)}` : '—',
    vs_median: fmtSignedPct(p.pct_vs_median),
    review: p.review_score != null ? `${Number(p.review_score).toFixed(1)} (${p.review_count ?? 0})` : '—',
    channels: [p.has_bdc && 'BDC', p.has_agoda && 'AGO', p.has_expedia && 'EXP', p.has_trip && 'TRP', p.has_direct && 'DIR'].filter(Boolean).join(' · ') || '—',
    last_shop: p.last_shop_human ?? '—',
  }));
  const promoRows = promos.map((p) => ({
    property: p.is_self ? `★ ${p.property_name}` : p.property_name,
    latest: fmtUSD(p.latest_rate_usd),
    pattern: p.pattern_label ?? '—',
    promo_freq: fmtPct(p.promo_frequency_pct, 0),
    avg_disc: fmtPct(p.avg_discount_pct, 1),
    max_disc: fmtPct(p.max_discount_seen, 1),
    days_promoted: p.days_with_data && p.days_with_data > 0 ? `${p.days_with_promo ?? 0} / ${p.days_with_data}` : '—',
  }));
  const planRows = plans.map((p) => ({
    plan: p.plan_name, category: p.category ?? '—',
    competitors: p.competitors_offering ?? 0, excl_self: p.comps_offering_excl_self ?? 0,
    avg_rate: fmtUSD(p.avg_rate_usd), avg_discount: fmtPct(p.avg_discount_when_promoted, 1),
    we_offer: p.namkhan_offers ? 'yes' : 'no',
  }));
  const propertyCols: ChartSeries[] = [
    { key: 'stars', label: 'Stars' }, { key: 'rooms', label: 'Rooms' },
    { key: 'latest', label: 'Latest' }, { key: 'avg_30d', label: 'Avg 30d' },
    { key: 'range', label: 'Range 30d' }, { key: 'vs_median', label: 'vs Med' },
    { key: 'review', label: 'Review' }, { key: 'channels', label: 'Channels' },
    { key: 'last_shop', label: 'Last shop' },
  ];
  const promoCols: ChartSeries[] = [
    { key: 'latest', label: 'Latest' }, { key: 'pattern', label: 'Pattern' },
    { key: 'promo_freq', label: 'Promo freq' }, { key: 'avg_disc', label: 'Avg disc' },
    { key: 'max_disc', label: 'Max disc' }, { key: 'days_promoted', label: 'Promoted / observed' },
  ];
  const planCols: ChartSeries[] = [
    { key: 'category', label: 'Category' }, { key: 'competitors', label: 'Competitors' },
    { key: 'excl_self', label: 'Excl self' }, { key: 'avg_rate', label: 'Avg rate' },
    { key: 'avg_discount', label: 'Avg disc' }, { key: 'we_offer', label: 'We offer' },
  ];

  return (
    <DashboardPage
      title="Revenue · Compset"
      subtitle={`competitive landscape · ${compSetSize} competitor${compSetSize === 1 ? '' : 's'}${lastShop ? ` · last shop ${lastShop}` : ''}`}
      tabs={tabs}
      action={
        <a href="/revenue/compset/legacy" style={{
          fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
          padding: '6px 14px', borderRadius: 4,
          background: 'var(--paper, #FFFFFF)', color: 'var(--ink, #1B1B1B)',
          border: '1px solid var(--hairline, #E6DFCC)', textDecoration: 'none',
        }}>↗ Legacy archive</a>
      }
    >
      <Container title="Compset headline" subtitle="latest observed rates · last 30 days" density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {headlineTiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>
      </Container>

      <Container title="Performance context" subtitle="yesterday's realized · context for positioning" density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {contextTiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>
      </Container>

      <Container title="Compset signals" subtitle="spread · cadence · freshness" density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {signalTiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>
      </Container>

      <Container title="Daily rate trend · top 6" subtitle="self + 5 nearest competitors · v_compset_competitor_rate_matrix">
        <Chart variant="line" data={trendData} xKey="stay_date" series={trendSeries} height={260}
          empty={{ title: 'No rate observations', hint: 'compset has not been shopped yet' }} />
      </Container>

      <Container title={`Properties · ${props.length}`} subtitle="ranked by latest rate · v_compset_property_summary">
        <Chart variant="table" data={propertyRows} xKey="property" series={propertyCols}
          empty={{ title: 'No competitors registered' }} />
      </Container>

      <Container title="Promo behaviour" subtitle="discount cadence · v_compset_promo_tiles">
        <Chart variant="table" data={promoRows} xKey="property" series={promoCols}
          empty={{ title: 'No promo data' }} />
      </Container>

      <Container title="Rate-plan landscape" subtitle="who offers what · v_compset_rate_plan_landscape">
        <Chart variant="table" data={planRows} xKey="plan" series={planCols}
          empty={{ title: 'No rate-plan landscape data' }} />
      </Container>
    </DashboardPage>
  );
}
