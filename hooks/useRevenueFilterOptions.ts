/**
 * useRevenueFilterOptions
 * Fetches distinct option lists for the three multi-select dropdowns.
 * Cached via SWR — fetched once on layout mount, shared across all revenue pages.
 * Null/empty values are excluded from lists.
 */
import useSWR from 'swr';
import { supabase } from '@/lib/supabaseClient';

export interface FilterOptions {
  room_types: string[];
  booking_sources: string[];
  guest_countries: string[];
}

async function fetchOptions(): Promise<FilterOptions> {
  const [rtRes, bsRes, gcRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('room_type')
      .not('room_type', 'is', null)
      .order('room_type'),
    supabase
      .from('bookings')
      .select('booking_source')
      .not('booking_source', 'is', null)
      .order('booking_source'),
    supabase
      .from('bookings')
      .select('guest_country')
      .not('guest_country', 'is', null)
      .order('guest_country'),
  ]);

  const distinct = <T extends Record<string, unknown>>(rows: T[] | null, key: keyof T): string[] =>
    [...new Set((rows ?? []).map(r => r[key] as string).filter(Boolean))];

  return {
    room_types: distinct(rtRes.data, 'room_type'),
    booking_sources: distinct(bsRes.data, 'booking_source'),
    guest_countries: distinct(gcRes.data, 'guest_country'),
  };
}

export function useRevenueFilterOptions(): FilterOptions & { loading: boolean } {
  const { data, isLoading } = useSWR<FilterOptions>('revenue-filter-options', fetchOptions, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 5 * 60 * 1000, // 5 min
  });

  return {
    room_types: data?.room_types ?? [],
    booking_sources: data?.booking_sources ?? [],
    guest_countries: data?.guest_countries ?? [],
    loading: isLoading,
  };
}
