// lib/capacity.ts
// Date-dependent property capacity.
// 2026-07-01 → 6 new rooms come online (24 → 30 sellable).
// Use capacityFor(date) for any KPI that divides by capacity (Occ, RevPAR, TRevPAR).

const PIVOT = '2026-07-01'; // ISO yyyy-mm-dd
const PRE_CAPACITY = 24;
const POST_CAPACITY = 30;

export function capacityFor(dateIso: string): number {
  return dateIso < PIVOT ? PRE_CAPACITY : POST_CAPACITY;
}

// Capacity in room-nights for [from, to] inclusive. Walks day by day to handle
// the pivot correctly when the window straddles 2026-07-01.
export function capacityRnRange(fromIso: string, toIso: string): number {
  const from = new Date(fromIso + 'T00:00:00Z');
  const to = new Date(toIso + 'T00:00:00Z');
  if (to < from) return 0;
  let total = 0;
  for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    total += capacityFor(d.toISOString().slice(0, 10));
  }
  return total;
}

export const CAPACITY_PIVOT = PIVOT;
export const CAPACITY_PRE = PRE_CAPACITY;
export const CAPACITY_POST = POST_CAPACITY;
