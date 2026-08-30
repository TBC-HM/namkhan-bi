// app/operations/spa/_cockpit/data.ts
// PBS 2026-08-30 · Reads for the Spa manager cockpit.
//
// Same shape as the F&B cockpit's data module, and the same two hard-won rules:
//
//  1. EVERY aggregate pages through pullAll(). PostgREST caps responses at 1000
//     rows server-side and silently ignores .limit(20000), so a bare .limit()
//     on an aggregate returns the first 1000 rows and a wrong total with no
//     error. That is what made F&B's YTD read $10,343 against a real $73,959.
//  2. Spa is a SUBDEPT, not a dept. USALI has no Spa department — it is
//     'Other Operated' / 'Spa'. Filtering on usali_dept='Spa' returns nothing.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const SPA_SUBDEPT = 'Spa';

async function safe<T>(p: PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  try { const r = await p; return (r.data ?? []) as T[]; } catch { return []; }
}

const PAGE_ROWS = 1000;
async function pullAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
  cap = 200000,
): Promise<T[]> {
  const out: T[] = [];
  for (let off = 0; off < cap; off += PAGE_ROWS) {
    const page = await safe<T>(build(off, off + PAGE_ROWS - 1));
    out.push(...page);
    if (page.length < PAGE_ROWS) break;
  }
  return out;
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export type SpaPeriodKey = 'today' | 'yesterday' | 'last7' | 'last30' | 'ytd';

export const SPA_PERIOD_COLS: { key: SpaPeriodKey; label: string; sub: string }[] = [
  { key: 'today',     label: 'Today',     sub: 'so far' },
  { key: 'yesterday', label: 'Yesterday', sub: 'closed' },
  { key: 'last7',     label: 'Last 7d',   sub: 'rolling' },
  { key: 'last30',    label: 'Last 30d',  sub: 'rolling' },
  { key: 'ytd',       label: 'YTD',       sub: 'year to date' },
];

const shiftYear = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  const last = new Date(Date.UTC(y - 1, m, 0)).getUTCDate();
  return `${y - 1}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
};

function windowsFor(todayIso: string): Record<SpaPeriodKey, [string, string]> {
  return {
    today:     [todayIso, todayIso],
    yesterday: [addDays(todayIso, -1), addDays(todayIso, -1)],
    last7:     [addDays(todayIso, -6), todayIso],
    last30:    [addDays(todayIso, -29), todayIso],
    ytd:       [`${todayIso.slice(0, 4)}-01-01`, todayIso],
  };
}

// ─── KPI matrix ────────────────────────────────────────────────────────────

export interface SpaStats {
  revenue: number; treatments: number; guests: number; avgTicket: number | null;
}
export interface SpaKpiCell { ty: SpaStats; ly: SpaStats }

function statsFrom(rows: { amount: number | string | null; reservation_id: string | number | null }[]): SpaStats {
  let revenue = 0;
  const folios = new Set<string>();
  for (const r of rows) {
    revenue += Number(r.amount ?? 0);
    if (r.reservation_id != null) folios.add(String(r.reservation_id));
  }
  return {
    revenue: Math.round(revenue),
    treatments: rows.length,
    guests: folios.size,
    avgTicket: rows.length > 0 ? revenue / rows.length : null,
  };
}

export async function getSpaKpiMatrix(
  pid: number, todayIso: string,
): Promise<Record<SpaPeriodKey, SpaKpiCell>> {
  const sb = getSupabaseAdmin();
  const pull = (from: string, to: string) => pullAll<{
    amount: number | string | null; reservation_id: string | number | null;
  }>((_f, _t) =>
    sb.from('v_fnb_raw_txn_enriched')
      .select('amount, reservation_id')
      .eq('property_id', pid).eq('transaction_type', 'debit').eq('usali_subdept', SPA_SUBDEPT)
      .gte('transaction_date', from).lte('transaction_date', `${to}T23:59:59`)
      .range(_f, _t),
  );

  const w = windowsFor(todayIso);
  const keys = Object.keys(w) as SpaPeriodKey[];
  const results = await Promise.all(keys.flatMap((k) => {
    const [f, t] = w[k];
    return [pull(f, t), pull(shiftYear(f), shiftYear(t))];
  }));

  const out = {} as Record<SpaPeriodKey, SpaKpiCell>;
  keys.forEach((k, i) => {
    out[k] = { ty: statsFrom(results[i * 2] ?? []), ly: statsFrom(results[i * 2 + 1] ?? []) };
  });
  return out;
}

// ─── Capture trend ─────────────────────────────────────────────────────────

export interface SpaCaptureMonth {
  month: string; occ: number; revenue: number;
  por: number | null; capturePct: number | null;
  lyPor: number | null; lyCapturePct: number | null; lyRevenue: number | null;
}

/**
 * Spa revenue per occupied room, and the share of rooms that bought anything.
 *
 * This is the whole spa story and it is not visible from revenue alone. Capture
 * ran 45-59% through late 2025 and fell to 12.6% in July 2026; per occupied room
 * that is $25.53 down to $3.84. Against F&B's 77-95% capture on the same guests,
 * the gap is the opportunity — a point of spa capture on 235 occupied rooms is
 * roughly two more treatments a month.
 *
 * Same bridge as the F&B cockpit (v_ancillary_capture_daily) so both departments
 * are measured the same way rather than by two invented definitions.
 */
export async function getSpaCaptureTrend(pid: number, months = 13): Promise<SpaCaptureMonth[]> {
  const sb = getSupabaseAdmin();
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months + 12) + 1, 1));
  const rows = await pullAll<{
    night_date: string | null; occupied_rooms: number | string | null;
    spa_revenue: number | string | null; spa_capturing_rooms: number | string | null;
  }>((_f, _t) =>
    sb.from('v_ancillary_capture_daily')
      .select('night_date, occupied_rooms, spa_revenue, spa_capturing_rooms')
      .eq('property_id', pid)
      .gte('night_date', from.toISOString().slice(0, 10))
      .range(_f, _t),
  );

  const by = new Map<string, { occ: number; rev: number; cap: number }>();
  for (const r of rows) {
    const m = String(r.night_date ?? '').slice(0, 7);
    if (!m) continue;
    const e = by.get(m) ?? { occ: 0, rev: 0, cap: 0 };
    e.occ += Number(r.occupied_rooms ?? 0);
    e.rev += Number(r.spa_revenue ?? 0);
    e.cap += Number(r.spa_capturing_rooms ?? 0);
    by.set(m, e);
  }
  const shift = (m: string) => {
    const [y, mo] = m.split('-').map(Number);
    return `${y - 1}-${String(mo).padStart(2, '0')}`;
  };
  const ratio = (n: number, d: number) => (d > 0 ? n / d : null);

  return [...by.keys()].sort().slice(-months).map((month) => {
    const t = by.get(month)!;
    const l = by.get(shift(month));
    return {
      month, occ: t.occ, revenue: Math.round(t.rev),
      por: ratio(t.rev, t.occ), capturePct: ratio(t.cap * 100, t.occ),
      lyRevenue: l ? Math.round(l.rev) : null,
      lyPor: l ? ratio(l.rev, l.occ) : null,
      lyCapturePct: l ? ratio(l.cap * 100, l.occ) : null,
    };
  });
}

// ─── The diary gap ─────────────────────────────────────────────────────────

export interface DiaryMonth {
  month: string; charged: number; revenue: number; booked: number; postedToFolio: number;
}
export interface DiaryGap {
  months: DiaryMonth[];
  totalCharged: number; totalBooked: number; totalPosted: number;
  lastBooking: string | null; monthsTrading: number;
}

/**
 * Treatments actually charged, against treatments recorded in the diary.
 *
 * THIS IS ON THE FACE OF THE PAGE ON PURPOSE. spa.treatment_bookings holds ten
 * rows, all from August 2026, and NONE of them posted to a folio — while the
 * folio shows twelve unbroken months of spa trade. The booking module and the
 * real spa are two separate universes.
 *
 * It matters because it silently invalidates other things: the Schedule tab is
 * not the diary, no therapist or room utilisation can be computed, and anyone
 * reading "10 bookings" as the workload is out by a factor of thirty. A manager
 * has to know that before they read anything else here, so it is not a footnote.
 */
export async function getSpaDiaryGap(pid: number, fromMonth: string): Promise<DiaryGap> {
  const sb = getSupabaseAdmin();
  const [folio, bookings] = await Promise.all([
    pullAll<{ transaction_date: string | null; amount: number | string | null }>((_f, _t) =>
      sb.from('v_fnb_raw_txn_enriched')
        .select('transaction_date, amount')
        .eq('property_id', pid).eq('transaction_type', 'debit').eq('usali_subdept', SPA_SUBDEPT)
        .gte('transaction_date', fromMonth).range(_f, _t),
    ),
    pullAll<{ scheduled_at: string | null; posted_to_folio: boolean | null; status: string | null }>((_f, _t) =>
      sb.from('v_spa_treatment_bookings')
        .select('scheduled_at, posted_to_folio, status')
        .eq('property_id', pid).range(_f, _t),
    ),
  ]);

  const by = new Map<string, DiaryMonth>();
  const touch = (m: string) =>
    by.get(m) ?? { month: m, charged: 0, revenue: 0, booked: 0, postedToFolio: 0 };

  for (const r of folio) {
    const m = String(r.transaction_date ?? '').slice(0, 7);
    if (!m) continue;
    const e = touch(m);
    e.charged += 1; e.revenue += Number(r.amount ?? 0);
    by.set(m, e);
  }
  let lastBooking: string | null = null;
  for (const b of bookings) {
    const at = String(b.scheduled_at ?? '');
    const m = at.slice(0, 7);
    if (at && (!lastBooking || at > lastBooking)) lastBooking = at;
    if (!m) continue;
    const e = touch(m);
    e.booked += 1;
    if (b.posted_to_folio) e.postedToFolio += 1;
    by.set(m, e);
  }

  const months = [...by.values()]
    .map((m) => ({ ...m, revenue: Math.round(m.revenue) }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    months,
    totalCharged: months.reduce((s, m) => s + m.charged, 0),
    totalBooked: months.reduce((s, m) => s + m.booked, 0),
    totalPosted: months.reduce((s, m) => s + m.postedToFolio, 0),
    lastBooking: lastBooking ? lastBooking.slice(0, 10) : null,
    monthsTrading: months.filter((m) => m.charged > 0).length,
  };
}

// ─── Treatment menu · achieved price against the card ──────────────────────

export interface SpaTreatment {
  name: string; sold: number; revenue: number; achieved: number;
  listPrice: number | null; lastSold: string | null;
}

/**
 * What sells, at what price, and whether the card agrees.
 *
 * Two things this surfaces that no spa report here has shown:
 *
 *  - ACHIEVED vs LIST. Lao Oil 90 min is carded at $50 and achieves $61.29;
 *    Lao Traditional 90 min is carded at $45 and achieves $58.01. Either the
 *    card is stale or the folio price carries tax and service the card does not.
 *    Either way the printed menu and the till disagree by 9-29%.
 *  - The bookable set is deliberately NOT read here. The booking module reads
 *    spa.treatments, and `spa` is not one of the 24 schemas PostgREST exposes,
 *    so there is no honest way to query it from the page. It needs a
 *    public.v_spa_treatments_bookable bridge — proposed to PBS, not invented
 *    here. (Checked directly: the property card holds eight treatments and
 *    spa.treatments holds four, and the Namkhan Signature Ritual — the
 *    third-biggest seller — is missing from the bookable four.)
 *
 * Matching is by normalised name, so it is a guide, not an audit: the POS free-
 * texts its descriptions ("Aroma of Laos", "Aroma of Laos (M) (60 min)" and
 * "Aroma of Laos (M) (90 min)" are all the same treatment), which is the same
 * vocabulary problem the F&B menu has. Unmatched rows show a dash rather than a
 * guess.
 */
export async function getSpaTreatments(
  pid: number, fromIso: string, toIso: string,
): Promise<SpaTreatment[]> {
  const sb = getSupabaseAdmin();
  const [sold, card] = await Promise.all([
    pullAll<{ description: string | null; amount: number | string | null; transaction_date: string | null }>((_f, _t) =>
      sb.from('v_fnb_raw_txn_enriched')
        .select('description, amount, transaction_date')
        .eq('property_id', pid).eq('transaction_type', 'debit').eq('usali_subdept', SPA_SUBDEPT)
        .gte('transaction_date', fromIso).lte('transaction_date', `${toIso}T23:59:59`)
        .range(_f, _t),
    ),
    safe<{ name: string | null; price_usd: number | string | null; duration_min: number | null }>(
      sb.from('v_property_spa_treatments')
        .select('name, price_usd, duration_min').eq('property_id', pid).eq('is_active', true),
    ),
  ]);

  // "Aroma of Laos (M) (90 min)" and "Aroma of Laos — 90 min" must meet.
  const norm = (s: string) =>
    s.toLowerCase()
      .replace(/\(m\)|\(f\)/g, ' ')
      .replace(/[—–-]/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\bmin(ute)?s?\b/g, 'min')
      .trim();

  const cardBy = new Map<string, number>();
  for (const c of card) {
    const n = (c.name ?? '').trim();
    if (!n) continue;
    const price = Number(c.price_usd ?? 0);
    if (price > 0) cardBy.set(norm(n), price);
  }

  const agg = new Map<string, { sold: number; rev: number; last: string }>();
  for (const r of sold) {
    const name = (r.description ?? '').trim();
    if (!name) continue;
    const e = agg.get(name) ?? { sold: 0, rev: 0, last: '' };
    e.sold += 1; e.rev += Number(r.amount ?? 0);
    const d = String(r.transaction_date ?? '').slice(0, 10);
    if (d > e.last) e.last = d;
    agg.set(name, e);
  }

  // A folio description matches a card entry when either name contains the
  // other once normalised — the POS adds a size suffix, the card adds a dash.
  const lookup = (name: string): number | null => {
    const n = norm(name);
    const exact = cardBy.get(n);
    if (exact != null) return exact;
    for (const [k, v] of cardBy) {
      if (n.includes(k) || k.includes(n)) return v;
    }
    return null;
  };

  return [...agg.entries()]
    .map(([name, v]) => {
      return {
        name,
        sold: v.sold,
        revenue: Math.round(v.rev),
        achieved: v.sold > 0 ? v.rev / v.sold : 0,
        listPrice: lookup(name),
        lastSold: v.last || null,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

// ─── Capacity ──────────────────────────────────────────────────────────────

export interface SpaCapacity { rooms: number; therapists: number; cardTreatments: number }

export async function getSpaCapacity(pid: number): Promise<SpaCapacity> {
  const sb = getSupabaseAdmin();
  const [rooms, therapists, card] = await Promise.all([
    safe<{ room_id: number }>(sb.from('v_spa_rooms').select('room_id').eq('property_id', pid).eq('is_active', true)),
    safe<{ therapist_id: string }>(sb.from('v_spa_therapists').select('therapist_id').eq('property_id', pid).eq('is_active', true)),
    safe<{ treatment_id: string }>(sb.from('v_property_spa_treatments').select('treatment_id').eq('property_id', pid).eq('is_active', true)),
  ]);
  return { rooms: rooms.length, therapists: therapists.length, cardTreatments: card.length };
}
