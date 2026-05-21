// lib/data/pickup.ts
// Server-side helper: builds the PickupMatrixData shape for a given property.
// Phase 1 (2026-05-21): all reads now go through the public bridge view
// public.v_pickup_monthly so we stay inside PostgREST's allowed scope
// (claud_md v3.1 §0.5 — no direct pms.* reads). The view unifies both
// reservation tables (cb + mews) and aggregates by (property × year × month).
//
// Columns this currently lights up:
//   · 2023 / 2024 / 2025 RO  (from historical reservations)
//   · OTB ALL 2026           (from current reservations, status != cancelled)
//   · Today                  (same as OTB ALL — no separate snapshot yet)
//   · SDLY value + Δ vs SDLY (LY 2025 row vs 2026 OTB)
//   · OTB vs LY              (delta + pct)
// Columns still null until pms.otb_snapshots ships:
//   · Monthly · Monday · Yesterday snapshot
//   · Pickup deltas (monthly / weekly / yesterday)
// Columns still null until finance.gl_budgets gets room rows for 2026:
//   · Budget 2026 · OTB vs Budget

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

function computeRow(
  metric: PickupMetric,
  cur: MonthAgg | null,
  baselines: { y2023: MonthAgg | null; y2024: MonthAgg | null; y2025: MonthAgg | null },
  capacity: number,
  daysInMo: number,
): PickupMatrixRow {
  const availRn = capacity * daysInMo;
  const valueOf = (a: MonthAgg | null): number | null => {
    if (!a) return null;
    if (metric === 'RN')     return a.rn;
    if (metric === 'OCC')    return availRn > 0 ? (a.rn / availRn) * 100 : null;
    if (metric === 'REV')    return a.rev;
    if (metric === 'ADR')    return a.rn > 0 ? a.rev / a.rn : null;
    if (metric === 'RevPAR') return availRn > 0 ? a.rev / availRn : null;
    return null;
  };
  const otbToday = valueOf(cur);
  const baseline2023 = valueOf(baselines.y2023);
  const baseline2024 = valueOf(baselines.y2024);
  const baseline2025 = valueOf(baselines.y2025);

  const vsLyPair = (otbToday != null && baseline2025 != null)
    ? delta(otbToday, baseline2025)
    : { abs: null, pct: null };

  return {
    metric,
    baseline2023,
    baseline2024,
    baseline2025,
    budget2026:   null,
    otbAll:       otbToday,
    otbMonthly:   null,
    otbMonday:    null,
    otbYesterday: null,
    otbToday,
    pickupMonthly:   { abs: null, pct: null },
    pickupWeekly:    { abs: null, pct: null },
    pickupYesterday: { abs: null, pct: null },
    vsBudget: { abs: null, pct: null },
    vsLy:     vsLyPair,
    sdly:     baseline2025,
    sdlyDiff: (otbToday != null && baseline2025 != null) ? otbToday - baseline2025 : null,
  };
}

function sumMonths(buckets: Array<Record<number, MonthAgg>>): MonthAgg {
  const total: MonthAgg = { rn: 0, rev: 0 };
  for (const b of buckets) {
    for (const m of Object.values(b)) { total.rn += m.rn; total.rev += m.rev; }
  }
  return total;
}

export async function getPickupMatrix(propertyId: number): Promise<PickupMatrixData> {
  const supabase = getSupabaseAdmin();
  const capacity = CAPACITY[propertyId] ?? 30;
  const property = propertyId === NAMKHAN_ID ? 'The Namkhan' : propertyId === DONNA_ID ? 'Donna Portals' : `Property ${propertyId}`;

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const fmtDmy = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yesterday  = new Date(now); yesterday.setDate(now.getDate() - 1);
  const lastMonday = new Date(now);
  const dow = lastMonday.getDay() || 7;
  lastMonday.setDate(lastMonday.getDate() - (dow - 1) - 7);
  const sdly = new Date(now); sdly.setFullYear(sdly.getFullYear() - 1);

  // Single query — public bridge view, all 4 years, both reservation sources.
  const { data: rows, error } = await supabase
    .from('v_pickup_monthly')
    .select('year,month,rn,rev')
    .eq('property_id', propertyId)
    .gte('year', 2023)
    .lte('year', 2026);

  if (error) console.error('[pickup] v_pickup_monthly query failed', error);

  // Bucketize per year
  const buckets: Record<number, Record<number, MonthAgg>> = { 2023: {}, 2024: {}, 2025: {}, 2026: {} };
  for (const r of (rows ?? []) as Array<{ year: number; month: number; rn: number; rev: number }>) {
    if (!buckets[r.year]) continue;
    buckets[r.year][r.month] = { rn: Number(r.rn ?? 0), rev: Number(r.rev ?? 0) };
  }

  const METRICS: PickupMetric[] = ['RN', 'OCC', 'REV', 'ADR', 'RevPAR'];
  const months: PickupMatrixMonth[] = [];
  for (let mo = 1; mo <= 12; mo++) {
    const dim = daysInMonth(2026, mo);
    months.push({
      monthKey:   `2026-${String(mo).padStart(2, '0')}`,
      monthLabel: `01/${String(mo).padStart(2, '0')}/2026`,
      rows: METRICS.map((m) => computeRow(
        m,
        buckets[2026][mo] ?? null,
        {
          y2023: buckets[2023][mo] ?? null,
          y2024: buckets[2024][mo] ?? null,
          y2025: buckets[2025][mo] ?? null,
        },
        capacity, dim,
      )),
    });
  }

  // Yearly totals
  const total2023 = sumMonths([buckets[2023]]);
  const total2024 = sumMonths([buckets[2024]]);
  const total2025 = sumMonths([buckets[2025]]);
  const total2026 = sumMonths([buckets[2026]]);
  const totalRows = METRICS.map((m) => computeRow(
    m,
    Object.keys(buckets[2026]).length ? total2026 : null,
    {
      y2023: Object.keys(buckets[2023]).length ? total2023 : null,
      y2024: Object.keys(buckets[2024]).length ? total2024 : null,
      y2025: Object.keys(buckets[2025]).length ? total2025 : null,
    },
    capacity, 365,
  ));

  const stalenessNote = propertyId === DONNA_ID
    ? 'Donna · last 5–6 days of bookings missing; pickup deltas blank until live ingest resumes.'
    : undefined;

  return {
    property,
    capacity,
    asOfDate: today,
    monthlySnapshotLabel:   fmtDmy(monthStart),
    mondaySnapshotLabel:    fmtDmy(lastMonday),
    yesterdaySnapshotLabel: fmtDmy(yesterday),
    todaySnapshotLabel:     fmtDmy(now),
    sdlyDate:               fmtDmy(sdly),
    months,
    total: totalRows,
    stalenessNote,
  };
}
