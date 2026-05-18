// lib/capacity.ts
// Date-dependent property capacity, now property-aware.
//
// Namkhan: 24 → 30 rooms on 2026-07-01 pivot (existing behaviour).
// Donna:   66 rooms constant (from distinct room_ids in pms.reservation_rooms_mews 2025+).
//
// Backwards-compatible: callers without `propertyId` arg get Namkhan logic.
// PBS 2026-05-18: property-aware step toward Donna/Namkhan revenue-page parity.

const PIVOT = '2026-07-01'; // Namkhan rooms expansion
const PRE_CAPACITY = 24;
const POST_CAPACITY = 30;

const NAMKHAN_PROPERTY_ID = 260955;
const DONNA_PROPERTY_ID = 1000001;
const DONNA_CAPACITY = 66; // matches DONNA_ROOM_COUNT in lib/data-donna-mews.ts

export function capacityFor(
  dateIso: string,
  propertyId: number = NAMKHAN_PROPERTY_ID,
): number {
  if (propertyId === DONNA_PROPERTY_ID) return DONNA_CAPACITY;
  // Namkhan + fallback
  return dateIso < PIVOT ? PRE_CAPACITY : POST_CAPACITY;
}

// Capacity in room-nights for [from, to] inclusive. Walks day by day on
// Namkhan to handle the 2026-07-01 pivot correctly. Donna is constant so
// we can compute in O(1).
export function capacityRnRange(
  fromIso: string,
  toIso: string,
  propertyId: number = NAMKHAN_PROPERTY_ID,
): number {
  const from = new Date(fromIso + 'T00:00:00Z');
  const to = new Date(toIso + 'T00:00:00Z');
  if (to < from) return 0;

  if (propertyId === DONNA_PROPERTY_ID) {
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
    return days * DONNA_CAPACITY;
  }

  // Namkhan + fallback — walk day-by-day for pivot handling
  let total = 0;
  for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    total += capacityFor(d.toISOString().slice(0, 10), propertyId);
  }
  return total;
}

export const CAPACITY_PIVOT = PIVOT;
export const CAPACITY_PRE = PRE_CAPACITY;
export const CAPACITY_POST = POST_CAPACITY;
export const CAPACITY_DONNA = DONNA_CAPACITY;
