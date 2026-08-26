// lib/ceo/heartbeat.ts
// PBS 2026-08-26 · Scoring behind the per-property CEO heartbeat.
//
// The CEO surface answers one question first: are we ahead or behind, and
// against what. Two benchmarks per design_system §3.1 `compare[]` — "vs SDLY"
// and "vs Budget". SDLY is computable today; budget is not (finance.budget_monthly
// and finance.gl_budgets are both empty as of 2026-08-26), so its line renders
// via status 'pending' — an italic dash that keeps the row visible and fills in
// the moment a budget is uploaded. Nothing here invents a number to fill a gap.
//
// Index convention is STR/USALI: 100 = par with the benchmark (L16).

import type { KpiComparison } from '@/app/(cockpit)/_design/types';

type Num = number | null | undefined;

/**
 * Index this year against a benchmark. 100 = par.
 *
 * Returns null — never 0 or Infinity — when the benchmark is absent or
 * non-positive, because a missing baseline must stay dormant rather than
 * render as a real score. A genuine zero THIS year is a real result and
 * indexes to 0.
 */
export function performanceIndex(ty: Num, benchmark: Num): number | null {
  if (ty == null || benchmark == null) return null;
  const t = Number(ty), b = Number(benchmark);
  if (!Number.isFinite(t) || !Number.isFinite(b) || b <= 0) return null;
  return Math.round((t / b) * 100);
}

/** Weights for the composite. RevPAR already contains occupancy × rate, so
 *  occupancy and ADR are shown on the page for diagnosis but never weighted —
 *  counting them again would double-weight the same performance. */
export const SCORE_WEIGHTS = { revpar: 0.6, totalRevenue: 0.4 } as const;

export interface ScoreComponent { index: number | null; weight: number }

/**
 * Weighted composite of component indices.
 *
 * Missing components are dropped and the remaining weights renormalised, so a
 * property with only RevPAR available scores its RevPAR index rather than a
 * silently deflated fraction of it.
 */
export function compositeScore(parts: ScoreComponent[]): number | null {
  let sum = 0, weight = 0;
  for (const p of parts) {
    if (p.index == null || !Number.isFinite(p.index)) continue;
    if (!Number.isFinite(p.weight) || p.weight <= 0) continue;
    sum += p.index * p.weight;
    weight += p.weight;
  }
  if (weight <= 0) return null;
  return Math.round(sum / weight);
}

/**
 * Share of last year's FINAL volume already on the books.
 *
 * Deliberately not called a variance: last year's figure includes every late
 * booking this year has not received yet, so the ratio always reads low. It
 * measures how full the book is, not how far behind we are. Same convention
 * the Revenue HoD pace tile uses ("76 OTB TY · 133 actual LY").
 */
export function fillPct(otb: Num, lyFinal: Num): number | null {
  if (otb == null || lyFinal == null) return null;
  const o = Number(otb), l = Number(lyFinal);
  if (!Number.isFinite(o) || !Number.isFinite(l) || l <= 0) return null;
  return Math.round((o / l) * 100);
}

export interface IndexDelta { value: number; direction: 'up' | 'down' | 'flat' }

/** Turn an index into the signed movement KpiTile's delta/compare expect. */
export function deltaFromIndex(index: number | null): IndexDelta | null {
  if (index == null || !Number.isFinite(index)) return null;
  const value = Math.round((index - 100) * 10) / 10;
  return {
    value,
    direction: value > 0.5 ? 'up' : value < -0.5 ? 'down' : 'flat',
  };
}

/**
 * Build a KpiTile comparison line. A null index yields status 'pending', which
 * design_system §3.1 renders as a dash while keeping the row — the dormant slot
 * that lights up on upload.
 */
export function toComparison(
  label: string, index: number | null, isGoodWhenUp = true,
): KpiComparison {
  const d = deltaFromIndex(index);
  if (!d) {
    return { label, value: 0, format: 'percent', isGoodWhenUp, status: 'pending' };
  }
  return {
    label, value: d.value, format: 'percent',
    direction: d.direction, isGoodWhenUp, status: 'live',
  };
}

// ─── Shaping helpers ───────────────────────────────────────────────────────

export interface PeriodTotals {
  roomsRevenue: number;
  totalRevenue: number;
  roomsSold: number;
  roomsAvailable: number;
}

export const EMPTY_TOTALS: PeriodTotals = {
  roomsRevenue: 0, totalRevenue: 0, roomsSold: 0, roomsAvailable: 0,
};

export function occupancy(t: PeriodTotals): number | null {
  return t.roomsAvailable > 0 ? (t.roomsSold / t.roomsAvailable) * 100 : null;
}
export function adr(t: PeriodTotals): number | null {
  return t.roomsSold > 0 ? t.roomsRevenue / t.roomsSold : null;
}
export function revpar(t: PeriodTotals): number | null {
  return t.roomsAvailable > 0 ? t.roomsRevenue / t.roomsAvailable : null;
}

/** The whole score for one property, both benchmarks. */
export interface HeartbeatScore {
  sdlyIndex: number | null;
  budgetIndex: number | null;
  revparIndex: number | null;
  totalRevenueIndex: number | null;
  occIndex: number | null;
  adrIndex: number | null;
}

export function buildScore(
  ty: PeriodTotals, ly: PeriodTotals, budget?: PeriodTotals | null,
): HeartbeatScore {
  const revparIndex = performanceIndex(revpar(ty), revpar(ly));
  const totalRevenueIndex = performanceIndex(ty.totalRevenue, ly.totalRevenue);
  return {
    revparIndex,
    totalRevenueIndex,
    occIndex: performanceIndex(occupancy(ty), occupancy(ly)),
    adrIndex: performanceIndex(adr(ty), adr(ly)),
    sdlyIndex: compositeScore([
      { index: revparIndex, weight: SCORE_WEIGHTS.revpar },
      { index: totalRevenueIndex, weight: SCORE_WEIGHTS.totalRevenue },
    ]),
    budgetIndex: budget
      ? compositeScore([
          { index: performanceIndex(revpar(ty), revpar(budget)), weight: SCORE_WEIGHTS.revpar },
          { index: performanceIndex(ty.totalRevenue, budget.totalRevenue), weight: SCORE_WEIGHTS.totalRevenue },
        ])
      : null,
  };
}
