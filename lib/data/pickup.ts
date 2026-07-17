// lib/data/pickup.ts
// Server helper -> PickupMatrixData. Sources:
//   public.fn_pickup_asof(prop)       per-property as-of (Namkhan live=today; Donna stops at last booking)
//   public.fn_pickup_otb_at(prop,as)  Silver, as-of-cancellation, night-attributed RN, booked-rate REV,
//                                      + time-correct avail_rn (handles Namkhan 24->30 on 2026-07-01)
//   public.v_pickup_monthly           full-year baseline actuals
// vsLy now compares against the as-of SDLY (not full-year final actual).

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import type {
  PickupMatrixData, PickupMatrixRow, PickupMetric, PickupMatrixMonth, PickupDelta,
} from '@/app/(cockpit)/_design/PickupMatrix';

const NAMKHAN_ID = 260955;
const DONNA_ID   = 1000001;
const SYMBOL: Record<number, string> = { [NAMKHAN_ID]: '$', [DONNA_ID]: '\u20AC' };

interface MonthAgg { rn: number; rev: number; rev_total: number; avail: number }
type OtbRow = { stay_year: number; stay_month: number; rn: number; rev: number; rev_total: number; avail_rn: number };

const fmtIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtDmy = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

function delta(a: number | null, b: number | null): PickupDelta {
  if (a == null || b == null) return { abs: null, pct: null };
  const abs = a - b;
  const pct = b !== 0 ? (abs / Math.abs(b)) * 100 : null;
  return { abs, pct };
}

function valueOf(a: MonthAgg | null, metric: PickupMetric): number | null {
  if (!a) return null;
  if (metric === 'RN')        return a.rn;
  if (metric === 'OCC')       return a.avail > 0 ? (a.rn / a.avail) * 100 : null;
  if (metric === 'REV')       return a.rev;
  if (metric === 'REV rooms') return a.rev;
  if (metric === 'REV total') return a.rev_total;
  if (metric === 'ADR')       return a.rn > 0 ? a.rev / a.rn : null;
  if (metric === 'RevPAR')    return a.avail > 0 ? a.rev / a.avail : null;
  return null;
}

function bucket(rows: OtbRow[] | null, year: number): Record<number, MonthAgg> {
  const out: Record<number, MonthAgg> = {};
  for (const r of rows ?? []) {
    if (Number(r.stay_year) !== year) continue;
    out[Number(r.stay_month)] = {
      rn:        Number(r.rn ?? 0),
      rev:       Number(r.rev ?? 0),
      rev_total: Number(r.rev_total ?? r.rev ?? 0),
      avail:     Number(r.avail_rn ?? 0),
    };
  }
  return out;
}

function sumBucket(b: Record<number, MonthAgg>): MonthAgg {
  const t: MonthAgg = { rn: 0, rev: 0, rev_total: 0, avail: 0 };
  for (const m of Object.values(b)) { t.rn += m.rn; t.rev += m.rev; t.rev_total += m.rev_total; t.avail += m.avail; }
  return t;
}

export async function getPickupMatrix(propertyId: number): Promise<PickupMatrixData> {
  const supabase = getSupabaseAdmin();
  const property = propertyId === NAMKHAN_ID ? 'The Namkhan'
    : propertyId === DONNA_ID ? 'Donna Portals' : `Property ${propertyId}`;

  const asofRes = await supabase
    .rpc('fn_pickup_asof', { p_property_id: propertyId })
    .then((r) => (r.data?.[0] ?? null) as
      { asof_date: string; last_booking: string | null; is_stale: boolean; days_stale: number } | null);

  const asOf = asofRes ? new Date(asofRes.asof_date + 'T00:00:00') : new Date();
  const isStale = asofRes?.is_stale ?? false;
  const daysStale = asofRes?.days_stale ?? 0;

  const stayYear = asOf.getFullYear();
  const sdlyYear = stayYear - 1;

  const yesterday = new Date(asOf); yesterday.setDate(asOf.getDate() - 1);
  // PBS 2026-07-15: DBY snapshot added so "Pickup Yesterday" col = snapshot(yesterday) - snapshot(dby)
  // = actual calendar day yesterday activity (not "since yesterday snapshot" last-24h).
  // Now: matrix "Pickup Yesterday" = HoD tile "Pickup yesterday · net RN" = same number, everywhere.
  const dby = new Date(asOf); dby.setDate(asOf.getDate() - 2);
  const lastMonday = new Date(asOf);
  { const dow = lastMonday.getDay() || 7; lastMonday.setDate(lastMonday.getDate() - (dow - 1) - 7); }
  const monthStart = new Date(asOf.getFullYear(), asOf.getMonth(), 1);
  const sdly = new Date(asOf); sdly.setFullYear(sdlyYear);
  const y2 = new Date(stayYear - 2, 11, 31);
  const y3 = new Date(stayYear - 3, 11, 31);

  const snap = (d: Date): Promise<OtbRow[]> =>
    Promise.resolve(
      supabase.rpc('fn_pickup_otb_at', { p_property_id: propertyId, p_asof: fmtIso(d) })
        .then((r) => (r.data ?? []) as OtbRow[]),
    );

  const [sToday, sYest, sDby, sMon, sMonth, sSdly, sY2, sY3] = await Promise.all([
    snap(asOf).catch(() => [] as OtbRow[]),
    snap(yesterday).catch(() => [] as OtbRow[]),
    snap(dby).catch(() => [] as OtbRow[]),
    snap(lastMonday).catch(() => [] as OtbRow[]),
    snap(monthStart).catch(() => [] as OtbRow[]),
    snap(sdly).catch(() => [] as OtbRow[]),
    snap(y2).catch(() => [] as OtbRow[]),
    snap(y3).catch(() => [] as OtbRow[]),
  ]);

  const otbToday = bucket(sToday, stayYear);
  const otbYest  = bucket(sYest, stayYear);
  const otbDby   = bucket(sDby, stayYear);
  const otbMon   = bucket(sMon, stayYear);
  const otbMonth = bucket(sMonth, stayYear);
  const sdlyB    = bucket(sSdly, sdlyYear);

  const availY: Record<number, Record<number, number>> = {};
  const fillAvail = (rows: OtbRow[], year: number) => {
    availY[year] = {};
    for (const r of rows) if (Number(r.stay_year) === year) availY[year][Number(r.stay_month)] = Number(r.avail_rn ?? 0);
  };
  fillAvail(sToday, stayYear);
  fillAvail(sSdly, sdlyYear);
  fillAvail(sY2, stayYear - 2);
  fillAvail(sY3, stayYear - 3);

  const { data: baseRows } = await supabase
    .from('v_pickup_monthly').select('year,month,rn,rev,rev_total')
    .eq('property_id', propertyId).gte('year', stayYear - 3).lte('year', stayYear - 1);
  const baseline: Record<number, Record<number, MonthAgg>> = {};
  for (const r of (baseRows ?? []) as Array<{ year: number; month: number; rn: number; rev: number; rev_total: number | null }>) {
    const y = Number(r.year); const mo = Number(r.month);
    (baseline[y] ??= {})[mo] = {
      rn:        Number(r.rn ?? 0),
      rev:       Number(r.rev ?? 0),
      rev_total: Number(r.rev_total ?? r.rev ?? 0),
      avail:     availY[y]?.[mo] ?? 0,
    };
  }

  // PBS 2026-07-17: activity-based pickupYesterday (per PBS memo "pickup = new − cxl").
  // Replaces snapshot-delta which included modifications and diverged from HoD tile.
  // View sums to fn_hod_day_activity.pickup_net_rn for the anchor day.
  const { data: actRows } = await supabase
    .from('v_pickup_matrix_yesterday_activity')
    .select('stay_month, new_rn_yesterday, cxl_rn_yesterday, new_rev_yesterday, cxl_rev_yesterday')
    .eq('property_id', propertyId);
  const activityByMonth: Record<number, { net_rn: number; net_rev: number }> = {};
  for (const r of (actRows ?? []) as Array<{ stay_month: string; new_rn_yesterday: number; cxl_rn_yesterday: number; new_rev_yesterday: number; cxl_rev_yesterday: number }>) {
    // stay_month comes back as ISO date (first-of-month). Extract year+month; only keep current stayYear rows.
    const dt = new Date(r.stay_month + (r.stay_month.length === 10 ? 'T00:00:00' : ''));
    if (dt.getFullYear() !== stayYear) continue;
    activityByMonth[dt.getMonth() + 1] = {
      net_rn:  Number(r.new_rn_yesterday ?? 0)  - Number(r.cxl_rn_yesterday ?? 0),
      net_rev: Number(r.new_rev_yesterday ?? 0) - Number(r.cxl_rev_yesterday ?? 0),
    };
  }
  function activityPickup(mo: number, metric: PickupMetric): PickupDelta {
    const a = activityByMonth[mo];
    if (!a) return { abs: 0, pct: null };
    if (metric === 'RN')                                return { abs: a.net_rn,  pct: null };
    if (metric === 'REV' || metric === 'REV rooms')     return { abs: a.net_rev, pct: null };
    if (metric === 'REV total')                         return { abs: a.net_rev, pct: null };
    // OCC / ADR / RevPAR are derived — keep null, will fall through to snapshot delta in caller.
    return { abs: null, pct: null };
  }
  const activitySum = Object.values(activityByMonth).reduce(
    (s, a) => ({ net_rn: s.net_rn + a.net_rn, net_rev: s.net_rev + a.net_rev }),
    { net_rn: 0, net_rev: 0 },
  );
  function activityPickupTotal(metric: PickupMetric): PickupDelta {
    if (metric === 'RN')                                return { abs: activitySum.net_rn,  pct: null };
    if (metric === 'REV' || metric === 'REV rooms')     return { abs: activitySum.net_rev, pct: null };
    if (metric === 'REV total')                         return { abs: activitySum.net_rev, pct: null };
    return { abs: null, pct: null };
  }

  // PBS 2026-07-03: REV split into rooms-only + total (rooms + extras, Cloudbeds).
  const METRICS: PickupMetric[] = ['RN', 'OCC', 'REV rooms', 'REV total', 'ADR', 'RevPAR'];

  function buildRow(metric: PickupMetric, mo: number): PickupMatrixRow {
    const tAll = valueOf(otbToday[mo] ?? null, metric);
    const tMonthly = valueOf(otbMonth[mo] ?? null, metric);
    const tMonday  = valueOf(otbMon[mo] ?? null, metric);
    const tYest    = valueOf(otbYest[mo] ?? null, metric);
    const tDby     = valueOf(otbDby[mo] ?? null, metric);
    const tToday   = tAll;
    const sdlyValue = valueOf(sdlyB[mo] ?? null, metric);
    const suppress = isStale;
    return {
      metric,
      baseline2023: valueOf(baseline[stayYear - 3]?.[mo] ?? null, metric),
      baseline2024: valueOf(baseline[stayYear - 2]?.[mo] ?? null, metric),
      baseline2025: valueOf(baseline[stayYear - 1]?.[mo] ?? null, metric),
      budget2026: null,
      otbAll: tAll, otbMonthly: tMonthly, otbMonday: tMonday, otbYesterday: tYest, otbToday: tToday,
      pickupMonthly:   suppress ? { abs: null, pct: null } : delta(tToday, tMonthly),
      pickupWeekly:    suppress ? { abs: null, pct: null } : delta(tToday, tMonday),
      // PBS 2026-07-17: pickupYesterday = new − cxl (activity math from v_pickup_matrix_yesterday_activity).
      // Was snapshot(yest)-snapshot(dby), which included modifications → total diverged from HoD tile.
      pickupYesterday: suppress
        ? { abs: null, pct: null }
        : (metric === 'RN' || metric === 'REV' || metric === 'REV rooms' || metric === 'REV total')
          ? activityPickup(mo, metric)
          : delta(tYest, tDby),
      vsBudget: { abs: null, pct: null },
      vsLy: delta(tToday, sdlyValue),
      sdly: sdlyValue,
      sdlyDiff: (tToday != null && sdlyValue != null) ? tToday - sdlyValue : null,
    };
  }

  const months: PickupMatrixMonth[] = [];
  for (let mo = 1; mo <= 12; mo++) {
    months.push({
      monthKey: `${stayYear}-${String(mo).padStart(2, '0')}`,
      monthLabel: `01/${String(mo).padStart(2, '0')}/${stayYear}`,
      rows: METRICS.map((m) => buildRow(m, mo)),
    });
  }

  const tot = {
    today: sumBucket(otbToday), monthly: sumBucket(otbMonth), monday: sumBucket(otbMon),
    yest: sumBucket(otbYest), dby: sumBucket(otbDby), sdly: sumBucket(sdlyB),
    b23: sumBucket(baseline[stayYear - 3] ?? {}), b24: sumBucket(baseline[stayYear - 2] ?? {}), b25: sumBucket(baseline[stayYear - 1] ?? {}),
  };
  function totalRow(metric: PickupMetric): PickupMatrixRow {
    const tToday = valueOf(Object.keys(otbToday).length ? tot.today : null, metric);
    const tMonthly = valueOf(Object.keys(otbMonth).length ? tot.monthly : null, metric);
    const tMonday = valueOf(Object.keys(otbMon).length ? tot.monday : null, metric);
    const tYest = valueOf(Object.keys(otbYest).length ? tot.yest : null, metric);
    const tDby  = valueOf(Object.keys(otbDby).length  ? tot.dby  : null, metric);
    const sdlyValue = valueOf(Object.keys(sdlyB).length ? tot.sdly : null, metric);
    const suppress = isStale;
    return {
      metric,
      baseline2023: valueOf(Object.keys(baseline[stayYear - 3] ?? {}).length ? tot.b23 : null, metric),
      baseline2024: valueOf(Object.keys(baseline[stayYear - 2] ?? {}).length ? tot.b24 : null, metric),
      baseline2025: valueOf(Object.keys(baseline[stayYear - 1] ?? {}).length ? tot.b25 : null, metric),
      budget2026: null,
      otbAll: tToday, otbMonthly: tMonthly, otbMonday: tMonday, otbYesterday: tYest, otbToday: tToday,
      pickupMonthly:   suppress ? { abs: null, pct: null } : delta(tToday, tMonthly),
      pickupWeekly:    suppress ? { abs: null, pct: null } : delta(tToday, tMonday),
      // PBS 2026-07-17: activity-based total (sum of per-stay-month new − cxl).
      // Total row now matches HoD stripe pickup exactly.
      pickupYesterday: suppress
        ? { abs: null, pct: null }
        : (metric === 'RN' || metric === 'REV' || metric === 'REV rooms' || metric === 'REV total')
          ? activityPickupTotal(metric)
          : delta(tYest, tDby),
      vsBudget: { abs: null, pct: null },
      vsLy: delta(tToday, sdlyValue),
      sdly: sdlyValue,
      sdlyDiff: (tToday != null && sdlyValue != null) ? tToday - sdlyValue : null,
    };
  }

  const curMonthAvail = otbToday[asOf.getMonth() + 1]?.avail ?? 0;
  const capacity = curMonthAvail > 0
    ? Math.round(curMonthAvail / new Date(stayYear, asOf.getMonth() + 1, 0).getDate()) : 0;

  const stalenessNote = isStale
    ? `${property} feed stopped \u2014 data as of ${asofRes?.last_booking ? fmtDmy(new Date(asofRes.last_booking + 'T00:00:00')) : fmtDmy(asOf)} (${daysStale}d ago). Live pickup deltas suppressed; SDLY anchored to ${fmtDmy(sdly)}.`
    : undefined;

  return {
    property,
    capacity,
    asOfDate: `OTB \u00B7 Pickup \u00B7 Comparison \u00B7 SDLY  \u00B7  as of ${fmtDmy(asOf)}`,
    monthlySnapshotLabel: fmtDmy(monthStart),
    mondaySnapshotLabel: fmtDmy(lastMonday),
    yesterdaySnapshotLabel: fmtDmy(yesterday),
    todaySnapshotLabel: fmtDmy(asOf),
    sdlyDate: fmtDmy(sdly),
    months,
    total: METRICS.map(totalRow),
    stalenessNote,
    currencySymbol: SYMBOL[propertyId] ?? '\u20AC',
  };
}
