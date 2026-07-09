// app/revenue/demand/page.tsx
// 2026-07-08 — header re-alignment to canonical revenue pattern
//   (Pulse / Pace / Cancellations parity):
//   · DashboardPage now carries a subtitle (was empty)
//   · forward-window pill row lifted OUT of the OTB headline Container
//     into a bare row (mirrors /revenue/cancellations pattern)
//   · pill styling hardcoded #FFF/#E6DFCC/#1F3A2E per token-ladder feedback
//     (was var(--primary)/var(--paper)/var(--hairline) → Namkhan dark bug)
//   · KPI tile grids normalized to minmax(160px, 1fr) gap 8 (was 180/12)
//   · body containers and data queries unchanged
// 2026-06-07 (#103) — full audit pass per PBS:
//   · property-aware currency (Donna EUR / Namkhan USD) — was hardcoded USD/$ in 7 spots
//   · country normalization via silver guest_country_iso2 + ISO2 → display label map
//   · "Delta heat" was a bar, not a heatmap → renamed
//   · drop "deferred" / "owed" TODO disclaimers leaking into subtitles
//   · drop view names from user-facing subtitles
//   · format Strongest/Softest month as "Jul 2026" not "2026-07-01"
//   · cleaner RevPAR / Pace signals subtitles
//   · channel mix "Rest" → "Other"
// Shared body for /revenue/demand (Namkhan) and /h/[id]/revenue/demand.

import {
  DashboardPage, Container, KpiTile, Chart,
  type ChartSeries, type DashboardTab, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { getPaceOtb } from '@/lib/data';
import { resolvePeriod, type WindowKey } from '@/lib/period';
import { REVENUE_SUBPAGES } from '../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import { PROPERTY_ID, supabase } from '@/lib/supabase';
import WindowSelect from '../_components/WindowSelect';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

const PROPERTY_ID_DONNA = 1000001;

const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };
const threeUp: React.CSSProperties = {
  gridColumn: '1 / -1',
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 10,
  alignItems: 'stretch',
};

interface DemandRow {
  ci_month: string;
  otb_roomnights: number;
  stly_roomnights: number;
  roomnights_delta: number;
  otb_revenue: number;
  stly_revenue: number;
  revenue_delta: number;
}

// ISO2 → display label (subset; unknown codes fall through unchanged).
const COUNTRY_NAMES: Record<string, string> = {
  US: 'USA', GB: 'UK', DE: 'Germany', FR: 'France', IT: 'Italy', ES: 'Spain',
  CH: 'Switzerland', AT: 'Austria', NL: 'Netherlands', SE: 'Sweden', NO: 'Norway',
  DK: 'Denmark', BE: 'Belgium', LU: 'Luxembourg', PL: 'Poland', IE: 'Ireland',
  CA: 'Canada', AU: 'Australia', NZ: 'New Zealand', SG: 'Singapore', JP: 'Japan',
  CN: 'China', KR: 'South Korea', TH: 'Thailand', LA: 'Laos', VN: 'Vietnam',
  IN: 'India', MY: 'Malaysia', PH: 'Philippines', ID: 'Indonesia', HK: 'Hong Kong',
  AE: 'UAE', SA: 'Saudi Arabia', IL: 'Israel', BR: 'Brazil', MX: 'Mexico',
  AR: 'Argentina', CL: 'Chile', ZA: 'South Africa', RU: 'Russia', UA: 'Ukraine',
};
function countryLabel(iso2: string): string {
  if (!iso2 || iso2 === '??' || iso2 === 'Unknown') return 'Unknown';
  return COUNTRY_NAMES[iso2] ?? iso2;
}

function fmtInt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Math.round(Number(n)).toLocaleString('en-US');
}
function fmtMoney(n: number | null | undefined, sym: string): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return sym + Math.round(Number(n)).toLocaleString('en-US');
}
function fmtSigned(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}
function fmtSignedMoney(n: number, sym: string): string {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${sym}${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
}
// "2026-07" or "2026-07-01" → "Jul 2026"
function fmtMonthLabel(ci_month: string | null | undefined): string {
  if (!ci_month) return '—';
  const s = String(ci_month);
  const yy = s.slice(0, 4);
  const mm = Number(s.slice(5, 7));
  if (!Number.isFinite(mm) || mm < 1 || mm > 12) return s;
  const NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${NAMES[mm - 1]} ${yy}`;
}

interface Props {
  searchParams?: Record<string, string | string[] | undefined>;
  propertyId?: number;
}

export default async function DemandPage({ searchParams, propertyId }: Props = {}) {
  const pid = propertyId ?? PROPERTY_ID;
  const sym: string = pid === PROPERTY_ID_DONNA ? '€' : '$';
  const moneyCurrency: 'USD' | 'EUR' = pid === PROPERTY_ID_DONNA ? 'EUR' : 'USD';
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, pid);
  const tabs: DashboardTab[] = subPages.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/demand'),
  }));

  const period = resolvePeriod({ ...(searchParams ?? {}), win: (searchParams?.win ?? 'next90') } as Record<string, string | string[] | undefined>); // PBS #130: default this surface to forward next90, not backward 30d
  // PBS 2026-06-08 #131: day-grain OTB clip for tiles. mv_pace_otb is monthly so
  // sub-month windows (next7/next30) over-reported revenue. v_otb_pace gives per-night
  // OTB; v_reservations_unified gives LY same-window realized for the STLY tile.
  const stlyFrom = (() => { const d = new Date(period.from + 'T00:00:00Z'); d.setUTCFullYear(d.getUTCFullYear() - 1); return d.toISOString().slice(0,10); })();
  const stlyTo   = (() => { const d = new Date(period.to   + 'T00:00:00Z'); d.setUTCFullYear(d.getUTCFullYear() - 1); return d.toISOString().slice(0,10); })();
  const [pace, losDist, bwDist, losWindow, countryLW, sdly, chanMix, actualsMonthly, cxl, countryLosBucket, countryWindowBucket, clipFwdResp, clipStlyResp] = await Promise.all([
    getPaceOtb(period, pid).catch(() => [] as Record<string, unknown>[]),
    supabase.from('v_chart_los_distribution').select('los_bucket, bucket_order, total_reservations, total_revenue, adr, share_pct').eq('property_id', pid).order('bucket_order'),
    supabase.from('v_chart_booking_window_distribution').select('booking_window_bucket, bucket_order, total_reservations, total_revenue, adr, share_pct').eq('property_id', pid).order('bucket_order'),
    supabase.from('v_chart_los_window_correlation').select('los_bucket, los_order, window_bucket, window_order, reservations, avg_los, total_revenue').eq('property_id', pid).order('window_order').order('los_order'),
    supabase.rpc('fn_chart_country_los_window', { p_property_id: pid, p_year: String(searchParams?.yr ?? '') || null }).then((res) => ({ data: (res.data ?? []).slice(0, 20) })),
    supabase.from('v_chart_demand_monthly_sdly').select('ci_month, ty_adr, ly_adr, ty_avg_los, ly_avg_los, ty_revpar, ly_revpar, ty_bookings, ly_bookings').eq('property_id', pid).gte('ci_month', '2024-01').order('ci_month'),
    supabase.from('v_chart_channel_mix_monthly').select('ci_month, ota_bookings, direct_bookings, rest_bookings').eq('property_id', pid).gte('ci_month', '2024-01').order('ci_month'),
    supabase.from('v_chart_actuals_monthly').select('ci_month, roomnights, revenue, adr, occ_pct').eq('property_id', pid).gte('ci_month', '2023-01').order('ci_month'),
    supabase.from('v_cancellation_impact_monthly').select('cancel_year, cancel_month, cancellations, lost_room_nights, lost_revenue').eq('property_id', pid),
    supabase.from('v_country_los_distribution').select('guest_country_iso2, los_bucket, bookings, room_nights, revenue').eq('property_id', pid),
    supabase.from('v_country_lead_time_distribution').select('guest_country_iso2, lead_bucket, bookings, room_nights, revenue').eq('property_id', pid),
    supabase.from('v_otb_pace').select('night_date, confirmed_rooms, confirmed_revenue').eq('property_id', pid).gte('night_date', period.from).lte('night_date', period.to),
    supabase.from('v_reservations_unified').select('nights, total_amount').eq('property_id', pid).eq('is_cancelled', false).gte('check_in_date', stlyFrom).lte('check_in_date', stlyTo),
  ]);

  const allRows: DemandRow[] = (pace as Array<Record<string, unknown>>).map((r) => ({
    ci_month:         String(r.ci_month),
    otb_roomnights:   Number(r.otb_roomnights || 0),
    stly_roomnights:  Number(r.stly_roomnights || 0),
    roomnights_delta: Number(r.roomnights_delta || 0),
    otb_revenue:      Number(r.otb_revenue || 0),
    stly_revenue:     Number(r.stly_revenue || 0),
    revenue_delta:    Number(r.revenue_delta || 0),
  }));
  const rows = allRows;
  const paceTableRows = allRows;

  // PBS 2026-06-08 #131: day-grain totals for OTB Roomnights / OTB Revenue tiles.
  // (Pace table below keeps using rows[] from mv_pace_otb — that view is correctly month-grained.)
  const clipFwd  = (clipFwdResp.data ?? []) as Array<{ night_date: string; confirmed_rooms: number | null; confirmed_revenue: number | null }>;
  const clipStly = (clipStlyResp.data ?? []) as Array<{ nights: number | null; total_amount: number | null }>;
  const total = {
    otb:     clipFwd.reduce((s, r) => s + Number(r.confirmed_rooms ?? 0), 0),
    rev:     clipFwd.reduce((s, r) => s + Number(r.confirmed_revenue ?? 0), 0),
    stly:    clipStly.reduce((s, r) => s + Number(r.nights ?? 0), 0),
    stlyRev: clipStly.reduce((s, r) => s + Number(r.total_amount ?? 0), 0),
  };
  const paceDeltaRn = total.otb - total.stly;
  const paceDeltaRnPct = total.stly ? (paceDeltaRn / total.stly) * 100 : 0;
  const revDelta = total.rev - total.stlyRev;
  const revDeltaPct = total.stlyRev ? (revDelta / total.stlyRev) * 100 : 0;
  const monthsAhead  = rows.filter((r) => r.roomnights_delta > 0).length;
  const monthsBehind = rows.filter((r) => r.roomnights_delta < 0).length;
  const worst = rows.length > 0 ? [...rows].sort((a, b) => a.roomnights_delta - b.roomnights_delta)[0] : null;
  const best  = rows.length > 0 ? [...rows].sort((a, b) => b.roomnights_delta - a.roomnights_delta)[0] : null;

  // Cancellations · YTD vs LY same window (gold: public.v_cancellation_impact_monthly)
  const nowYr = new Date().getUTCFullYear();
  const nowMo = new Date().getUTCMonth() + 1;
  type CxlRow = { cancel_year: number; cancel_month: number; cancellations: number | null; lost_room_nights: number | null; lost_revenue: number | null };
  const cxlRows = ((cxl as { data: CxlRow[] | null }).data ?? []);
  const cxlYtd     = cxlRows.filter((r) => Number(r.cancel_year) === nowYr).reduce((s, r) => s + Number(r.cancellations ?? 0), 0);
  const lostRnYtd  = cxlRows.filter((r) => Number(r.cancel_year) === nowYr).reduce((s, r) => s + Number(r.lost_room_nights ?? 0), 0);
  const lostRevYtd = cxlRows.filter((r) => Number(r.cancel_year) === nowYr).reduce((s, r) => s + Number(r.lost_revenue ?? 0), 0);
  const cxlLy      = cxlRows.filter((r) => Number(r.cancel_year) === nowYr - 1 && Number(r.cancel_month) <= nowMo).reduce((s, r) => s + Number(r.cancellations ?? 0), 0);
  const cxlYoyPct  = cxlLy > 0 ? ((cxlYtd - cxlLy) / cxlLy) * 100 : null;

  // PBS 2026-06-08 #115 — Country dimension: 2 heatmaps + scatter w/ trendline
  const LOS_BUCKETS_TOP = ['1-2 nights','3-5 nights','6-7 nights','8-14 nights','15+ nights'];
  const WIN_BUCKETS_TOP = ['0-7d','8-30d','31-60d','61-120d','120d+'];
  type CwRow = { c: string; res: number; los: number; adr: number };
  const cwData: CwRow[] = ((countryLW.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    c: String(r.guest_country ?? ''),
    res: Number(r.reservations ?? 0),
    los: Number(r.avg_los ?? 0),
    adr: Number(r.adr ?? 0),
  }));
  const topCountries = cwData.slice(0, 10).map((r) => r.c);
  type Cell = { bk: number; rn: number; rev: number };
  const losMap = new Map<string, Cell>();
  ((countryLosBucket.data ?? []) as Array<Record<string, unknown>>).forEach((r) => {
    losMap.set(`${r.guest_country_iso2}|${r.los_bucket}`, { bk: Number(r.bookings ?? 0), rn: Number(r.room_nights ?? 0), rev: Number(r.revenue ?? 0) });
  });
  const winMap = new Map<string, Cell>();
  ((countryWindowBucket.data ?? []) as Array<Record<string, unknown>>).forEach((r) => {
    winMap.set(`${r.guest_country_iso2}|${r.lead_bucket}`, { bk: Number(r.bookings ?? 0), rn: Number(r.room_nights ?? 0), rev: Number(r.revenue ?? 0) });
  });
  // Build value matrices restricted to top 10 countries for clean color scaling
  const losVals: number[] = [];
  for (const ct of topCountries) for (const b of LOS_BUCKETS_TOP) { const x = losMap.get(`${ct}|${b}`); if (x) losVals.push(x.bk); }
  const winAdrs: number[] = [];
  for (const ct of topCountries) for (const b of WIN_BUCKETS_TOP) { const x = winMap.get(`${ct}|${b}`); if (x && x.rn > 0) winAdrs.push(x.rev / x.rn); }
  const maxLosBk = Math.max(1, ...losVals);
  const maxWinAdr = Math.max(1, ...winAdrs);
  const bw = (t: number): string => { const v = Math.round(255 - Math.min(1, Math.max(0, t)) * 200); return `rgb(${v},${v},${v})`; };
  const bwTxt = (t: number): string => t > 0.5 ? '#FFFFFF' : '#000';
  // Scatter + linear regression: per-country avg LOS (x) vs ADR (y), dot size = sqrt(reservations)
  type ScatPt = { c: string; x: number; y: number; rn: number };
  const scatterPts: ScatPt[] = cwData.filter((r) => r.los > 0 && r.adr > 0).slice(0, 12).map((r) => ({ c: r.c, x: r.los, y: r.adr, rn: r.res }));
  let trend: { m: number; b: number } | null = null;
  if (scatterPts.length >= 2) {
    const n = scatterPts.length;
    let sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (const p of scatterPts) { sx += p.x; sy += p.y; sxy += p.x * p.y; sxx += p.x * p.x; }
    const denom = n * sxx - sx * sx;
    if (Math.abs(denom) > 1e-9) { const m = (n * sxy - sx * sy) / denom; trend = { m, b: (sy - m * sx) / n }; }
  }
  const sxs = scatterPts.map((p) => p.x);
  const sys = scatterPts.map((p) => p.y);
  const sxMin = sxs.length ? Math.max(0.5, Math.min(...sxs) - 0.5) : 1;
  const sxMax = sxs.length ? Math.max(...sxs) * 1.10 : 15;
  const syMin = 0;
  const syMax = sys.length ? Math.max(...sys) * 1.10 : 500;
  const scaleX = (v: number): number => 60 + ((v - sxMin) / (sxMax - sxMin)) * 720;
  const scaleY = (v: number): number => 280 - ((v - syMin) / (syMax - syMin)) * 250;
  const trendX1 = sxMin, trendX2 = sxMax;
  const trendY1 = trend ? trend.m * trendX1 + trend.b : null;
  const trendY2 = trend ? trend.m * trendX2 + trend.b : null;

  const tiles: KpiTileProps[] = [
    { label: 'OTB Roomnights', value: fmtInt(total.otb), size: 'sm',
      delta: total.stly > 0 ? { value: paceDeltaRnPct, period: 'STLY',
        direction: paceDeltaRn >= 0 ? 'up' : 'down' } : undefined,
      footnote: period.label,
      status: paceDeltaRn >= 0 ? 'green' : 'red' },
    { label: 'OTB Revenue', value: Math.round(total.rev), currency: moneyCurrency, size: 'sm',
      delta: total.stlyRev > 0 ? { value: revDeltaPct, period: 'STLY',
        direction: revDelta >= 0 ? 'up' : 'down' } : undefined,
      footnote: period.label,
      status: revDelta >= 0 ? 'green' : 'red' },
    { label: 'OTB ADR (fwd)', value: total.otb > 0 ? Math.round(total.rev / total.otb) : 0, currency: moneyCurrency, size: 'sm',
      footnote: 'forward avg rate on the books',
      status: 'grey' },
    { label: 'Months on books', value: rows.length, size: 'sm',
      footnote: `forward · ${monthsAhead} ahead · ${monthsBehind} behind STLY`,
      status: monthsAhead >= monthsBehind ? 'green' : 'amber' },
    { label: 'Cancelled (YTD)', value: fmtInt(cxlYtd), size: 'sm',
      delta: cxlYoyPct != null ? { value: cxlYoyPct, period: 'vs LY same window',
        direction: cxlYtd < cxlLy ? 'down' : cxlYtd > cxlLy ? 'up' : 'flat',
        isGoodWhenUp: false } : undefined,
      footnote: `${fmtInt(lostRnYtd)} lost RN · ${sym}${fmtInt(lostRevYtd)} lost rev · YTD ${nowYr}`,
      status: cxlYoyPct == null ? 'grey' : cxlYoyPct <= 0 ? 'green' : 'amber' },
  ];
  // PBS 2026-06-08 #132: Strongest/Softest are meaningful only when there are
  // genuinely contrasting months. With 1 row (e.g. next7 → only current month) the
  // same row was rendered twice as best AND worst. Hide each tile when its sign
  // doesn't match (best must be > 0 ahead, worst must be < 0 behind).
  const showStrongest = best  && Number(best.roomnights_delta)  > 0;
  const showSoftest   = worst && Number(worst.roomnights_delta) < 0;
  const signals: KpiTileProps[] = [
    { label: 'Months ahead of pace', value: monthsAhead, size: 'sm', footnote: 'Δ RN > 0', status: monthsAhead > 0 ? 'green' : 'grey' },
    { label: 'Months behind', value: monthsBehind, size: 'sm', footnote: 'Δ RN < 0', status: monthsBehind === 0 ? 'green' : 'amber' },
    { label: 'Strongest month', value: showStrongest ? fmtMonthLabel(best.ci_month) : '—', size: 'sm',
      footnote: showStrongest ? `${fmtSigned(best.roomnights_delta)} RN vs STLY` : 'no month ahead of pace',
      status: showStrongest ? 'green' : 'grey' },
    { label: 'Softest month', value: showSoftest ? fmtMonthLabel(worst.ci_month) : '—', size: 'sm',
      footnote: showSoftest ? `${fmtSigned(worst.roomnights_delta)} RN vs STLY` : 'no month behind pace',
      status: showSoftest ? 'amber' : 'grey' },
  ];

  const trendData = rows.map((r) => ({ ci_month: r.ci_month, otb_rn: r.otb_roomnights, stly_rn: r.stly_roomnights }));
  const revData = rows.map((r) => ({ ci_month: r.ci_month, otb_rev: Math.round(r.otb_revenue), stly_rev: Math.round(r.stly_revenue) }));
  const deltaData = rows.map((r) => ({ ci_month: r.ci_month, rn_delta: r.roomnights_delta }));
  const trendSeries: ChartSeries[] = [
    { key: 'otb_rn',  label: 'OTB room-nights', color: '#1F3A2E' },
    { key: 'stly_rn', label: 'STLY room-nights', color: '#5A5A5A' },
  ];
  const revSeries: ChartSeries[] = [
    { key: 'otb_rev',  label: 'OTB revenue', color: '#1F3A2E' },
    { key: 'stly_rev', label: 'STLY revenue', color: '#B8542A' },
  ];

  const basePath = pid !== PROPERTY_ID ? `/h/${pid}/revenue/demand` : '/revenue/demand';
  const winOptions: Array<{ k: WindowKey; label: string }> = [
    { k: 'next7', label: '+7d' }, { k: 'next30', label: '+30d' },
    { k: 'next90', label: '+90d' }, { k: 'next180', label: '+180d' }, { k: 'next365', label: '+365d' },
  ];
  const hrefFor = (newWin: WindowKey) => {
    const p = new URLSearchParams();
    p.set('win', newWin); // PBS 2026-06-08 #130: resolvePeriod defaults to "30d" (backward), so we must ALWAYS pin ?win= here, otherwise +90d silently → Last 30 days
    if (period.cmp && period.cmp !== 'none') p.set('cmp', period.cmp);
    const qs = p.toString();
    return `${basePath}${qs ? '?' + qs : ''}`;
  };

  return (
    <DashboardPage
      title="Revenue · Demand"
      subtitle={`Forward pace vs STLY · ${period.label}`}
      tabs={tabs}
    >
      {/* PBS 2026-07-08: header aligned to Pulse / Pace / Cancellations canonical pattern.
          Row A = forward-window pill row (hardcoded #FFF/#E6DFCC/#1F3A2E per token-ladder rule).
          Row B = OTB headline strip (Container, density='compact', 160px min / 8px gap).
          Row C = Pace-signals strip (same tile geometry, same Container density). */}
      {/* PBS 2026-07-09 pm: pill row replaced with a compact dropdown inside the headline strip. */}
      <div style={{ gridColumn: '1 / -1' }}>
        <WindowSelect
          basePath={basePath}
          currentWin={period.win}
          currentCmp={period.cmp ?? null}
          options={winOptions.map((o) => ({ value: o.k, label: o.label }))}
        />
      </div>

      {/* PBS 2026-07-08: one container, two stacked tile rows.
          Row 1 = OTB headline (RN / Rev / ADR / Months on books / Cancelled YTD)
          Row 2 = Pace signals (Months ahead / Months behind / Strongest / Softest month)
          Hairline divider + section label between the rows so the story stays scannable. */}
      <div style={fullRow}>
        <Container
          title="Headline · pace"
          subtitle={`OTB vs STLY · ${period.label} · ${monthsAhead} months ahead · ${monthsBehind} behind`}
          density="compact"
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            {tiles.map((t, i) => <KpiTile key={`t-${i}`} {...t} />)}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            margin: '12px 0 8px', color: '#5A5A5A',
            fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600,
          }}>
            <span>Pace signals · where the year is ahead vs behind STLY</span>
            <span style={{ flex: 1, height: 1, background: '#E6DFCC' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            {signals.map((t, i) => <KpiTile key={`s-${i}`} {...t} />)}
          </div>
        </Container>
      </div>

      <div style={{ ...fullRow, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 10, alignItems: 'stretch' }}>
        <Container title="Room-nights · OTB vs STLY" subtitle="by check-in month">
          <Chart variant="line" data={trendData} xKey="ci_month" series={trendSeries} height={220}
            empty={{ title: 'No demand rows', hint: 'mv_pace_otb returned 0 rows' }} />
        </Container>
        <Container title="Revenue · OTB vs STLY" subtitle={`by check-in month · ${moneyCurrency}`}>
          <Chart variant="line" data={revData} xKey="ci_month" series={revSeries} height={220}
            empty={{ title: 'No revenue rows' }} />
        </Container>
      </div>

      <div style={fullRow}>
        <Container title={`Pace by check-in month · ${paceTableRows.length} forward month${paceTableRows.length === 1 ? '' : 's'}`} subtitle={`Room revenue only (no tax / fee / ancillary · ${moneyCurrency}) · forward OTB pace vs STLY · green = ahead · red = behind`}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left',  padding: '6px 8px', borderBottom: '2px solid #000', fontWeight: 700, color: '#000', background: '#FFFFFF' }}>Check-in month</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '2px solid #000', fontWeight: 700, color: '#000', background: '#FFFFFF' }}>OTB RN</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '2px solid #000', fontWeight: 700, color: '#000', background: '#FFFFFF' }}>STLY RN</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '2px solid #000', fontWeight: 700, color: '#000', background: '#FFFFFF' }}>Δ RN</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '2px solid #000', fontWeight: 700, color: '#000', background: '#FFFFFF' }}>OTB Room Rev</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '2px solid #000', fontWeight: 700, color: '#000', background: '#FFFFFF' }}>STLY Room Rev</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '2px solid #000', fontWeight: 700, color: '#000', background: '#FFFFFF' }}>Δ Room Rev</th>
                </tr>
              </thead>
              <tbody>
                {paceTableRows.map((r) => (
                  <tr key={r.ci_month}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #E0E0E0' }}>{fmtMonthLabel(r.ci_month)}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #E0E0E0', fontVariantNumeric: 'tabular-nums' }}>{fmtInt(r.otb_roomnights)}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #E0E0E0', fontVariantNumeric: 'tabular-nums' }}>{fmtInt(r.stly_roomnights)}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #E0E0E0', fontVariantNumeric: 'tabular-nums', color: r.roomnights_delta > 0 ? '#1F7A4B' : r.roomnights_delta < 0 ? '#B22222' : 'var(--ink-soft, #5A5A5A)', fontWeight: 600 }}>{fmtSigned(r.roomnights_delta)}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #E0E0E0', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(r.otb_revenue, sym)}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #E0E0E0', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(r.stly_revenue, sym)}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #E0E0E0', fontVariantNumeric: 'tabular-nums', color: r.revenue_delta > 0 ? '#1F7A4B' : r.revenue_delta < 0 ? '#B22222' : 'var(--ink-soft, #5A5A5A)', fontWeight: 600 }}>{fmtSignedMoney(r.revenue_delta, sym)}</td>
                  </tr>
                ))}
                {paceTableRows.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 16, textAlign: 'center', color: 'var(--ink-soft, #5A5A5A)' }}>No forward pace rows for this property</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Container>
      </div>

      <div style={{ ...fullRow, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, alignItems: 'stretch' }}>
        <Container title="LOS bucket distribution" subtitle="all-time · reservations by length-of-stay bucket">
          <Chart variant="bar" data={(losDist.data ?? []).map((r) => ({
            bucket: String((r as Record<string, unknown>).los_bucket ?? ''),
            reservations: Number((r as Record<string, unknown>).total_reservations ?? 0),
            share_pct: Number((r as Record<string, unknown>).share_pct ?? 0),
          }))} xKey="bucket"
            series={[{ key: 'reservations', label: 'Reservations', color: '#1F3A2E' }]}
            height={220} empty={{ title: 'No LOS distribution data' }} />
        </Container>
        <Container title="Booking window distribution" subtitle="all-time · reservations by booking-window bucket">
          <Chart variant="bar" data={(bwDist.data ?? []).map((r) => ({
            bucket: String((r as Record<string, unknown>).booking_window_bucket ?? ''),
            reservations: Number((r as Record<string, unknown>).total_reservations ?? 0),
            share_pct: Number((r as Record<string, unknown>).share_pct ?? 0),
          }))} xKey="bucket"
            series={[{ key: 'reservations', label: 'Reservations', color: '#B8542A' }]}
            height={220} empty={{ title: 'No booking window data' }} />
        </Container>
      </div>

      <div style={threeUp}>
        <Container title="ADR · TY vs LY" subtitle="monthly · by check-in month">
          <Chart variant="line" data={((sdly.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
            ci_month: String(r.ci_month),
            ty_adr:   Number(r.ty_adr ?? 0),
            ly_adr:   Number(r.ly_adr ?? 0),
          }))} xKey="ci_month"
            series={[
              { key: 'ty_adr', label: 'TY ADR', color: '#1F3A2E' },
              { key: 'ly_adr', label: 'LY ADR', color: '#5A5A5A' },
            ]}
            height={200} empty={{ title: 'No ADR data' }} />
        </Container>
        <Container title="LOS · TY vs LY" subtitle="avg length-of-stay by month">
          <Chart variant="line" data={((sdly.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
            ci_month: String(r.ci_month),
            ty_los:   Number(r.ty_avg_los ?? 0),
            ly_los:   Number(r.ly_avg_los ?? 0),
          }))} xKey="ci_month"
            series={[
              { key: 'ty_los', label: 'TY LOS', color: '#1F3A2E' },
              { key: 'ly_los', label: 'LY LOS', color: '#5A5A5A' },
            ]}
            height={200} empty={{ title: 'No LOS data' }} />
        </Container>
        <Container title="RevPAR · TY vs LY" subtitle="rooms revenue ÷ available room-nights · by month">
          <Chart variant="line" data={((sdly.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
            ci_month: String(r.ci_month),
            ty_revpar: Number(r.ty_revpar ?? 0),
            ly_revpar: Number(r.ly_revpar ?? 0),
          }))} xKey="ci_month"
            series={[
              { key: 'ty_revpar', label: 'TY RevPAR', color: '#1F3A2E' },
              { key: 'ly_revpar', label: 'LY RevPAR', color: '#B8542A' },
            ]}
            height={200} empty={{ title: 'No RevPAR data' }} />
        </Container>
      </div>

      <div style={fullRow}>
        <Container title="Channel mix · monthly trend" subtitle="OTAs · Direct · Other (wholesale / group / corporate)">
          <Chart variant="line" data={((chanMix.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
            ci_month: String(r.ci_month),
            ota:      Number(r.ota_bookings ?? 0),
            direct:   Number(r.direct_bookings ?? 0),
            other:    Number(r.rest_bookings ?? 0),
          }))} xKey="ci_month"
            series={[
              { key: 'ota',    label: 'OTAs',   color: '#1F3A2E' },
              { key: 'direct', label: 'Direct', color: '#B8542A' },
              { key: 'other',  label: 'Other',  color: '#B8A878' },
            ]}
            height={240} empty={{ title: 'No channel mix data' }} />
        </Container>
      </div>

      <div style={fullRow}>
        <Container title="LOS × Booking-window correlation" subtitle="x = LOS bucket · y = booking-window bucket · cell intensity = reservation count">
          <Chart variant="heatmap" data={((losWindow.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
            los:    String(r.los_bucket ?? ''),
            window: String(r.window_bucket ?? ''),
            count:  Number(r.reservations ?? 0),
          }))}
            xKey="los"
            yKey="window"
            series={[{ key: 'count', label: 'Reservations' }]}
            height={300}
            empty={{ title: 'No reservations in window' }} />
        </Container>
      </div>

      <div style={fullRow}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center', fontSize: 11 }}>
          <span style={{ color: 'var(--ink-soft, #5A5A5A)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Year:</span>
          {(['all', '2024', '2025', '2026'] as const).map((y) => {
            const cur = String(searchParams?.yr ?? '');
            const isActive = (y === 'all' && !cur) || cur === y;
            const href = y === 'all' ? '?' : '?yr=' + y;
            return (
              <a key={y} href={href} style={{ padding: '2px 10px', borderRadius: 999, border: '1px solid var(--hairline, #E6DFCC)', textDecoration: 'none', color: isActive ? 'var(--paper, #FFFFFF)' : 'var(--ink, #1B1B1B)', background: isActive ? 'var(--primary, #1F3A2E)' : 'transparent', fontWeight: isActive ? 600 : 400 }}>{y === 'all' ? 'All' : y}</a>
            );
          })}
        </div>
        <Container title="Country × LOS bucket · bookings heatmap" subtitle="darker grey = more bookings · top 10 countries · all-time">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #000', fontWeight: 700, color: '#000', background: '#FFFFFF' }}>Country</th>
                  {LOS_BUCKETS_TOP.map((b) => <th key={b} style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '2px solid #000', fontWeight: 700, color: '#000', background: '#FFFFFF' }}>{b}</th>)}
                </tr>
              </thead>
              <tbody>
                {topCountries.map((iso) => (
                  <tr key={iso}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #E0E0E0', fontWeight: 600 }}>{countryLabel(iso)}</td>
                    {LOS_BUCKETS_TOP.map((b) => {
                      const c = losMap.get(`${iso}|${b}`);
                      const v = c?.bk ?? 0;
                      const t = v / maxLosBk;
                      return <td key={b} style={{ background: bw(t), color: bwTxt(t), padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #E0E0E0', fontVariantNumeric: 'tabular-nums' }} title={c ? `${v} bk · ${c.rn} RN · ${fmtMoney(c.rev, sym)}` : 'no data'}>{v > 0 ? v : ''}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </div>

      <div style={fullRow}>
        <Container title="Country × Booking-window bucket · ADR heatmap" subtitle={`darker grey = higher ADR · top 10 countries · all-time · ${moneyCurrency}`}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #000', fontWeight: 700, color: '#000', background: '#FFFFFF' }}>Country</th>
                  {WIN_BUCKETS_TOP.map((b) => <th key={b} style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '2px solid #000', fontWeight: 700, color: '#000', background: '#FFFFFF' }}>{b}</th>)}
                </tr>
              </thead>
              <tbody>
                {topCountries.map((iso) => (
                  <tr key={iso}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #E0E0E0', fontWeight: 600 }}>{countryLabel(iso)}</td>
                    {WIN_BUCKETS_TOP.map((b) => {
                      const c = winMap.get(`${iso}|${b}`);
                      const adr = c && c.rn > 0 ? c.rev / c.rn : 0;
                      const t = adr / maxWinAdr;
                      return <td key={b} style={{ background: bw(t), color: bwTxt(t), padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #E0E0E0', fontVariantNumeric: 'tabular-nums' }} title={c ? `${c.bk} bk · ${c.rn} RN · ADR ${fmtMoney(adr, sym)}` : 'no data'}>{adr > 0 ? fmtMoney(adr, sym) : ''}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </div>

      <div style={fullRow}>
        <Container title="Avg LOS × ADR correlation per country" subtitle={`dot size = reservation volume · dashed line = linear trend${trend ? ` · slope ${trend.m >= 0 ? '+' : ''}${trend.m.toFixed(1)} ${sym}/night` : ''} · ${moneyCurrency}`}>
          {scatterPts.length === 0 ? (
            <div style={{ padding: 16, color: '#555', fontStyle: 'italic' }}>Not enough country data points</div>
          ) : (
            <svg width="100%" height="320" viewBox="0 0 800 320" preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
              <line x1="60" y1="280" x2="780" y2="280" stroke="#000" strokeWidth={1.5} />
              <line x1="60" y1="20" x2="60" y2="280" stroke="#000" strokeWidth={1.5} />
              {[2, 4, 6, 8, 10, 12, 14].filter((v) => v >= sxMin && v <= sxMax).map((v) => (
                <g key={`xt-${v}`}>
                  <line x1={scaleX(v)} y1="280" x2={scaleX(v)} y2="284" stroke="#000" strokeWidth={1} />
                  <text x={scaleX(v)} y="298" textAnchor="middle" fontSize="11" fill="#000">{v}n</text>
                </g>
              ))}
              <text x="420" y="316" textAnchor="middle" fontSize="11" fontWeight={700} fill="#000">Avg LOS (nights)</text>
              {Array.from({ length: 5 }, (_, i) => syMin + (syMax - syMin) * (i + 1) / 5).map((v) => (
                <g key={`yt-${v.toFixed(0)}`}>
                  <line x1="56" y1={scaleY(v)} x2="60" y2={scaleY(v)} stroke="#000" strokeWidth={1} />
                  <text x="52" y={scaleY(v) + 4} textAnchor="end" fontSize="11" fill="#000">{sym}{Math.round(v).toLocaleString('en-US')}</text>
                </g>
              ))}
              <text x="14" y="150" textAnchor="middle" fontSize="11" fontWeight={700} fill="#000" transform="rotate(-90 14 150)">ADR</text>
              {trend && trendY1 != null && trendY2 != null && (
                <line x1={scaleX(trendX1)} y1={scaleY(trendY1)} x2={scaleX(trendX2)} y2={scaleY(trendY2)} stroke="#000" strokeWidth={2} strokeDasharray="6 3" />
              )}
              {scatterPts.map((p, i) => {
                const r = Math.max(4, Math.min(18, Math.sqrt(p.rn) / 2));
                return (
                  <g key={`p-${i}`}>
                    <circle cx={scaleX(p.x)} cy={scaleY(p.y)} r={r} fill="#000" fillOpacity={0.7} stroke="#000" strokeWidth={1}><title>{`${countryLabel(p.c)} · Avg LOS ${p.x.toFixed(1)}n · ADR ${sym}${Math.round(p.y).toLocaleString('en-US')} · ${p.rn} reservations`}</title></circle>
                    <text x={scaleX(p.x) + r + 4} y={scaleY(p.y) + 4} fontSize="10" fill="#000">{countryLabel(p.c)}</text>
                  </g>
                );
              })}
            </svg>
          )}
        </Container>
      </div>

      <div style={fullRow}>
        <Container title="Actuals since opening · monthly RN + revenue + ADR" subtitle="realised (past months only) · separate from forward pace above">
          <Chart variant="combo" data={((actualsMonthly.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
            ci_month: String(r.ci_month),
            roomnights: Number(r.roomnights ?? 0),
            revenue: Number(r.revenue ?? 0),
            adr: Number(r.adr ?? 0),
          }))} xKey="ci_month"
            series={[
              { key: 'roomnights', label: 'Room-nights', color: '#1F3A2E', yAxisId: 'left' },
              { key: 'revenue',    label: 'Revenue',     color: '#B8A878', yAxisId: 'left' },
              { key: 'adr',        label: 'ADR',         color: '#B8542A', yAxisId: 'right' },
            ]} height={280} empty={{ title: 'No actuals' }} />
        </Container>
      </div>
    </DashboardPage>
  );
}
