// app/revenue/pickup-day/page.tsx
// PBS 2026-07-07: "Day report" — day-by-day forward outlook + pickup deltas.
// Mirrors PBS's Excel day report (grouped-header layout). This is a first cut:
// wired columns pull real data; the rest are placeholders until each source lands
// (visibility flags, min-stay/stop-sales per channel, rate ladder from Cloudbeds
// availability API, city occ %, house uses).

import Link from 'next/link';
import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { PROPERTY_ID } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { REVENUE_SUBPAGES } from '../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface PaceRow {
  stay_date: string;      // YYYY-MM-DD
  year: number;
  month: number;
  iso_dow: number;
  rooms_available: number;
  otb_rooms_sold: number;
  otb_revenue: number;
  otb_occupancy_pct: number;
  otb_adr: number;
  otb_revpar: number;
}

interface PickupDelta { rn: number; rev: number; adr: number }

interface PickupRow {
  stay_date: string;
  otb_rooms_now: number; otb_rooms_1d_ago: number; otb_rooms_7d_ago: number;
  otb_revenue_now: number; otb_revenue_1d_ago: number; otb_revenue_7d_ago: number;
  new_bookings_2d_rn: number;
  cancellations_2d_rn: number;
}

interface Props { propertyId?: number }

async function fetchData(propertyId: number) {
  const sb = getSupabaseAdmin();
  const todayIso = new Date().toISOString().slice(0, 10);
  const in365 = new Date(Date.now() + 365 * 86400_000).toISOString().slice(0, 10);

  // Latest Lighthouse snapshot for this property (feeds the Demand column).
  const { data: latestSnap } = await sb.from('v_lighthouse_rateshop')
    .select('shop_date').eq('property_id', propertyId)
    .order('shop_date', { ascending: false }).limit(1);
  const snapshotDate = latestSnap?.[0]?.shop_date ?? null;

  const [pace, pickup, promos, demand] = await Promise.all([
    sb.schema('kpi').from('v_pace_otb_daily')
      .select('stay_date, year, month, iso_dow, rooms_available, otb_rooms_sold, otb_revenue, otb_occupancy_pct, otb_adr, otb_revpar')
      .eq('property_id', propertyId)
      .gte('stay_date', todayIso).lte('stay_date', in365)
      .order('stay_date'),
    // Real -1d and -7d pickup from v_pickup_day_report (derived from reservation booking_date).
    sb.from('v_pickup_day_report')
      .select('stay_date, otb_rooms_now, otb_rooms_1d_ago, otb_rooms_7d_ago, otb_revenue_now, otb_revenue_1d_ago, otb_revenue_7d_ago, new_bookings_2d_rn, cancellations_2d_rn')
      .eq('property_id', propertyId),
    // Channel promotion activation state — powers the 5 visibility columns (green if active, red if not).
    sb.from('channel_promotions')
      .select('channel, promo_key, is_active, cost_pct')
      .eq('property_id', propertyId),
    // Lighthouse market_demand per stay_date, from the own-hotel row (context values live there).
    snapshotDate
      ? sb.from('v_lighthouse_rateshop')
          .select('stay_date, market_demand')
          .eq('property_id', propertyId)
          .eq('shop_date', snapshotDate)
          .eq('is_self', true)
      : Promise.resolve({ data: [] as Array<{ stay_date: string; market_demand: number | null }> }),
  ]);

  const promoMap = new Map<string, { active: boolean; costPct: number | null }>();
  for (const p of ((promos.data ?? []) as Array<{ channel: string; promo_key: string; is_active: boolean; cost_pct: number | null }>)) {
    promoMap.set(`${p.channel}::${p.promo_key}`, { active: p.is_active, costPct: p.cost_pct });
  }

  const demandMap = new Map<string, number>();
  for (const r of ((demand.data ?? []) as Array<{ stay_date: string; market_demand: number | null }>)) {
    if (r.market_demand !== null && r.market_demand !== undefined) demandMap.set(r.stay_date, Number(r.market_demand));
  }

  return {
    pace: (pace.data ?? []) as PaceRow[],
    pickupMap: new Map(((pickup.data ?? []) as PickupRow[]).map(r => [r.stay_date, r])),
    promoMap,
    demandMap,
    snapshotDate,
  };
}

function pickup(cur: PaceRow, p: PickupRow | undefined, kind: '1d' | '7d'): PickupDelta {
  if (!p) return { rn: 0, rev: 0, adr: 0 };
  const rn = Number(p.otb_rooms_now) - Number(kind === '1d' ? p.otb_rooms_1d_ago : p.otb_rooms_7d_ago);
  const rev = Number(p.otb_revenue_now) - Number(kind === '1d' ? p.otb_revenue_1d_ago : p.otb_revenue_7d_ago);
  const adr = rn !== 0 ? rev / rn : 0;
  return { rn, rev, adr };
}

const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
function fmtDate(iso: string) {
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function fmtInt(n: number | null | undefined) {
  return n == null ? '' : Math.round(n).toLocaleString('en-US');
}
function fmtMoney(n: number | null | undefined, sym: string) {
  return n == null ? '' : `${Math.round(n).toLocaleString('en-US')} ${sym}`;
}
function fmtPct(n: number | null | undefined) {
  return n == null ? '' : `${Math.round(n)}%`;
}

// Row-level colour law (PBS 2026-07-07 evening).
// Both new + cxl → visual split (left green / right red) — implemented per-cell by column index.
// Only new → all cells green. Only cxl → all cells red. Neither → zebra.
// SPLIT_PIVOT is the column index at which the row visually switches from green to red.
// Row has 37 leaf columns (see thead row 2); midpoint chosen at column 18 (Genius) to fall in the visibility block.
const SPLIT_PIVOT = 18;

// GREEN / RED / ZEBRA cell backgrounds. Row-level signals win over per-cell visCell
// backgrounds so the row reads as a coloured band end-to-end.
// PBS 2026-07-08: broader rule — any night with OTB bookings = green (was: last-2-day
// activity only, which was too rare to see day-to-day).
const ROW_GREEN = '#DFF0DE';
const ROW_RED   = '#F5D5CE';

/**
 * Returns the cell background for the given column index given the row state.
 *   - cxl > 0    → red (recent-cancellation signal keeps priority)
 *   - otbSold > 0 → green (nights with bookings light up)
 *   - else       → weekend zebra
 * newBk still drives the DoW `+N` counter but no longer split-paints the row.
 */
function rowCellBg(colIdx: number, otbSold: number, cxl: number, weekendZebra: string): string | undefined {
  if (cxl > 0)     return ROW_RED;
  if (otbSold > 0) return ROW_GREEN;
  return weekendZebra;
}

export default async function PickupDayReport({ propertyId }: Props = {}) {
  const pid = propertyId ?? PROPERTY_ID;
  const { pace, pickupMap, promoMap, demandMap, snapshotDate } = await fetchData(pid);
  // Currency symbol per property (Namkhan=USD, Donna=EUR).
  const sym = pid === 1000001 ? '€' : '$';

  // Visibility columns → promo lookup keys, in table order.
  const VIS = [
    { key: 'expedia::mob_book_expedia', label: 'Mob B&E' },
    { key: 'expedia::exp_accel',        label: 'EXP Accel' },
    { key: 'booking.com::genius',       label: 'Genius' },
    { key: 'booking.com::mobile_rate',  label: 'Mobile' },
    { key: 'expedia::p_plus_bar',       label: 'P+ BAR' },
  ] as const;

  /** Vis cell rendering — respects row-level signal (row bg wins). */
  const visCellStyle = (i: number, rowBg: string | undefined): React.CSSProperties => {
    const p = promoMap.get(VIS[i].key);
    // If row signals pickup or cxl activity, row bg wins.
    if (rowBg === ROW_GREEN || rowBg === ROW_RED) {
      return { ...td, background: rowBg, textAlign: 'center', fontWeight: 700, color: '#1B1B1B' };
    }
    if (!p) return { ...td, ...tdMuted, background: rowBg };
    return { ...td, background: p.active ? ROW_GREEN : ROW_RED, color: p.active ? '#1F5C2C' : '#B04A2F', textAlign: 'center', fontWeight: 700 };
  };
  const visText = (i: number): string => {
    const p = promoMap.get(VIS[i].key);
    if (!p) return '—';
    return p.active ? (p.costPct != null ? `${p.costPct}%` : '✓') : '×';
  };

  // Group rows by year+month for monthly totals
  const byMonth = new Map<string, PaceRow[]>();
  for (const r of pace) {
    const key = `${r.year}-${String(r.month).padStart(2,'0')}`;
    const arr = byMonth.get(key) ?? [];
    arr.push(r);
    byMonth.set(key, arr);
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const pidLabel = pid === 1000001 ? 'Donna Portals' : 'Namkhan';

  // Revenue sub-strip tabs (Overview | Demand & Pace | Performance | Market & Control | Reports)
  // The Pickup Month/Day sub-strip renders below via findSubGroup(pathname) in DashboardPage.
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, pid);
  const tabs: DashboardTab[] = subPages.map((s) => ({
    key: s.href,
    label: s.label,
    href: s.href,
    active: s.href.endsWith('/pickup') || s.href.endsWith('/demand'),
  }));

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <DashboardPage
        title="Pickup · Day report"
        subtitle="One row per night · real −1d and −7d pickup from booking_date · monthly totals integrated"
        tabs={tabs}
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <a href={`/api/pickup-day/csv?property_id=${pid}`} title="Download CSV" aria-label="Download CSV" style={iconBtn}>
              <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>⬇</span>
            </a>
            <Link href="/revenue/pickup-day/email" title="Email / schedule report" aria-label="Email report" style={iconBtn}>
              <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>✉</span>
            </Link>
          </div>
        }
      >
        <div style={{ gridColumn: '1 / -1' }}>
          <Container
            title="Forward outlook by night"
            subtitle={`${pace.length} nights from today · monthly totals inline · Demand · Lighthouse (snapshot ${snapshotDate ?? 'pending'})`}
          >
            <div style={{ overflowX: 'auto', border: '1px solid #E6DFCC', borderRadius: 6 }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 10, whiteSpace: 'nowrap', width: '100%' }}>
                <thead>
                  {/* Header row 1: group labels */}
                  <tr style={{ background: '#F8F5EA' }}>
                    <th style={th} colSpan={2}>Date</th>
                    <th style={th}>Events</th>
                    <th style={th} colSpan={6}>Availability</th>
                    <th style={th} colSpan={2}>Min stay</th>
                    <th style={th} colSpan={4}>Stop sales</th>
                    <th style={th} colSpan={5}>Visibility</th>
                    <th style={th} colSpan={2}>Rate ladder (BAR + NET)</th>
                    <th style={th} colSpan={4}>Fenced rates</th>
                    <th style={th} colSpan={3}>Discounts</th>
                    <th style={th} colSpan={2}>OTB</th>
                    <th style={th} colSpan={3}>Pickup −1d</th>
                    <th style={th} colSpan={3}>Pickup −7d</th>
                  </tr>
                  {/* Header row 2: leaf labels */}
                  <tr style={{ background: '#FFFFFF' }}>
                    <th style={th}>DoW</th>
                    <th style={th}>Date</th>
                    <th style={th}></th>
                    <th style={th}>Demand</th>
                    <th style={th}>OCC</th>
                    <th style={th}>OTB</th>
                    <th style={th}>OoO</th>
                    <th style={th}>House</th>
                    <th style={th}>Avail</th>
                    <th style={th}>WEB</th>
                    <th style={th}>OTAs</th>
                    <th style={th}>WEB</th>
                    <th style={th}>OTAs</th>
                    <th style={th}>B2B</th>
                    <th style={th}>FIT</th>
                    <th style={th}>Mob B&E</th>
                    <th style={th}>EXP Accel</th>
                    <th style={th}>Genius</th>
                    <th style={th}>Mobile</th>
                    <th style={th}>P+ BAR</th>
                    <th style={th}>BAR</th>
                    <th style={th}>Net rate</th>
                    <th style={th}>NRF</th>
                    <th style={th}>EB 30d</th>
                    <th style={th}>LOS3</th>
                    <th style={th}>LOS4</th>
                    <th style={th}>15%</th>
                    <th style={th}>20%</th>
                    <th style={th}>25%</th>
                    <th style={th}>ADR</th>
                    <th style={th}>Room rev</th>
                    <th style={th}>RN</th>
                    <th style={th}>Rev</th>
                    <th style={th}>ADR</th>
                    <th style={th}>RN</th>
                    <th style={th}>Rev</th>
                    <th style={th}>ADR</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(byMonth.entries()).flatMap(([monthKey, rows]) => {
                    const totOcc = rows.reduce((s, r) => s + Number(r.otb_rooms_sold), 0);
                    const totRev = rows.reduce((s, r) => s + Number(r.otb_revenue), 0);
                    const totAvail = rows.reduce((s, r) => s + Math.max(0, Number(r.rooms_available) - Number(r.otb_rooms_sold)), 0);
                    const capSum = rows.reduce((s, r) => s + Number(r.rooms_available), 0);
                    const avgOtbPct = capSum > 0 ? (totOcc / capSum) * 100 : 0;
                    const avgAdr = totOcc > 0 ? totRev / totOcc : 0;
                    const p1sum = rows.reduce((s, r) => s + pickup(r, pickupMap.get(r.stay_date), '1d').rn, 0);
                    const p1rev = rows.reduce((s, r) => s + pickup(r, pickupMap.get(r.stay_date), '1d').rev, 0);
                    const p7sum = rows.reduce((s, r) => s + pickup(r, pickupMap.get(r.stay_date), '7d').rn, 0);
                    const p7rev = rows.reduce((s, r) => s + pickup(r, pickupMap.get(r.stay_date), '7d').rev, 0);
                    const [y,m] = monthKey.split('-');
                    const monthLabel = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
                    return [
                      ...rows.map((r) => {
                        const p1 = pickup(r, pickupMap.get(r.stay_date), '1d');
                        const p7 = pickup(r, pickupMap.get(r.stay_date), '7d');
                        const pu = pickupMap.get(r.stay_date);
                        const newBk = Number(pu?.new_bookings_2d_rn ?? 0);
                        const cxl = Number(pu?.cancellations_2d_rn ?? 0);
                        const dow = DOW[(r.iso_dow - 1 + 7) % 7];
                        const isWeekend = r.iso_dow === 6 || r.iso_dow === 7;
                        const weekendZebra = isWeekend ? '#FBF6E8' : '#FFFFFF';
                        const hasSignal = newBk > 0 || cxl > 0;
                        // Per-cell bg helper — bakes row colour into every td so it wins over
                        // per-cell defaults (visCells, tdMuted). Split case = green LEFT, red RIGHT.
                        const cellBg = (i: number) => rowCellBg(i, Number(r.otb_rooms_sold), cxl, weekendZebra);
                        const cellStyle = (i: number, extra?: React.CSSProperties): React.CSSProperties => ({
                          ...td, background: cellBg(i), ...(extra ?? {}),
                        });
                        const mutedStyle = (i: number): React.CSSProperties => ({
                          ...td, ...tdMuted, background: cellBg(i),
                        });
                        return (
                          <tr key={r.stay_date}>
                            <td style={cellStyle(0, { fontWeight: 700, textAlign: 'center', color: hasSignal ? '#1B1B1B' : undefined })}>
                              {dow}
                              {newBk > 0 && <span title={`${newBk} room-nights picked up today/yesterday`} style={{ marginLeft: 4, color: '#1F5C2C', fontWeight: 800 }}>+{newBk}</span>}
                              {cxl > 0 && <span title={`${cxl} room-nights cancelled today/yesterday`} style={{ marginLeft: 4, color: '#B04A2F', fontWeight: 800 }}>−{cxl}</span>}
                            </td>
                            <td style={cellStyle(1)}>{fmtDate(r.stay_date)}</td>
                            <td style={cellStyle(2)}></td>
                            {(() => {
                              const dv = demandMap.get(r.stay_date);
                              return dv !== undefined
                                ? <td style={cellStyle(3, { fontWeight: 600 })} title="Lighthouse market_demand (Booking.com search demand)">{fmtPct(dv * 100)}</td>
                                : <td style={mutedStyle(3)}>—</td>;
                            })()}
                            <td style={cellStyle(4, { fontWeight: 600 })}>{fmtPct(r.otb_occupancy_pct)}</td>
                            <td style={cellStyle(5)}>{fmtInt(r.otb_rooms_sold)}</td>
                            <td style={cellStyle(6)}>0</td>
                            <td style={mutedStyle(7)}>—</td>
                            <td style={cellStyle(8)}>{fmtInt(Math.max(0, r.rooms_available - r.otb_rooms_sold))}</td>
                            <td style={mutedStyle(9)}>—</td>
                            <td style={mutedStyle(10)}>—</td>
                            <td style={mutedStyle(11)}>—</td>
                            <td style={mutedStyle(12)}>—</td>
                            <td style={mutedStyle(13)}>—</td>
                            <td style={mutedStyle(14)}>—</td>
                            <td style={visCellStyle(0, cellBg(15))}>{visText(0)}</td>
                            <td style={visCellStyle(1, cellBg(16))}>{visText(1)}</td>
                            <td style={visCellStyle(2, cellBg(17))}>{visText(2)}</td>
                            <td style={visCellStyle(3, cellBg(18))}>{visText(3)}</td>
                            <td style={visCellStyle(4, cellBg(19))}>{visText(4)}</td>
                            <td style={mutedStyle(20)}>—</td>
                            <td style={mutedStyle(21)}>—</td>
                            <td style={mutedStyle(22)}>—</td>
                            <td style={mutedStyle(23)}>—</td>
                            <td style={mutedStyle(24)}>—</td>
                            <td style={mutedStyle(25)}>—</td>
                            <td style={mutedStyle(26)}>—</td>
                            <td style={mutedStyle(27)}>—</td>
                            <td style={mutedStyle(28)}>—</td>
                            <td style={cellStyle(29)}>{fmtMoney(r.otb_adr, sym)}</td>
                            <td style={cellStyle(30)}>{fmtMoney(r.otb_revenue, sym)}</td>
                            <td style={cellStyle(31, p1.rn === 0 ? tdMuted : undefined)}>{p1.rn === 0 ? '0' : fmtInt(p1.rn)}</td>
                            <td style={cellStyle(32, p1.rev === 0 ? tdMuted : undefined)}>{p1.rev === 0 ? `0 ${sym}` : fmtMoney(p1.rev, sym)}</td>
                            <td style={cellStyle(33, p1.rn === 0 ? tdMuted : undefined)}>{p1.rn === 0 ? `0 ${sym}` : fmtMoney(p1.adr, sym)}</td>
                            <td style={cellStyle(34, p7.rn === 0 ? tdMuted : undefined)}>{p7.rn === 0 ? '0' : fmtInt(p7.rn)}</td>
                            <td style={cellStyle(35, p7.rev === 0 ? tdMuted : undefined)}>{p7.rev === 0 ? `0 ${sym}` : fmtMoney(p7.rev, sym)}</td>
                            <td style={cellStyle(36, p7.rn === 0 ? tdMuted : undefined)}>{p7.rn === 0 ? `0 ${sym}` : fmtMoney(p7.adr, sym)}</td>
                          </tr>
                        );
                      }),
                      // Monthly TOTAL row — inline in the SAME table (not a separate table below).
                      // Bold, borderTop 2px, fontSize 11 per PBS spec 2026-07-07.
                      // Row must emit EXACTLY 37 effective columns (matches thead leaf-row).
                      // Layout audit 2026-07-07:
                      //   col0..1 (colSpan=2): DoW+Date  → "{monthLabel} TOTAL"
                      //   col2 Events (blank) · col3 City% (—) · col4 OTB% · col5 OCC · col6 OOO (0)
                      //   col7 House uses (—) · col8 Available
                      //   col9..28 (colSpan=20): Min stay + Stop sales + Visibility + Rate ladder + Fenced + Discounts (no sums)
                      //   col29 OTB ADR · col30 Room rev · col31 P1 RN · col32 P1 Rev · col33 P1 ADR
                      //   col34 P7 RN · col35 P7 Rev · col36 P7 ADR
                      //   Totals: 2+1+1+1+1+1+1+1+1 + 20 + 2 + 3 + 3 = 37 ✓
                      <tr key={`total-${monthKey}`} style={{ background: '#F8F5EA' }}>
                        <td style={{ ...totalTd, borderTop: '2px solid #0B3B2E', textAlign: 'left' }} colSpan={2}>{monthLabel} TOTAL</td>
                        <td style={{ ...totalTd, borderTop: '2px solid #0B3B2E' }}></td>
                        <td style={{ ...totalTd, ...tdMuted, borderTop: '2px solid #0B3B2E' }}>—</td>
                        <td style={{ ...totalTd, borderTop: '2px solid #0B3B2E' }}>{fmtPct(avgOtbPct)}</td>
                        <td style={{ ...totalTd, borderTop: '2px solid #0B3B2E' }}>{fmtInt(totOcc)}</td>
                        <td style={{ ...totalTd, borderTop: '2px solid #0B3B2E' }}>0</td>
                        <td style={{ ...totalTd, ...tdMuted, borderTop: '2px solid #0B3B2E' }}>—</td>
                        <td style={{ ...totalTd, borderTop: '2px solid #0B3B2E' }}>{fmtInt(totAvail)}</td>
                        <td style={{ ...totalTd, borderTop: '2px solid #0B3B2E' }} colSpan={20}></td>
                        <td style={{ ...totalTd, borderTop: '2px solid #0B3B2E' }}>{fmtMoney(avgAdr, sym)}</td>
                        <td style={{ ...totalTd, borderTop: '2px solid #0B3B2E' }}>{fmtMoney(totRev, sym)}</td>
                        <td style={{ ...totalTd, borderTop: '2px solid #0B3B2E' }}>{fmtInt(p1sum)}</td>
                        <td style={{ ...totalTd, borderTop: '2px solid #0B3B2E' }}>{fmtMoney(p1rev, sym)}</td>
                        <td style={{ ...totalTd, borderTop: '2px solid #0B3B2E' }}>{fmtMoney(p1sum > 0 ? p1rev / p1sum : 0, sym)}</td>
                        <td style={{ ...totalTd, borderTop: '2px solid #0B3B2E' }}>{fmtInt(p7sum)}</td>
                        <td style={{ ...totalTd, borderTop: '2px solid #0B3B2E' }}>{fmtMoney(p7rev, sym)}</td>
                        <td style={{ ...totalTd, borderTop: '2px solid #0B3B2E' }}>{fmtMoney(p7sum > 0 ? p7rev / p7sum : 0, sym)}</td>
                      </tr>,
                    ];
                  })}
                </tbody>
              </table>
            </div>
          </Container>
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <Container title="What's wired · what's placeholder" subtitle="Honest data-source map for this report">
            <div style={{ padding: 14, fontSize: 12, lineHeight: 1.5, color: '#3A3A3A' }}>
              <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Wired now (real data):</p>
              <ul style={{ margin: '0 0 12px 20px' }}>
                <li>Date · DoW · OTB % · OCC (rooms sold) · Available · ADR · Room Rev — <code>kpi.v_pace_otb_daily</code></li>
                <li><strong>Pickup −1d and −7d · RN + Rev + ADR</strong> — real, derived from <code>public.v_pickup_day_report</code> (new gold view; groups reservations by <code>booking_date</code> checkpoints).</li>
                <li>Monthly totals (weighted OTB %, sum OCC, avg ADR, sum Rev, sum -1d/-7d pickup) — inline in the same table as bold rows.</li>
                <li>Row colouring — green for pickup, red for cancellations, split (green left / red right) when both occurred today or yesterday.</li>
                <li>Download CSV (top-right)</li>
              </ul>
              <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Placeholder (—) until data lands:</p>
              <ul style={{ margin: '0 0 12px 20px' }}>
                <li><strong>Demand</strong> · external comp-set benchmark — need STR / Amadeus / Lighthouse market_demand feed</li>
                <li><strong>House uses · OOO</strong> — Cloudbeds getReservations with is_house_use / status=OOO filter (not currently in sync)</li>
                <li><strong>Min stay (WEB · OTA)</strong> and <strong>Stop sales (WEB · OTA · B2B · FIT)</strong> — Cloudbeds <code>getRateAvailability</code> endpoint</li>
                <li><strong>Visibility flags (Mob B&E · EXP Accel · Genius · Mobile · P+ BAR)</strong> — awaiting Booking.com / Expedia activation landing pages</li>
                <li><strong>Rate ladder (BAR · Net rate · NRF · EB 30d · LOS3 · LOS4)</strong> — same Cloudbeds availability sync (per rate plan per date)</li>
                <li><strong>Discount tiers (15% · 20% · 25%)</strong> — derived once rate ladder is wired</li>
                <li><strong>Events</strong> — free-text column, would need an events table (e.g. <code>calendar.events</code>) with property_id + date</li>
              </ul>
            </div>
          </Container>
        </div>
      </DashboardPage>
    </div>
  );
}

// Canonical design_system typography (matches Container / DataTable / Lighthouse tables):
// paper-white background · muted grey ink · hairline dividers · uppercase 10px with letter-spacing.
const th: React.CSSProperties = {
  padding: '8px 8px', textAlign: 'center',
  fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4,
  color: '#5A5A5A', background: '#FFFFFF',
  borderRight: '1px solid #E6DFCC', borderBottom: '1px solid #E6DFCC', whiteSpace: 'nowrap',
};
const td: React.CSSProperties = {
  padding: '5px 8px', textAlign: 'right',
  fontSize: 11, color: '#1B1B1B',
  borderRight: '1px solid #F0EBD8', borderBottom: '1px solid #F0EBD8',
  fontVariantNumeric: 'tabular-nums',
};
const totalTd: React.CSSProperties = {
  padding: '6px 8px', textAlign: 'right',
  fontSize: 11, fontWeight: 800, color: '#0B3B2E',
  borderRight: '1px solid #E6DFCC', borderTop: '2px solid #0B3B2E', borderBottom: '2px solid #0B3B2E',
  background: '#F8F5EA',
  fontVariantNumeric: 'tabular-nums',
};
const tdMuted: React.CSSProperties = { color: '#B5AF9A', textAlign: 'center' };
const iconBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 34, height: 30, borderRadius: 4,
  background: '#084838', color: '#FFFFFF',
  border: '1px solid #084838', textDecoration: 'none',
};
