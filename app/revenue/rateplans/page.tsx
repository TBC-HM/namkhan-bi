// app/revenue/rateplans/page.tsx
// PBS 2026-05-29 #59 — Rate Plan analysis page (6 sections).
// Data foundation: public.v_rate_plan_classified (regex on rate_name) +
// public.v_reservation_rate_plan_classified (per-booking + classifier).
// Section views: v_rate_plan_nrr_kpis_monthly · v_rate_plan_lead_time_realized ·
// v_rate_plan_meal_compare_monthly · v_rate_plan_promo_impact · v_rate_plan_restrictions.
// Hygiene reuses v_rate_plan_sleeping + v_rate_plan_orphans.

import {
  DashboardPage, Container, KpiTile, Chart,
  type DashboardTab, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import RoTooltipChart from '@/app/_components/registry/RoTooltipChart';
import { supabase } from '@/lib/supabase';
import { REVENUE_SUBPAGES } from '../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

const PROPERTY_ID_NAMKHAN = 260955;
const PROPERTY_ID_DONNA   = 1000001;

interface Props { searchParams: Record<string, string | string[] | undefined>; propertyId?: number }

// Reused styling for the cell-based tables (paper white + hairlines per design system)
const thStyle: React.CSSProperties = { padding: '6px 10px', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10, color: 'var(--ink-soft, #5A5A5A)', background: 'var(--bg, #F4EFE2)' };
const tdLabel: React.CSSProperties = { padding: '6px 10px', whiteSpace: 'nowrap' };
const tdNum:   React.CSSProperties = { padding: '6px 10px', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };
const rowSep: React.CSSProperties  = { borderTop: '1px solid var(--hairline, #E6DFCC)' };

function pct(num: number, den: number): string { return den > 0 ? `${(100 * num / den).toFixed(1)}%` : '—'; }
function money(v: number | null | undefined, sym: string): string {
  if (v == null) return '—';
  return `${sym}${Math.round(v).toLocaleString('en-US')}`;
}

export default async function RatePlansPage({ searchParams, propertyId }: Props) {
  const pid = propertyId ?? PROPERTY_ID_NAMKHAN;
  const moneyCurrency: 'USD' | 'EUR' = pid === PROPERTY_ID_DONNA ? 'EUR' : 'USD';
  const sym = moneyCurrency === 'EUR' ? '€' : '$';

  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, pid);
  const basePath = pid !== PROPERTY_ID_NAMKHAN ? `/h/${pid}/revenue/rateplans` : '/revenue/rateplans';
  const tabs: DashboardTab[] = subPages.map((s) => ({ key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/rateplans') }));

  // Period: default = YTD-2026 (Jan-now) per PBS YTD preference
  const today = new Date();
  const ytdStart = `${today.getUTCFullYear()}-01-01`;
  const ytdEndExclusive = new Date(today.getUTCFullYear(), today.getUTCMonth() + 1, 1).toISOString().slice(0, 10);

  // Parallel data fetch
  const [
    nrrMonthly, leadTime, mealCompare, promoImpact, restrictions, sleeping, orphans, classifiedCount, cashTiming,
  ] = await Promise.all([
    supabase.from('v_rate_plan_nrr_kpis_monthly')
      .select('month, bookings_active, bookings_nrr, bookings_nrr_locked, bookings_advance_purchase, bookings_flex, bookings_flex_bucket, bookings_semi_flex, bookings_promo, bookings_package, bookings_other, bookings_ro, bookings_with_meal, revenue_total, revenue_nrr, revenue_nrr_locked, revenue_advance_purchase, revenue_flex, revenue_flex_bucket, revenue_promo, revenue_package, revenue_other, revenue_ro, revenue_bb, room_nights_ro, room_nights_flex_bucket, cash_collected_nrr, cash_collected_total, cancel_rate_nrr_pct, cancel_rate_flex_pct, adr_nrr, adr_flex, avg_lead_nrr, avg_lead_flex')
      .eq('property_id', pid)
      .gte('month', ytdStart).lt('month', '2027-01-01')
      .order('month').then((r) => r.data ?? []),
    supabase.from('v_rate_plan_lead_time_realized')
      .select('check_in_month, rate_kind, lead_bucket, lead_sort, bookings, room_nights, adr, revenue')
      .eq('property_id', pid)
      .gte('check_in_month', ytdStart).lt('check_in_month', ytdEndExclusive)
      .in('rate_kind', ['nrr','advance_purchase','flex','semi_flex','promo'])
      .order('lead_sort').then((r) => r.data ?? []),
    supabase.from('v_rate_plan_meal_compare_monthly')
      .select('month, room_type_name, meal_plan, bookings, room_nights, adr, revenue')
      .eq('property_id', pid)
      .gte('month', ytdStart).lt('month', ytdEndExclusive)
      .order('room_type_name').then((r) => r.data ?? []),
    supabase.from('v_rate_plan_promo_impact')
      .select('rate_plan, bookings_active, bookings_cancelled, cancel_rate_pct, revenue_active, nights_active, promo_adr, flex_adr, adr_gap, foregone_revenue, avg_lead_days, first_stay, last_stay')
      .eq('property_id', pid)
      .order('revenue_active', { ascending: false }).then((r) => r.data ?? []),
    supabase.from('v_rate_plan_restrictions')
      .select('rate_name, rate_kind, meal_plan, is_member, channel_restriction, min_los_nights, bookings_active, revenue_active, last_stay, restriction_kind')
      .eq('property_id', pid)
      .order('bookings_active', { ascending: false }).then((r) => r.data ?? []),
    supabase.from('v_rate_plan_sleeping')
      .select('rate_name, rate_type, last_booked, days_since')
      .eq('property_id', pid)
      .order('days_since', { ascending: false }).limit(30).then((r) => r.data ?? []),
    supabase.from('v_rate_plan_orphans')
      .select('rate_plan, bookings_lifetime, revenue_lifetime, last_booked')
      .eq('property_id', pid)
      .order('bookings_lifetime', { ascending: false }).limit(30).then((r) => r.data ?? []),
    supabase.from('v_rate_plan_classified').select('rate_id', { count: 'exact', head: true }).eq('property_id', pid).eq('is_active', true).then((r) => r.count ?? 0),
    supabase.from('v_rate_plan_nrr_cash_timing')
      .select('booking_month, lead_bucket, lead_sort, bookings, cash_collected')
      .eq('property_id', pid)
      .gte('booking_month', '2026-01-01').lt('booking_month', '2027-01-01')
      .order('booking_month').order('lead_sort').then((r) => r.data ?? []),
  ]);

  // Aggregate Section 1 KPIs across YTD — explicit accumulator type so tsc doesn't widen acc to unknown
  type NrrTotals = {
    bookings_active: number;
    bookings_nrr_locked: number; bookings_flex_bucket: number; bookings_promo: number;
    bookings_package: number; bookings_other: number;
    bookings_ro: number; bookings_with_meal: number;
    bookings_nrr: number; bookings_advance_purchase: number; bookings_flex: number;
    revenue_total: number;
    revenue_nrr_locked: number; revenue_flex_bucket: number; revenue_promo: number;
    revenue_package: number; revenue_other: number;
    revenue_ro: number;
    revenue_nrr: number; revenue_advance_purchase: number; revenue_flex: number;
    room_nights_ro: number; room_nights_flex_bucket: number;
    cash_collected_nrr: number;
  };
  const totals = (nrrMonthly as Array<Record<string, unknown>>).filter((r) => String(r.month) < ytdEndExclusive).reduce<NrrTotals>((acc, r) => {
    acc.bookings_active           += Number(r.bookings_active ?? 0);
    acc.bookings_nrr_locked       += Number(r.bookings_nrr_locked ?? 0);
    acc.bookings_flex_bucket      += Number(r.bookings_flex_bucket ?? 0);
    acc.bookings_promo            += Number(r.bookings_promo ?? 0);
    acc.bookings_package          += Number(r.bookings_package ?? 0);
    acc.bookings_other            += Number(r.bookings_other ?? 0);
    acc.bookings_ro               += Number(r.bookings_ro ?? 0);
    acc.bookings_with_meal        += Number(r.bookings_with_meal ?? 0);
    acc.bookings_nrr              += Number(r.bookings_nrr ?? 0);
    acc.bookings_advance_purchase += Number(r.bookings_advance_purchase ?? 0);
    acc.bookings_flex             += Number(r.bookings_flex ?? 0);
    acc.revenue_total             += Number(r.revenue_total ?? 0);
    acc.revenue_nrr_locked        += Number(r.revenue_nrr_locked ?? 0);
    acc.revenue_flex_bucket       += Number(r.revenue_flex_bucket ?? 0);
    acc.revenue_promo             += Number(r.revenue_promo ?? 0);
    acc.revenue_package           += Number(r.revenue_package ?? 0);
    acc.revenue_other             += Number(r.revenue_other ?? 0);
    acc.revenue_ro                += Number(r.revenue_ro ?? 0);
    acc.room_nights_ro            += Number(r.room_nights_ro ?? 0);
    acc.room_nights_flex_bucket   += Number(r.room_nights_flex_bucket ?? 0);
    acc.revenue_nrr               += Number(r.revenue_nrr ?? 0);
    acc.revenue_advance_purchase  += Number(r.revenue_advance_purchase ?? 0);
    acc.revenue_flex              += Number(r.revenue_flex ?? 0);
    acc.cash_collected_nrr        += Number(r.cash_collected_nrr ?? 0);
    return acc;
  }, { bookings_active: 0, bookings_nrr_locked: 0, bookings_flex_bucket: 0, bookings_promo: 0, bookings_package: 0, bookings_other: 0, bookings_ro: 0, bookings_with_meal: 0, bookings_nrr: 0, bookings_advance_purchase: 0, bookings_flex: 0, revenue_total: 0, revenue_nrr_locked: 0, revenue_flex_bucket: 0, revenue_promo: 0, revenue_package: 0, revenue_other: 0, revenue_ro: 0, revenue_nrr: 0, revenue_advance_purchase: 0, revenue_flex: 0, room_nights_ro: 0, room_nights_flex_bucket: 0, cash_collected_nrr: 0 });

  // PBS 2026-05-31 #66 — mutually-exclusive revenue buckets summing to 100% + Room Only (meal-plan dimension)
  const nrrLockedShare = totals.revenue_total > 0 ? 100 * totals.revenue_nrr_locked  / totals.revenue_total : 0;
  const flexShare      = totals.revenue_total > 0 ? 100 * totals.revenue_flex_bucket / totals.revenue_total : 0;
  const promoShare     = totals.revenue_total > 0 ? 100 * totals.revenue_promo       / totals.revenue_total : 0;
  const packageShare   = totals.revenue_total > 0 ? 100 * totals.revenue_package     / totals.revenue_total : 0;
  const otherShare     = totals.revenue_total > 0 ? 100 * totals.revenue_other       / totals.revenue_total : 0;
  const roShareBookings = totals.bookings_active > 0 ? 100 * totals.bookings_ro / totals.bookings_active : 0;
  const roShareRevenue  = totals.revenue_total   > 0 ? 100 * totals.revenue_ro / totals.revenue_total : 0;
  // PBS 2026-05-31 #74 — YTD revenue loss of RO vs BAR/Flex (= (Flex ADR − RO ADR) × RO nights)
  const adrRoYtd   = totals.room_nights_ro          > 0 ? totals.revenue_ro          / totals.room_nights_ro          : 0;
  const adrFlexYtd = totals.room_nights_flex_bucket > 0 ? totals.revenue_flex_bucket / totals.room_nights_flex_bucket : 0;
  const roLossVsBar = totals.room_nights_ro > 0 && adrFlexYtd > 0 ? (adrFlexYtd - adrRoYtd) * totals.room_nights_ro : 0;

  // PBS 2026-05-31 #67 — chart data for 3 top graphs (RO 2026 · NRR vs BAR vs BB · all rate-plan buckets)
  const chartRows2026 = (nrrMonthly as Array<Record<string, unknown>>)
    .filter((r) => String(r.month).startsWith('2026'))
    .map((r) => {
      const bk_total = Number(r.bookings_active ?? 0);
      const bk_ro    = Number(r.bookings_ro ?? 0);
      return {
        month:          String(r.month).slice(0, 7),
        ro:             Number(r.revenue_ro ?? 0),
        nrr_locked:     Number(r.revenue_nrr_locked ?? 0),
        flex_bar:       Number(r.revenue_flex_bucket ?? 0),
        bb:             Number(r.revenue_bb ?? 0),
        promo:          Number(r.revenue_promo ?? 0),
        packageRev:     Number(r.revenue_package ?? 0),
        other:          Number(r.revenue_other ?? 0),
        total:          Number(r.revenue_total ?? 0),
        ro_occ_pct:     bk_total > 0 ? 100 * bk_ro / bk_total : 0,
        bookings_ro:    bk_ro,
        bookings_total: bk_total,
      };
    });

  // PBS 2026-05-31 #72 — NRR cash-timing rows (one per booking month, stacked by lead bucket)
  type CashRow = { month: string; d_0_30: number; d_31_60: number; d_61_90: number; d_91_120: number; d_121_plus: number; total: number };
  const cashByMonth: Record<string, CashRow> = {};
  (cashTiming as Array<Record<string, unknown>>).forEach((r) => {
    const m = String(r.booking_month).slice(0, 7);
    const bucket = String(r.lead_bucket);
    const cash = Number(r.cash_collected ?? 0);
    if (!cashByMonth[m]) cashByMonth[m] = { month: m, d_0_30: 0, d_31_60: 0, d_61_90: 0, d_91_120: 0, d_121_plus: 0, total: 0 };
    if (bucket === '0-30d')   cashByMonth[m].d_0_30     += cash;
    if (bucket === '31-60d')  cashByMonth[m].d_31_60    += cash;
    if (bucket === '61-90d')  cashByMonth[m].d_61_90    += cash;
    if (bucket === '91-120d') cashByMonth[m].d_91_120   += cash;
    if (bucket === '121d+')   cashByMonth[m].d_121_plus += cash;
    cashByMonth[m].total += cash;
  });
  const cashTimingRows = Object.values(cashByMonth).sort((a, b) => a.month.localeCompare(b.month));

  const mewsCashHidden = pid === PROPERTY_ID_DONNA; // Mews sync doesn't deliver paid_amount

  const strip: KpiTileProps[] = [
    { label: 'NRR locked',  value: `${nrrLockedShare.toFixed(1)}%`, size: 'sm', footnote: `${money(totals.revenue_nrr_locked, sym)} · NRR + Advance Purchase`, status: nrrLockedShare >= 30 ? 'green' : nrrLockedShare >= 15 ? 'amber' : 'grey' },
    { label: 'Flex',        value: `${flexShare.toFixed(1)}%`,      size: 'sm', footnote: `${money(totals.revenue_flex_bucket, sym)} · Flex + Semi-Flex` },
    { label: 'Promo',       value: `${promoShare.toFixed(1)}%`,     size: 'sm', footnote: `${money(totals.revenue_promo, sym)} · promotional rates`, status: promoShare >= 10 ? 'amber' : 'grey' },
    { label: 'Package',     value: `${packageShare.toFixed(1)}%`,   size: 'sm', footnote: `${money(totals.revenue_package, sym)} · packages + retreats` },
    { label: 'Other',       value: `${otherShare.toFixed(1)}%`,     size: 'sm', footnote: `${money(totals.revenue_other, sym)} · corporate / member / group / comp` },
    { label: 'Room Only',   value: `${roShareBookings.toFixed(1)}%`,size: 'sm', footnote: totals.bookings_ro === 0 ? `0 of ${totals.bookings_active} bookings · property doesn''t tag RO in rate names` : `${totals.room_nights_ro} RN · ${totals.bookings_ro}/${totals.bookings_active} bk · loss vs BAR ${money(roLossVsBar, sym)} (${roShareRevenue.toFixed(1)}% of rev)` },
  ];

  // Section 2 — discount timing heat-table (rows = lead bucket, columns = rate_kind, cell = ADR)
  const leadBuckets = ['0-7d','8-30d','31-60d','61-90d','91-180d','181d+'];
  const leadKinds: Array<{key: string; label: string}> = [
    { key: 'flex',             label: 'Flex / BAR' },
    { key: 'semi_flex',        label: 'Semi-Flex' },
    { key: 'nrr',              label: 'NRR' },
    { key: 'advance_purchase', label: 'Advance Purchase' },
    { key: 'promo',            label: 'Promo' },
  ];
  // PBS 2026-05-31 #65 — ADR must be SUM(revenue) / SUM(room_nights), NOT / bookings. Donna long-stays exposed the bug: 0-7d × NRR showed €1309 (rev/bookings) instead of €394 (rev/nights).
  const leadIndex: Record<string, Record<string, { adr: number; bookings: number; nights: number; revenue: number }>> = {};
  (leadTime as Array<Record<string, unknown>>).forEach((r) => {
    const lb = String(r.lead_bucket); const rk = String(r.rate_kind);
    leadIndex[lb] = leadIndex[lb] ?? {};
    const existing = leadIndex[lb][rk];
    const bookings = Number(r.bookings ?? 0);
    const nights   = Number(r.room_nights ?? 0);
    const revenue  = Number(r.revenue ?? 0);
    if (!existing) {
      leadIndex[lb][rk] = { adr: Number(r.adr ?? 0), bookings, nights, revenue };
    } else {
      existing.bookings += bookings;
      existing.nights   += nights;
      existing.revenue  += revenue;
      existing.adr      = existing.nights > 0 ? existing.revenue / existing.nights : existing.adr;
    }
  });

  // Section 3 — BB vs RO per room type
  const mealByRoom: Record<string, Record<string, { adr: number; bookings: number; nights: number; revenue: number }>> = {};
  (mealCompare as Array<Record<string, unknown>>).forEach((r) => {
    const rt = String(r.room_type_name ?? '—'); const mp = String(r.meal_plan ?? '—');
    mealByRoom[rt] = mealByRoom[rt] ?? {};
    const ex = mealByRoom[rt][mp];
    if (!ex) {
      mealByRoom[rt][mp] = { adr: Number(r.adr ?? 0), bookings: Number(r.bookings ?? 0), nights: Number(r.room_nights ?? 0), revenue: Number(r.revenue ?? 0) };
    } else {
      ex.bookings += Number(r.bookings ?? 0); ex.nights += Number(r.room_nights ?? 0); ex.revenue += Number(r.revenue ?? 0);
      ex.adr = ex.nights > 0 ? Math.round(ex.revenue / ex.nights) : ex.adr;
    }
  });
  const roomTypes = Object.keys(mealByRoom).sort();

  return (
    <DashboardPage
      title="Revenue · Rate Plans"
      subtitle={`Active catalogue · ${classifiedCount} rate plans · NRR / Flex / Promo / Package mix · YTD-${today.getUTCFullYear()}${mewsCashHidden ? ' · Cash collection: Mews sync pending' : ''}`}
      tabs={tabs}
    >
      {/* Section 1 — NRR cash-discipline strip */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: `repeat(${strip.length}, minmax(0, 1fr))`, gap: 8, marginBottom: 12 }}>
        {strip.map((t, i) => <KpiTile key={i} {...t} />)}
      </div>

      {/* PBS 2026-05-31 #72 — NRR cash-timing slim chart (full width). Stacks = cash per booking-month × days-to-check-in. €400k/mo = self-funding threshold (above → only security; below → real working capital). */}
      <div style={{ gridColumn: '1 / -1', marginBottom: 12 }}>
        <Container title="NRR cash-timing · cash collected per booking month × lead bucket"
                   subtitle={`Stacked by days-to-check-in (0-30 / 31-60 / 61-90 / 91-120 / 121+) · winter cash from summer bookings · €400k/mo = self-funding threshold`}>
          <Chart variant="stacked_bar" data={cashTimingRows} xKey="month"
            series={[
              { key: 'd_0_30',    label: '0-30d',   color: 'var(--terracotta, #B8542A)' },
              { key: 'd_31_60',   label: '31-60d',  color: '#C97A4E' },
              { key: 'd_61_90',   label: '61-90d',  color: '#8C7A4E' },
              { key: 'd_91_120',  label: '91-120d', color: '#5C9BB5' },
              { key: 'd_121_plus',label: '121d+',   color: 'var(--primary, #1F3A2E)' },
            ]}
            height={160}
            empty={{ title: 'No NRR cash data' }} />
        </Container>
      </div>

      {/* PBS 2026-05-31 #67 — 3 top graphs below KPIs */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, marginBottom: 12 }}>
        <Container title="Room Only · 2026 revenue per month" subtitle={`meal_plan = 'RO' · hover shows monthly OCC share of bookings`}>
          <RoTooltipChart data={chartRows2026} sym={sym} />
        </Container>
        <Container title="NRR vs Flex/BAR vs Breakfast · 2026 revenue per month" subtitle="3 lines: NRR-locked · Flex+BAR · BB-included">
          <Chart variant="line" data={chartRows2026} xKey="month"
            series={[
              { key: 'nrr_locked', label: 'NRR locked',  color: 'var(--primary, #1F3A2E)' },
              { key: 'flex_bar',   label: 'Flex / BAR',  color: 'var(--terracotta, #B8542A)' },
              { key: 'bb',         label: 'BB included', color: '#8C7A4E' },
            ]}
            height={180}
            empty={{ title: 'No 2026 data' }} />
        </Container>
        <Container title="All rate plans · 2026 revenue per month" subtitle="5 mutually-exclusive buckets · sum = total revenue">
          <Chart variant="line" data={chartRows2026} xKey="month"
            series={[
              { key: 'nrr_locked', label: 'NRR locked', color: 'var(--primary, #1F3A2E)' },
              { key: 'flex_bar',   label: 'Flex / BAR', color: 'var(--terracotta, #B8542A)' },
              { key: 'promo',      label: 'Promo',      color: '#8C7A4E' },
              { key: 'packageRev', label: 'Package',    color: '#5C9BB5' },
              { key: 'other',      label: 'Other',      color: '#A0A0A0' },
            ]}
            height={180}
            empty={{ title: 'No 2026 data' }} />
        </Container>
      </div>

      {/* Section 2 — discount-timing heat-table */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Discount-timing · ADR by lead bucket × rate kind"
                   subtitle={`YTD-${today.getUTCFullYear()} stays · weighted by nights · cell = realised ADR`}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Lead bucket</th>
                  {leadKinds.map((k) => <th key={k.key} style={{ ...thStyle, textAlign: 'right' }}>{k.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {leadBuckets.map((lb) => (
                  <tr key={lb} style={rowSep}>
                    <td style={tdLabel}>{lb}</td>
                    {leadKinds.map((k) => {
                      const v = leadIndex[lb]?.[k.key];
                      return (
                        <td key={k.key} style={tdNum}>
                          {v ? `${money(v.adr, sym)}` : '—'}
                          {v ? <div style={{ fontSize: 10, color: 'var(--ink-soft, #5A5A5A)' }}>{v.bookings} bk</div> : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '8px 14px', fontSize: 11, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
            Reading guide: if NRR / Advance-Purchase ADR &lt; Flex ADR at the same lead bucket, that booking sold below realised price → forgone uplift per night.
          </div>
        </Container>
      </div>

      {/* Section 3 — BB vs RO relationship per room type */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Breakfast · BB vs RO vs HB per room type"
                   subtitle={`YTD-${today.getUTCFullYear()} stays · ADR delta = BB premium over RO at the same room type`}>
          {roomTypes.length === 0 ? (
            <div style={{ padding: 14, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
              No meal-plan-classified bookings in the period. Most Namkhan rate plans don&apos;t carry an explicit BB/RO suffix.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Room type</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>BB · nights</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>BB · ADR</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>RO · nights</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>RO · ADR</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>HB · nights</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>HB · ADR</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>BB premium (vs RO)</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Total revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {roomTypes.map((rt) => {
                    const bb = mealByRoom[rt]['BB']; const ro = mealByRoom[rt]['RO']; const hb = mealByRoom[rt]['HB'];
                    const premium = (bb && ro) ? bb.adr - ro.adr : null;
                    return (
                      <tr key={rt} style={rowSep}>
                        <td style={tdLabel}>{rt}</td>
                        <td style={tdNum}>{bb ? bb.nights : '—'}</td>
                        <td style={tdNum}>{bb ? money(bb.adr, sym) : '—'}</td>
                        <td style={tdNum}>{ro ? ro.nights : '—'}</td>
                        <td style={tdNum}>{ro ? money(ro.adr, sym) : '—'}</td>
                        <td style={tdNum}>{hb ? hb.nights : '—'}</td>
                        <td style={tdNum}>{hb ? money(hb.adr, sym) : '—'}</td>
                        <td style={tdNum}>{premium != null ? money(premium, sym) : '—'}</td>
                        <td style={tdNum}>{money((bb?.revenue ?? 0) + (ro?.revenue ?? 0) + (hb?.revenue ?? 0), sym)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Container>
      </div>

      {/* Section 4 — Promo impact */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Promo rate plans · impact vs Flex baseline"
                   subtitle={`Each promo · bookings · cancel rate · ADR vs Flex/Semi-Flex baseline · forgone revenue = (flex_adr − promo_adr) × nights`}>
          {(promoImpact as Array<unknown>).length === 0 ? (
            <div style={{ padding: 14, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>No promo rate plans booked.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Promo</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Bookings</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Cancel %</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Nights</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Promo ADR</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Flex ADR (baseline)</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>ADR gap</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Forgone rev</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Avg lead</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {(promoImpact as Array<Record<string, unknown>>).map((r, i) => (
                    <tr key={i} style={rowSep}>
                      <td style={tdLabel}>{String(r.rate_plan)}</td>
                      <td style={tdNum}>{Number(r.bookings_active)}</td>
                      <td style={tdNum}>{r.cancel_rate_pct != null ? `${Number(r.cancel_rate_pct).toFixed(1)}%` : '—'}</td>
                      <td style={tdNum}>{Number(r.nights_active)}</td>
                      <td style={tdNum}>{money(Number(r.promo_adr), sym)}</td>
                      <td style={tdNum}>{money(Number(r.flex_adr), sym)}</td>
                      <td style={tdNum}>{r.adr_gap != null ? money(Number(r.adr_gap), sym) : '—'}</td>
                      <td style={tdNum}>{r.foregone_revenue != null ? money(Number(r.foregone_revenue), sym) : '—'}</td>
                      <td style={tdNum}>{r.avg_lead_days != null ? `${Number(r.avg_lead_days)}d` : '—'}</td>
                      <td style={tdNum}>{money(Number(r.revenue_active), sym)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Container>
      </div>

      {/* Section 5 — Restrictions */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Rate plans with restrictions · channel / LOS / member"
                   subtitle={`Plans gated by a channel restriction, a minimum LOS, or member-only access · sorted by bookings`}>
          {(restrictions as Array<unknown>).length === 0 ? (
            <div style={{ padding: 14, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>No restricted rate plans active.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Rate plan</th>
                    <th style={thStyle}>Kind</th>
                    <th style={thStyle}>Restriction</th>
                    <th style={thStyle}>Meal</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Min LOS</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Bookings</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Revenue</th>
                    <th style={thStyle}>Last stay</th>
                  </tr>
                </thead>
                <tbody>
                  {(restrictions as Array<Record<string, unknown>>).map((r, i) => (
                    <tr key={i} style={rowSep}>
                      <td style={tdLabel}>{String(r.rate_name)}</td>
                      <td style={tdLabel}>{String(r.rate_kind)}</td>
                      <td style={tdLabel}>{String(r.restriction_kind ?? '—')} {r.channel_restriction ? `· ${r.channel_restriction}` : ''} {r.is_member ? '· members' : ''}</td>
                      <td style={tdLabel}>{(r.meal_plan as string | null) ?? '—'}</td>
                      <td style={tdNum}>{(r.min_los_nights as number | null) ?? '—'}</td>
                      <td style={tdNum}>{Number(r.bookings_active ?? 0)}</td>
                      <td style={tdNum}>{money(Number(r.revenue_active ?? 0), sym)}</td>
                      <td style={tdLabel}>{r.last_stay ? String(r.last_stay) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Container>
      </div>

      {/* Section 6 — Hygiene */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12 }}>
        <Container title="Sleeping rate plans · no recent bookings" subtitle="Candidates to retire or refresh">
          {(sleeping as Array<unknown>).length === 0 ? (
            <div style={{ padding: 14, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>None.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr><th style={thStyle}>Rate plan</th><th style={thStyle}>Type</th><th style={thStyle}>Last booked</th><th style={{ ...thStyle, textAlign: 'right' }}>Days</th></tr></thead>
                <tbody>
                  {(sleeping as Array<Record<string, unknown>>).map((r, i) => (
                    <tr key={i} style={rowSep}>
                      <td style={tdLabel}>{String(r.rate_name)}</td>
                      <td style={tdLabel}>{String(r.rate_type ?? '—')}</td>
                      <td style={tdLabel}>{r.last_booked ? String(r.last_booked) : '—'}</td>
                      <td style={tdNum}>{r.days_since != null ? `${Number(r.days_since)}d` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Container>
        <Container title="Orphan rate plans · booked but not in catalogue" subtitle="Sync gap · PMS dropped the catalogue entry but bookings exist">
          {(orphans as Array<unknown>).length === 0 ? (
            <div style={{ padding: 14, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>None.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr><th style={thStyle}>Rate plan</th><th style={{ ...thStyle, textAlign: 'right' }}>Bookings</th><th style={{ ...thStyle, textAlign: 'right' }}>Revenue</th><th style={thStyle}>Last booked</th></tr></thead>
                <tbody>
                  {(orphans as Array<Record<string, unknown>>).map((r, i) => (
                    <tr key={i} style={rowSep}>
                      <td style={tdLabel}>{String(r.rate_plan)}</td>
                      <td style={tdNum}>{Number(r.bookings_lifetime ?? 0)}</td>
                      <td style={tdNum}>{money(Number(r.revenue_lifetime ?? 0), sym)}</td>
                      <td style={tdLabel}>{r.last_booked ? String(r.last_booked) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Container>
      </div>
    </DashboardPage>
  );
}
