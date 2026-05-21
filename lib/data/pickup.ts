// lib/data/pickup.ts
// Server-side helper: builds the PickupMatrixData shape for a given property.
// Phase 1 wires what's computable from existing data — 2025 actuals (LY/SDLY),
// 2026 Today OTB (from v_otb_pace) — and returns nulls for the snapshot,
// 2023/2024 baseline, and budget columns so the matrix renders gracefully
// before pms.otb_snapshots / finance.gl_budgets room rows land.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import type { PickupMatrixData, PickupMatrixRow, PickupMetric, PickupMatrixMonth, PickupDelta } from '@/app/(cockpit)/_design/PickupMatrix';

const NAMKHAN_ID = 260955;
const DONNA_ID = 1000001;

// Sellable capacity per property. PDF header shows Donna=64; Namkhan memory says 24/30.
const CAPACITY: Record<number, number> = {
  [NAMKHAN_ID]: 24,
  [DONNA_ID]:   64,
};

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

interface MonthAgg { rn: number; rev: number }
const EMPTY: MonthAgg = { rn: 0, rev: 0 };

function delta(a: number | null, b: number | null): PickupDelta {
  if (a == null || b == null) return { abs: null, pct: null };
  const abs = a - b;
  const pct = b !== 0 ? (abs / Math.abs(b)) * 100 : null;
  return { abs, pct };
}

function computeRow(
  metric: PickupMetric,
  cur: MonthAgg | null,
  ly:  MonthAgg | null,
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
  const sdly = valueOf(ly);

  return {
    metric,
    baseline2023: null,
    baseline2024: null,
    baseline2025: sdly,
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
    vsLy: (otbToday != null && sdly != null)
      ? delta(otbToday, sdly)
      : { abs: null, pct: null },
    sdly,
    sdlyDiff: (otbToday != null && sdly != null) ? otbToday - sdly : null,
  };
}

function aggregateRows(rows: MonthAgg[]): MonthAgg {
  return rows.reduce((acc, r) => ({ rn: acc.rn + r.rn, rev: acc.rev + r.rev }), { rn: 0, rev: 0 });
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

  // 2026 OTB from v_otb_pace, monthly aggregated (Today snapshot only — older
  // snapshots will come from pms.otb_snapshots once that table exists).
  const { data: otbRaw } = await supabase
    .from('v_otb_pace')
    .select('night_date,confirmed_rooms,confirmed_revenue')
    .eq('property_id', propertyId)
    .gte('night_date', '2026-01-01')
    .lt('night_date', '2027-01-01');

  const cur: Record<number, MonthAgg> = {};
  for (const r of (otbRaw ?? [])) {
    const m = Number(String((r as { night_date: string }).night_date).slice(5, 7));
    if (!cur[m]) cur[m] = { rn: 0, rev: 0 };
    cur[m].rn  += Number((r as { confirmed_rooms?: number }).confirmed_rooms ?? 0);
    cur[m].rev += Number((r as { confirmed_revenue?: number }).confirmed_revenue ?? 0);
  }

  // 2025 actuals — from the right reservation table per property.
  const ly: Record<number, MonthAgg> = {};
  const resTable = propertyId === NAMKHAN_ID ? 'reservations_cb' : 'reservations_mews';
  const { data: lyRaw } = await supabase
    .schema('pms')
    // @ts-expect-error - resTable is one of two valid generated names
    .from(resTable)
    .select('check_in_date,nights,total_amount,is_cancelled')
    .eq('property_id', propertyId)
    .gte('check_in_date', '2025-01-01')
    .lt('check_in_date', '2026-01-01')
    .eq('is_cancelled', false);

  for (const r of (lyRaw ?? []) as Array<{ check_in_date: string; nights: number; total_amount: number }>) {
    const m = Number(String(r.check_in_date).slice(5, 7));
    if (!ly[m]) ly[m] = { rn: 0, rev: 0 };
    ly[m].rn  += Number(r.nights ?? 0);
    ly[m].rev += Number(r.total_amount ?? 0);
  }

  const METRICS: PickupMetric[] = ['RN', 'OCC', 'REV', 'ADR', 'RevPAR'];
  const months: PickupMatrixMonth[] = [];
  for (let mo = 1; mo <= 12; mo++) {
    const dim = daysInMonth(2026, mo);
    months.push({
      monthKey:   `2026-${String(mo).padStart(2, '0')}`,
      monthLabel: `01/${String(mo).padStart(2, '0')}/2026`,
      rows: METRICS.map((m) => computeRow(m, cur[mo] ?? null, ly[mo] ?? null, capacity, dim)),
    });
  }

  // Totals — sum RN and REV across months; recompute derived metrics.
  const totalCur = aggregateRows(Object.values(cur));
  const totalLy  = aggregateRows(Object.values(ly));
  const totalDays = 365; // 2026 is not a leap year
  const totalRows = METRICS.map((m) => computeRow(m, totalCur, totalLy, capacity, totalDays));

  // Staleness note for Donna — last sync was ~6 days behind per PBS.
  const stalenessNote = propertyId === DONNA_ID
    ? 'Donna · feed last synced 6 days ago; pickup columns are static until live ingest resumes.'
    : undefined;

  return {
    property,
    capacity,
    asOfDate: today,
    monthlySnapshotLabel: fmtDmy(monthStart),
    mondaySnapshotLabel:  fmtDmy(lastMonday),
    yesterdaySnapshotLabel: fmtDmy(yesterday),
    todaySnapshotLabel: fmtDmy(now),
    sdlyDate: fmtDmy(sdly),
    months,
    total: totalRows,
    stalenessNote,
  };
}
