// lib/outlets/departments.ts
// PBS 2026-08-26 · The Operations department registry.
//
// The department sub-strip shows seven pages, but the USALI taxonomy beneath
// them does not match one-to-one:
//
//   Rooms       -> usali_dept = 'Rooms'
//   F&B         -> usali_dept = 'F&B'
//   Spa         -> 'Other Operated' / 'Spa'          (no Spa department exists)
//   Activities  -> 'Other Operated' / 'Activities'
//   Transport   -> 'Other Operated' / 'Transportation'
//   Retail      -> 'Retail' on Namkhan, 'Other Operated'/'Retail' on Donna
//   Other       -> everything else under 'Other Operated'
//
// The (dept, subdept) -> key mapping lives in public.fn_outlet_dept_key so it is
// decided once in SQL rather than seven times in seven pages. This file is the
// UI half: what each page is called, and what "capture" means there in words a
// department manager uses.

export type DeptKey = 'rooms' | 'fb' | 'spa' | 'activities' | 'retail' | 'transport' | 'other';

export interface DeptSpec {
  key: DeptKey;
  /** Page title fragment, as it appears in the department strip. */
  label: string;
  /** What a captured reservation actually did, in the manager's words. */
  verb: string;
  /** Plural noun for the thing sold — used in footnotes. */
  noun: string;
  /**
   * Capture bands. Rooms is near-total by definition (almost every reservation
   * has room revenue), so the same 75/60 thresholds used for F&B would paint
   * every other outlet permanently red. Each department gets its own.
   */
  good: number;
  fair: number;
  /** Shown when the department has structurally low capture, so a red tile is not misread. */
  note?: string;
}

export const DEPARTMENTS: Record<DeptKey, DeptSpec> = {
  rooms: {
    key: 'rooms', label: 'Rooms', verb: 'were charged for their room', noun: 'room charges',
    good: 95, fair: 85,
    note: 'Near-total by definition — a reservation without room revenue is usually a comp, a staff stay or a posting error, which is exactly what this tile is good for.',
  },
  fb: {
    key: 'fb', label: 'F&B', verb: 'bought food or drink', noun: 'covers',
    good: 75, fair: 60,
  },
  spa: {
    key: 'spa', label: 'Spa', verb: 'booked a treatment', noun: 'treatments',
    good: 25, fair: 15,
    note: 'Spa capture is structurally low — most guests never book a treatment. The number to watch is the trend, not the absolute.',
  },
  activities: {
    key: 'activities', label: 'Activities', verb: 'booked an activity', noun: 'activities',
    good: 30, fair: 18,
  },
  retail: {
    key: 'retail', label: 'Retail', verb: 'bought something from the shop', noun: 'retail sales',
    good: 15, fair: 8,
    note: 'Retail is booked under two different USALI codes across the estate; this page unifies both so neither tenant is silently missing.',
  },
  transport: {
    key: 'transport', label: 'Transport', verb: 'booked a transfer', noun: 'transfers',
    good: 25, fair: 12,
  },
  other: {
    key: 'other', label: 'Other', verb: 'used another service', noun: 'services',
    good: 25, fair: 12,
    note: 'Laundry, rental, pets, front-office sundries — everything under Other Operated that is not spa, activities, transport or retail.',
  },
};

export function deptSpec(key: DeptKey): DeptSpec {
  return DEPARTMENTS[key] ?? DEPARTMENTS.other;
}

/** Tile status for a capture percentage, banded per department. */
export function captureTone(key: DeptKey, pct: number | null): 'green' | 'amber' | 'red' | 'grey' {
  if (pct == null) return 'grey';
  const d = deptSpec(key);
  return pct >= d.good ? 'green' : pct >= d.fair ? 'amber' : 'red';
}
