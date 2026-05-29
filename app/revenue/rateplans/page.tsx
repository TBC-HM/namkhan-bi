// app/revenue/rateplans/page.tsx
// PBS 2026-05-29 #59 — Rate Plan analysis page (6 sections).
// Data foundation: public.v_rate_plan_classified (regex on rate_name) +
// public.v_reservation_rate_plan_classified (per-booking + classifier).
// Section views: v_rate_plan_nrr_kpis_monthly · v_rate_plan_lead_time_realized ·
// v_rate_plan_meal_compare_monthly · v_rate_plan_promo_impact · v_rate_plan_restrictions.
// Hygiene reuses v_rate_plan_sleeping + v_rate_plan_orphans.

import {
  DashboardPage, Container, KpiTile,
  type DashboardTab, type KpiTileProps,
} from '@/app/(cockpit)/_design';
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
    nrrMonthly, leadTime, mealCompare, promoImpact, restrictions, sleeping, orphans, classifiedCount,
  ] = await Promise.all([
    supabase.from('v_rate_plan_nrr_kpis_monthly')
      .select('month, bookings_active, bookings_nrr, bookings_advance_purchase, bookings_flex, bookings_semi_flex, bookings_promo, revenue_total, revenue_nrr, revenue_advance_purchase, revenue_flex, revenue_promo, cash_collected_nrr, cash_collected_total, cancel_rate_nrr_pct, cancel_rate_flex_pct, adr_nrr, adr_flex, avg_lead_nrr, avg_lead_flex')
      .eq('property_id', pid)
      .gte('month', ytdStart).lt('month', ytdEndExclusive)
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
  ]);

  // Aggregate Section 1 KPIs across YTD
  const totals = (nrrMonthly as Array<Record<string, unknown>>).reduce((acc, r) => {
    acc.bookings_active           += Number(r.bookings_active ?? 0);
    acc.bookings_nrr              += Number(r.bookings_nrr ?? 0);
    acc.bookings_advance_purchase += Number(r.bookings_advance_purchase ?? 0);
    acc.bookings_flex             += Number(r.bookings_flex ?? 0);
    acc.bookings_promo            += Number(r.bookings_promo ?? 0);
    acc.revenue_total             += Number(r.revenue_total ?? 0);
    acc.revenue_nrr               += Number(r.revenue_nrr ?? 0);
    acc.revenue_advance_purchase  += Number(r.revenue_advance_purchase ?? 0);
    acc.revenue_flex              += Number(r.revenue_flex ?? 0);
    acc.revenue_promo             += Number(r.revenue_promo ?? 0);
    acc.cash_collected_nrr        += Number(r.cash_collected_nrr ?? 0);
    return acc;
  }, { bookings_active: 0, bookings_nrr: 0, bookings_advance_purchase: 0, bookings_flex: 0, bookings_promo: 0, revenue_total: 0, revenue_nrr: 0, revenue_advance_purchase: 0, revenue_flex: 0, revenue_promo: 0, cash_collected_nrr: 0 });

  const nrrShareBookings = totals.bookings_active > 0 ? 100 * totals.bookings_nrr / totals.bookings_active : 0;
  const nrrShareRevenue  = totals.revenue_total > 0 ? 100 * totals.revenue_nrr / totals.revenue_total : 0;
  const apShareRevenue   = totals.revenue_total > 0 ? 100 * totals.revenue_advance_purchase / totals.revenue_total : 0;
  const promoShareRevenue= totals.revenue_total > 0 ? 100 * totals.revenue_promo / totals.revenue_total : 0;
  const flexShareRevenue = totals.revenue_total > 0 ? 100 * totals.revenue_flex / totals.revenue_total : 0;

  const mewsCashHidden = pid === PROPERTY_ID_DONNA; // Mews sync doesn't deliver paid_amount

  const strip: KpiTileProps[] = [
    { label: 'NRR share · bookings', value: `${nrrShareBookings.toFixed(1)}%`, size: 'sm', footnote: `${totals.bookings_nrr} NRR · ${totals.bookings_active} total YTD`, status: nrrShareBookings >= 30 ? 'green' : nrrShareBookings >= 15 ? 'amber' : 'grey' },
    { label: 'NRR share · revenue', value: `${nrrShareRevenue.toFixed(1)}%`, size: 'sm', footnote: `${money(totals.revenue_nrr, sym)} of ${money(totals.revenue_total, sym)}` },
    { label: 'Advance-purchase rev', value: `${apShareRevenue.toFixed(1)}%`, size: 'sm', footnote: `${money(totals.revenue_advance_purchase, sym)} · early-bird capture` },
    { label: 'Flex share · revenue', value: `${flexShareRevenue.toFixed(1)}%`, size: 'sm', footnote: `${money(totals.revenue_flex, sym)} kept flexible` },
    { label: 'Promo share · revenue', value: `${promoShareRevenue.toFixed(1)}%`, size: 'sm', footnote: `${money(totals.revenue_promo, sym)} via promotions`, status: promoShareRevenue >= 10 ? 'amber' : 'grey' },
    { label: 'NRR cash collected YTD', value: mewsCashHidden ? '—' : money(totals.cash_collected_nrr, sym), size: 'sm', footnote: mewsCashHidden ? 'Mews payment sync pending' : 'paid_amount sum · cash banked' },
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
  const leadIndex: Record<string, Record<string, { adr: number; bookings: number; revenue: number }>> = {};
  (leadTime as Array<Record<string, unknown>>).forEach((r) => {
    const lb = String(r.lead_bucket); const rk = String(r.rate_kind);
    leadIndex[lb] = leadIndex[lb] ?? {};
    const existing = leadIndex[lb][rk];
    if (!existing) {
      leadIndex[lb][rk] = { adr: Number(r.adr ?? 0), bookings: Number(r.bookings ?? 0), revenue: Number(r.revenue ?? 0) };
    } else {
      // Multiple months in YTD — weighted-avg ADR by nights, but we don't have nights here. Use revenue-weighted ADR fallback.
      const a = existing.revenue + Number(r.revenue ?? 0);
      const b = existing.bookings + Number(r.bookings ?? 0);
      existing.adr = b > 0 ? a / Math.max(1, b) : existing.adr; // approximation
      existing.bookings = b;
      existing.revenue = a;
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
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
        {strip.map((t, i) => <KpiTile key={i} {...t} />)}
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
                      <td style={tdLabel}>{r.meal_plan ?? '—'}</td>
                      <td style={tdNum}>{r.min_los_nights ?? '—'}</td>
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
