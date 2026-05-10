/**
 * revenueQueryFilters
 * Shared utility: takes active filter arrays and applies them to a
 * Supabase PostgREST query builder (generic). Returns the augmented query.
 *
 * Usage:
 *   let q = supabase.from('bookings').select('...');
 *   q = applyRevenueFilters(q, { room_type, booking_source, guest_country });
 *
 * When an array is empty the clause is skipped (no-op), so unfiltered
 * views remain unaffected.
 */

export interface RevenueMultiFilters {
  room_type?: string[];
  booking_source?: string[];
  guest_country?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyRevenueFilters<T extends { in: (col: string, vals: string[]) => T }>(query: T, filters: RevenueMultiFilters): T {
  let q = query;
  if (filters.room_type && filters.room_type.length > 0) {
    q = q.in('room_type', filters.room_type);
  }
  if (filters.booking_source && filters.booking_source.length > 0) {
    q = q.in('booking_source', filters.booking_source);
  }
  if (filters.guest_country && filters.guest_country.length > 0) {
    q = q.in('guest_country', filters.guest_country);
  }
  return q;
}
