/**
 * useRevenueFilters
 * Reads/writes all revenue page URL params:
 *   window, compare, room_type (comma-sep), booking_source (comma-sep), guest_country (comma-sep)
 *
 * Encoding standard: comma-separated single param (?room_type=deluxe,suite)
 * URL-only persistence (no localStorage).
 */
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

export interface RevenueFilters {
  window: string;
  compare: string;
  room_type: string[];
  booking_source: string[];
  guest_country: string[];
}

function parseCsv(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

export function useRevenueFilters(): {
  filters: RevenueFilters;
  setFilter: <K extends keyof RevenueFilters>(key: K, value: RevenueFilters[K]) => void;
  clearFilter: (key: keyof RevenueFilters) => void;
  clearAll: () => void;
} {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters: RevenueFilters = {
    window: searchParams.get('window') ?? '30',
    compare: searchParams.get('compare') ?? 'prior_period',
    room_type: parseCsv(searchParams.get('room_type')),
    booking_source: parseCsv(searchParams.get('booking_source')),
    guest_country: parseCsv(searchParams.get('guest_country')),
  };

  const setFilter = useCallback(
    <K extends keyof RevenueFilters>(key: K, value: RevenueFilters[K]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (Array.isArray(value)) {
        if (value.length === 0) {
          params.delete(key);
        } else {
          params.set(key, (value as string[]).join(','));
        }
      } else {
        params.set(key, value as string);
      }
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const clearFilter = useCallback(
    (key: keyof RevenueFilters) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete(key);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const clearAll = useCallback(() => {
    const params = new URLSearchParams();
    const w = searchParams.get('window');
    const c = searchParams.get('compare');
    if (w) params.set('window', w);
    if (c) params.set('compare', c);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  return { filters, setFilter, clearFilter, clearAll };
}
