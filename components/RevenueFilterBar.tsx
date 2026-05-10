/**
 * <RevenueFilterBar>
 * Shared filter bar for all four revenue pages.
 * Composes: window selector + compare selector + room_type + booking_source + guest_country.
 * Replaces any inline filter UI on individual pages.
 */
'use client';

import { useRevenueFilters } from '@/hooks/useRevenueFilters';
import { useRevenueFilterOptions } from '@/hooks/useRevenueFilterOptions';
import { MultiSelectFilter } from './MultiSelectFilter';
import styles from './RevenueFilterBar.module.css';

const WINDOW_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '12 months' },
];

const COMPARE_OPTIONS = [
  { value: 'prior_period', label: 'Prior period' },
  { value: 'prior_year', label: 'Prior year' },
  { value: 'none', label: 'No comparison' },
];

export function RevenueFilterBar() {
  const { filters, setFilter, clearFilter, clearAll } = useRevenueFilters();
  const { room_types, booking_sources, guest_countries, loading } = useRevenueFilterOptions();

  const hasActiveMulti =
    filters.room_type.length > 0 ||
    filters.booking_source.length > 0 ||
    filters.guest_country.length > 0;

  return (
    <div className={styles.bar}>
      {/* Window */}
      <label className={styles.selectWrap}>
        <span className={styles.selectLabel}>Window</span>
        <select
          className={styles.select}
          value={filters.window}
          onChange={e => setFilter('window', e.target.value)}
        >
          {WINDOW_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>

      {/* Compare */}
      <label className={styles.selectWrap}>
        <span className={styles.selectLabel}>Compare</span>
        <select
          className={styles.select}
          value={filters.compare}
          onChange={e => setFilter('compare', e.target.value)}
        >
          {COMPARE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>

      <span className={styles.divider} aria-hidden />

      {/* Room type */}
      <MultiSelectFilter
        label="Room type"
        options={room_types}
        selected={filters.room_type}
        onChange={v => setFilter('room_type', v)}
        onClear={() => clearFilter('room_type')}
        loading={loading}
      />

      {/* Booking source */}
      <MultiSelectFilter
        label="Source"
        options={booking_sources}
        selected={filters.booking_source}
        onChange={v => setFilter('booking_source', v)}
        onClear={() => clearFilter('booking_source')}
        loading={loading}
      />

      {/* Guest country */}
      <MultiSelectFilter
        label="Country"
        options={guest_countries}
        selected={filters.guest_country}
        onChange={v => setFilter('guest_country', v)}
        onClear={() => clearFilter('guest_country')}
        loading={loading}
      />

      {/* Clear all multi-selects */}
      {hasActiveMulti && (
        <button type="button" className={styles.clearAll} onClick={clearAll}>
          Clear filters
        </button>
      )}
    </div>
  );
}
