// lib/data/pickup.ts
// Server-side helper. Builds the PickupMatrixData shape for a given property
// using the public SQL function fn_pickup_otb_at(prop, asof) — returns RN+REV
// per stay month, point-in-time, filtered by booking_date <= asof. Five RPC
// calls per page render: today / yesterday / last-monday / month-start / sdly.
// The "2025 RO" baseline column still uses v_pickup_monthly (full-year actual).

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import type {
  PickupMatrixData, PickupMatrixRow, PickupMetric, PickupMatrixMonth, PickupDelta,
} from '@/app/(cockpit)/_design/PickupMatrix';

const NAMKHAN_ID = 260955;
const DONNA_ID   = 1000001;

const CAPACITY: Record<number, number> = {
  [NAMKHAN_ID]: 24,
  [DONNA_ID]:   64,
};

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

interface MonthAgg { rn: number; rev: number }

function delta(a: number | null, b: number | null): PickupDelta {
  if (a == null || b == null) return { abs: null, pct: null };
  const abs = a - b;
  const pct = b !== 0 ? (abs / Math.abs(b)) * 100 : null;
  return { abs, pct };
}

// Convert one MonthAgg into a metric value (RN/OCC/REV/ADR/RevPAR) using
// the property's capacity for that month.
function valueOf(a: MonthAgg | null, metric: PickupMetric, availRn: number): number | null {
  if (!a) return null;
  if (metric === 'RN')     return a.rn;
  if (metric === 'OCC')    return availRn > 0 ? (a.rn / availRn) * 100 : null;
  if (metric === 'REV')    return a.rev;
  if (metric === 'ADR')    return a.rn > 0 ? a.rev / a.rn : null;
  if (metric === 'RevPAR') return availRn > 0 ? a.rev / availRn : null;
  return null;
}

function sumMonths(buckets: Record<number, MonthAgg>): MonthAgg {
  const total: MonthAgg = { rn: 0, rev: 0 };
  for (const m of Object.values(buckets)) { total.rn += m.rn; total.rev += m.rev; }
  return total;
}

function rowsToBucket(
  rows: Array<{ stay_year: number; stay_month: number; rn: number; rev: number }> | null,
  filterYear: number,
): Record<number, MonthAgg> {
  const out: Record<number, MonthAgg> = {};
  for (const r of rows ?? []) {
    if (r.stay_year !== filterYear) continue;
    out[r.stay_month] = { rn: Number(r.rn ?? 0), rev: Number(r.rev ?? 0) };
  }
  return out;
}

const fmtIso = (d: Date) => d.toISOString().slice(0, 10);
const fmtDmy = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

export async function getPickupMatrix(propertyId: number): Promise<PickupMatrixData> {
  const supabase = getSupabaseAdmin();
  const capacity = CAPACITY[propertyId] ?? 30;
  const property = propertyId === NAMKHAN_ID ? 'The Namkhan' : propertyId === DONNA_ID ? 'Donna Portals' : `Property ${propertyId}`;

  const now = new Date();
  const today = new Date(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yesterday  = new Date(now); yesterday.setDate(now.getDate() - 1);
  const lastMonday = new Date(now);
  const dow = lastMonday.getDay() || 7;
  lastMonday.setDate(lastMonday.getDate() - (dow - 1) - 7);
  const sdly = new Date(now); sdly.setFullYear(sdly.getFullYear() - 1);

  // 5 point-in-time snapshots via the public SQL function.
  // Wrap in Promise.resolve so .catch() works — Supabase .rpc().then() returns PromiseLike, not Promise.
  const callSnapshot = (asof: Date): Promise<Array<{ stay_year: number; stay_month: number; rn: number; rev: number }>> =>
    Promise.resolve(
      supabase
        .rpc('fn_pickup_otb_at', { p_property_id: propertyId, p_asof: fmtIso(asof) })
        .then((r) => (r.data ?? []) as Array<{ stay_year: number; stay_month: number; rn: number; rev: number }>)
    );

  const [snapToday, snapYesterday, snapMonday, snapMonthStart, snapSdly] = await Promise.all([
    callSnapshot(today).catch((e) => { console.error('[pickup] snap today', e); return null; }),
    callSnapshot(yesterday).catch((e) => { console.error('[pickup] snap yesterday', e); return null; }),
    callSnapshot(lastMonday).catch((e) => { console.error('[pickup] snap monday', e); return null; }),
    callSnapshot(monthStart).catch((e) => { console.error('[pickup] snap month-start', e); return null; }),
    callSnapshot(sdly).catch((e) => { console.error('[pickup] snap sdly', e); return null; }),
  ]);

  // Full-year baselines from v_pickup_monthly (point-in-time NOW = final actuals)
  const { data: baseRows } = await supabase
    .from('v_pickup_monthly')
    .select('year,month,rn,rev')
    .eq('property_id', propertyId)
    .gte('year', 2023)
    .lte('year', 2025);

  const baseline: Record<number, Record<number, MonthAgg>> = { 2023: {}, 2024: {}, 2025: {} };
  for (const r of (baseRows ?? []) as Array<{ year: number; month: number; rn: number; rev: number }>) {
    if (!baseline[r.year]) continue;
    baseline[r.year][r.month] = { rn: Number(r.rn ?? 0), rev: Number(r.rev ?? 0) };
  }

  // Filter each snapshot to 2026 (the stay year we're rendering)
  const otbToday2026     = rowsToBucket(snapToday,     2026);
  const otbYesterday2026 = rowsToBucket(snapYesterday, 2026);
  const otbMonday2026    = rowsToBucket(snapMonday,    2026);
  const otbMonthStart2026= rowsToBucket(snapMonthStart,2026);
  // SDLY = same-day-last-year snapshot, filtered to 2025 stays (= 1y back from 2026)
  const otbSdly2025      = rowsToBucket(snapSdly,      2025);

  const METRICS: PickupMetric[] = ['RN', 'OCC', 'REV', 'ADR', 'RevPAR'];

  function buildRow(metric: PickupMetric, mo: number, availRn: number): PickupMatrixRow {
    const otbAll       = valueOf(otbToday2026[mo]     ?? null, metric, availRn);
    const otbMonthly   = valueOf(otbMonthStart2026[mo]?? null, metric, availRn);
    const otbMonday    = valueOf(otbMonday2026[mo]    ?? null, metric, availRn);
    const otbYesterday = valueOf(otbYesterday2026[mo] ?? null, metric, availRn);
    const otbToday     = otbAll;

    const base2023 = valueOf(baseline[2023][mo] ?? null, metric, availRn);
    const base2024 = valueOf(baseline[2024][mo] ?? null, metric, availRn);
    const base2025 = valueOf(baseline[2025][mo] ?? null, metric, availRn); // full-year 2025 actual = 2025 RO
    // SDLY: same-day-last-year snapshot for the matching 2025 stay month
    const sdlyValue = valueOf(otbSdly2025[mo] ?? null, metric, availRn);

    return {
      metric,
      baseline2023: base2023,
      baseline2024: base2024,
      baseline2025: base2025,
      budget2026:   null,
      otbAll,
      otbMonthly,
      otbMonday,
      otbYesterday,
      otbToday,
      // Pickup = current - earlier snapshot
      pickupMonthly:   (otbToday != null && otbMonthly   != null) ? delta(otbToday, otbMonthly)   : { abs: null, pct: null },
      pickupWeekly:    (otbToday != null && otbMonday    != null) ? delta(otbToday, otbMonday)    : { abs: null, pct: null },
      pickupYesterday: (otbToday != null && otbYesterday != null) ? delta(otbToday, otbYesterday) : { abs: null, pct: null },
      vsBudget: { abs: null, pct: null },
      vsLy: (otbToday != null && base2025 != null) ? delta(otbToday, base2025) : { abs: null, pct: null },
      sdly:     sdlyValue,
      sdlyDiff: (otbToday != null && sdlyValue != null) ? otbToday - sdlyValue : null,
    };
  }

  const months: PickupMatrixMonth[] = [];
  for (let mo = 1; mo <= 12; mo++) {
    const availRn = capacity * daysInMonth(2026, mo);
    months.push({
      monthKey:   `2026-${String(mo).padStart(2, '0')}`,
      monthLabel: `01/${String(mo).padStart(2, '0')}/2026`,
      rows: METRICS.map((m) => buildRow(m, mo, availRn)),
    });
  }

  // Yearly totals — sum bucket RN+REV across all months, then derive each metric
  const sumBuckets = (buckets: Record<number, MonthAgg>): MonthAgg => sumMonths(buckets);
  const totals = {
    today:     sumBuckets(otbToday2026),
    yest:      sumBuckets(otbYesterday2026),
    monday:    sumBuckets(otbMonday2026),
    monthStart:sumBuckets(otbMonthStart2026),
    sdly:      sumBuckets(otbSdly2025),
    b2023:     sumBuckets(baseline[2023]),
    b2024:     sumBuckets(baseline[2024]),
    b2025:     sumBuckets(baseline[2025]),
  };
  const totalAvail = capacity * 365;
  function totalRow(metric: PickupMetric): PickupMatrixRow {
    const todayV = valueOf(Object.keys(otbToday2026).length ? totals.today : null, metric, totalAvail);
    const yestV  = valueOf(Object.keys(otbYesterday2026).length ? totals.yest : null, metric, totalAvail);
    const monV   = valueOf(Object.keys(otbMonday2026).length ? totals.monday : null, metric, totalAvail);
    const msV    = valueOf(Object.keys(otbMonthStart2026).length ? totals.monthStart : null, metric, totalAvail);
    const sdlyV  = valueOf(Object.keys(otbSdly2025).length ? totals.sdly : null, metric, totalAvail);
    const b2025  = valueOf(Object.keys(baseline[2025]).length ? totals.b2025 : null, metric, totalAvail);
    return {
      metric,
      baseline2023: valueOf(Object.keys(baseline[2023]).length ? totals.b2023 : null, metric, totalAvail),
      baseline2024: valueOf(Object.keys(baseline[2024]).length ? totals.b2024 : null, metric, totalAvail),
      baseline2025: b2025,
      budget2026: null,
      otbAll: todayV,
      otbMonthly: msV,
      otbMonday: monV,
      otbYesterday: yestV,
      otbToday: todayV,
      pickupMonthly:   (todayV != null && msV  != null) ? delta(todayV, msV)  : { abs: null, pct: null },
      pickupWeekly:    (todayV != null && monV != null) ? delta(todayV, monV) : { abs: null, pct: null },
      pickupYesterday: (todayV != null && yestV!= null) ? delta(todayV, yestV): { abs: null, pct: null },
      vsBudget: { abs: null, pct: null },
      vsLy:     (todayV != null && b2025 != null) ? delta(todayV, b2025) : { abs: null, pct: null },
      sdly:     sdlyV,
      sdlyDiff: (todayV != null && sdlyV != null) ? todayV - sdlyV : null,
    };
  }

  const totalRows = METRICS.map(totalRow);

  const stalenessNote = propertyId === DONNA_ID
    ? 'Donna · last 5–6 days of bookings missing; pickup deltas reflect data through last successful Mews sync.'
    : undefined;

  return {
    property,
    capacity,
    asOfDate: fmtIso(today),
    monthlySnapshotLabel:   fmtDmy(monthStart),
    mondaySnapshotLabel:    fmtDmy(lastMonday),
    yesterdaySnapshotLabel: fmtDmy(yesterday),
    todaySnapshotLabel:     fmtDmy(today),
    sdlyDate:               fmtDmy(sdly),
    months,
    total: totalRows,
    stalenessNote,
  };
}
