// app/revenue/demand/page.tsx
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

  const period = resolvePeriod(searchParams ?? {});
  const [pace, losDist, bwDist, losWindow, countryLW, sdly, chanMix, actualsMonthly, cxl] = await Promise.all([
    getPaceOtb(period, pid).catch(() => [] as Record<string, unknown>[]),
    supabase.from('v_chart_los_distribution').select('los_bucket, bucket_order, total_reservations, total_revenue, adr, share_pct').eq('property_id', pid).order('bucket_order'),
    supabase.from('v_chart_booking_window_distribution').select('booking_window_bucket, bucket_order, total_reservations, total_revenue, adr, share_pct').eq('property_id', pid).order('bucket_order'),
    supabase.from('v_chart_los_window_correlation').select('los_bucket, los_order, window_bucket, window_order, reservations, avg_los, total_revenue').eq('property_id', pid).order('window_order').order('los_order'),
    supabase.rpc('fn_chart_country_los_window', { p_property_id: pid, p_year: String(searchParams?.yr ?? '') || null }).then((res) => ({ data: (res.data ?? []).slice(0, 20) })),
    supabase.from('v_chart_demand_monthly_sdly').select('ci_month, ty_adr, ly_adr, ty_avg_los, ly_avg_los, ty_revpar, ly_revpar, ty_bookings, ly_bookings').eq('property_id', pid).gte('ci_month', '2024-01').order('ci_month'),
    supabase.from('v_chart_channel_mix_monthly').select('ci_month, ota_bookings, direct_bookings, rest_bookings').eq('property_id', pid).gte('ci_month', '2024-01').order('ci_month'),
    supabase.from('v_chart_actuals_monthly').select('ci_month, roomnights, revenue, adr, occ_pct').eq('property_id', pid).gte('ci_month', '2023-01').order('ci_month'),
    supabase.from('v_cancellation_impact_monthly').select('cancel_year, cancel_month, cancellations, lost_room_nights, lost_revenue').eq('property_id', pid),
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

  const total = rows.reduce(
    (a, r) => ({
      otb: a.otb + r.otb_roomnights, rev: a.rev + r.otb_revenue,
      stly: a.stly + r.stly_roomnights, stlyRev: a.stlyRev + r.stly_revenue,
    }),
    { otb: 0, rev: 0, stly: 0, stlyRev: 0 },
  );
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
  const signals: KpiTileProps[] = [
    { label: 'Months ahead of pace', value: monthsAhead, size: 'sm', footnote: 'Δ RN > 0', status: monthsAhead > 0 ? 'green' : 'grey' },
    { label: 'Months behind', value: monthsBehind, size: 'sm', footnote: 'Δ RN < 0', status: monthsBehind === 0 ? 'green' : 'amber' },
    { label: 'Strongest month', value: best ? fmtMonthLabel(best.ci_month) : '—', size: 'sm',
      footnote: best ? `${fmtSigned(best.roomnights_delta)} RN vs STLY` : 'no data',
      status: best ? 'green' : 'grey' },
    { label: 'Softest month', value: worst ? fmtMonthLabel(worst.ci_month) : '—', size: 'sm',
      footnote: worst ? `${fmtSigned(worst.roomnights_delta)} RN vs STLY` : 'no data',
      status: worst ? (worst.roomnights_delta < 0 ? 'amber' : 'green') : 'grey' },
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
    if (newWin !== 'next90') p.set('win', newWin);
    if (period.cmp && period.cmp !== 'none') p.set('cmp', period.cmp);
    const qs = p.toString();
    return `${basePath}${qs ? '?' + qs : ''}`;
  };

  return (
    <DashboardPage
      title="Revenue · Demand"
      subtitle={`Find the gap before the calendar gets soft · ${period.label} · ${rows.length} month${rows.length === 1 ? '' : 's'} on the books`}
      tabs={tabs}
    >
      <div style={fullRow}>
        <Container title="OTB headline" subtitle={`forward window · ${period.label}`} density="compact">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>
      </div>

      <div style={fullRow}>
        <Container title="Pace signals" subtitle="where the year is ahead vs behind STLY" density="compact">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {signals.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>
      </div>

      <div style={threeUp}>
        <Container title="Room-nights · OTB vs STLY" subtitle="by check-in month · gap between lines = Δ shown in bar chart →">
          <Chart variant="line" data={trendData} xKey="ci_month" series={trendSeries} height={220}
            empty={{ title: 'No demand rows', hint: 'mv_pace_otb returned 0 rows' }} />
        </Container>
        <Container title="Revenue · OTB vs STLY" subtitle={`by check-in month · ${moneyCurrency}`}>
          <Chart variant="line" data={revData} xKey="ci_month" series={revSeries} height={220}
            empty={{ title: 'No revenue rows' }} />
        </Container>
        <Container title="Δ Room-nights · monthly vs STLY" subtitle="= OTB RN − STLY RN · same data as the line chart, plotted as the gap · positive = ahead">
          <Chart variant="bar" data={deltaData} xKey="ci_month"
            series={[{ key: 'rn_delta', label: 'Δ RN vs STLY', color: '#1F3A2E' }]}
            height={220} empty={{ title: 'No delta rows' }} />
        </Container>
      </div>

      <div style={fullRow}>
        <Container title={`Pace by check-in month · ${paceTableRows.length} forward month${paceTableRows.length === 1 ? '' : 's'}`} subtitle={`Room revenue only (no tax / fee / ancillary · ${moneyCurrency}) · forward OTB pace vs STLY · green = ahead · red = behind`}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left',  padding: '6px 8px', borderBottom: '1px solid var(--hairline, #E6DFCC)', fontWeight: 600 }}>Check-in month</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--hairline, #E6DFCC)', fontWeight: 600 }}>OTB RN</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--hairline, #E6DFCC)', fontWeight: 600 }}>STLY RN</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--hairline, #E6DFCC)', fontWeight: 600 }}>Δ RN</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--hairline, #E6DFCC)', fontWeight: 600 }}>OTB Room Rev</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--hairline, #E6DFCC)', fontWeight: 600 }}>STLY Room Rev</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--hairline, #E6DFCC)', fontWeight: 600 }}>Δ Room Rev</th>
                </tr>
              </thead>
              <tbody>
                {paceTableRows.map((r) => (
                  <tr key={r.ci_month}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--hairline, #F0EBD8)' }}>{fmtMonthLabel(r.ci_month)}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--hairline, #F0EBD8)', fontVariantNumeric: 'tabular-nums' }}>{fmtInt(r.otb_roomnights)}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--hairline, #F0EBD8)', fontVariantNumeric: 'tabular-nums' }}>{fmtInt(r.stly_roomnights)}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--hairline, #F0EBD8)', fontVariantNumeric: 'tabular-nums', color: r.roomnights_delta > 0 ? '#1F7A4B' : r.roomnights_delta < 0 ? '#B22222' : 'var(--ink-soft, #5A5A5A)', fontWeight: 600 }}>{fmtSigned(r.roomnights_delta)}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--hairline, #F0EBD8)', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(r.otb_revenue, sym)}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--hairline, #F0EBD8)', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(r.stly_revenue, sym)}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--hairline, #F0EBD8)', fontVariantNumeric: 'tabular-nums', color: r.revenue_delta > 0 ? '#1F7A4B' : r.revenue_delta < 0 ? '#B22222' : 'var(--ink-soft, #5A5A5A)', fontWeight: 600 }}>{fmtSignedMoney(r.revenue_delta, sym)}</td>
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
        <Container title="Country × LOS × Booking-window" subtitle="who books late vs who plans · short-window % flags reactive bookers · top 20 by volume">
          <Chart variant="table" data={((countryLW.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
            country:           countryLabel(String(r.guest_country ?? '')),
            reservations:      Number(r.reservations ?? 0),
            avg_los:           Number(r.avg_los ?? 0).toFixed(1) + ' n',
            avg_window:        Number(r.avg_window_days ?? 0).toFixed(0) + ' d',
            short_window_pct:  Number(r.short_window_pct ?? 0).toFixed(1) + '%',
            share_pct:         Number(r.share_pct ?? 0).toFixed(1) + '%',
            adr:               r.adr != null ? fmtMoney(Number(r.adr), sym) : '—',
          }))}
            xKey="country"
            series={[
              { key: 'reservations',     label: 'Bookings' },
              { key: 'avg_los',          label: 'Avg LOS' },
              { key: 'avg_window',       label: 'Avg window' },
              { key: 'short_window_pct', label: '≤7d %' },
              { key: 'share_pct',        label: 'Share' },
              { key: 'adr',              label: 'ADR' },
            ]}
            empty={{ title: 'No country reservations data' }} />
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
