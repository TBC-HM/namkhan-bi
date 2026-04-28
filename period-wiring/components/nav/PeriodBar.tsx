'use client';

// components/nav/PeriodBar.tsx
// Period dropdowns + active-period readout + as-of clock + currency toggle.
//
// IMPORTANT: This component just controls the URL. Server pages must call
// resolvePeriod(searchParams) from lib/period.ts and pass the resolved range
// into every data fetcher. Without that, dropdowns are decoration.

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import {
  LOOK_BACK_LABELS, FORWARD_LABELS, SEGMENT_LABELS, COMPARE_LABELS,
  DEFAULT_PERIOD, parsePeriod, resolvePeriod,
} from '@/lib/period';
import CurrencyToggle from '@/components/ui/CurrencyToggle';

export default function PeriodBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse current state from URL
  const state = useMemo(() => parsePeriod(
    Object.fromEntries(searchParams.entries())
  ), [searchParams]);

  const resolved = useMemo(() => resolvePeriod(
    Object.fromEntries(searchParams.entries())
  ), [searchParams]);

  function update(patch: Partial<{ back: string; fwd: string; seg: string; cmp: string }>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([k, v]) => {
      if (v === '' || v == null) params.delete(k);
      else params.set(k, v);
    });
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const dateStr = now.toLocaleDateString('en-GB', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-GB', { hour12: false });

  return (
    <div className="period-wrap">
      <div className="period-bar">
        <div className="period-group">
          <span className="period-label">Look Back</span>
          <select
            className="period-select back"
            value={state.fwd ? '' : state.back}
            onChange={(e) => update({ back: e.target.value, fwd: '' })}
          >
            {!state.fwd ? null : <option value="">— inactive —</option>}
            {Object.entries(LOOK_BACK_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        <div className="period-divider" />

        <div className="period-group">
          <span className="period-label">Forward</span>
          <select
            className="period-select fwd"
            value={state.fwd}
            onChange={(e) => update({ fwd: e.target.value })}
          >
            <option value="">— None —</option>
            {Object.entries(FORWARD_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        <div className="period-divider" />

        <div className="period-group">
          <span className="period-label">Segment</span>
          <select
            className="period-select"
            value={state.seg}
            onChange={(e) => update({ seg: e.target.value })}
          >
            {Object.entries(SEGMENT_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        <div className="period-divider" />

        <div className="period-group">
          <span className="period-label">Compare</span>
          <select
            className="period-select"
            value={state.cmp}
            onChange={(e) => update({ cmp: e.target.value })}
          >
            <option value="">No comparison</option>
            <option value="stly">vs STLY</option>
            <option value="prior">vs Prior Period</option>
            <option value="budget">vs Budget</option>
          </select>
        </div>

        <div className="period-active">
          <CurrencyToggle />
        </div>
      </div>

      {/* Active period readout — shows the user EXACTLY what filters are applied */}
      <div className="active-period-row">
        <div className="active-period-left">
          <span className="active-period-label">Active filter</span>
          <span className="active-period-value">{resolved.label}</span>
          <span className="active-period-range">{resolved.rangeLabel}</span>
          {(state.back !== DEFAULT_PERIOD.back || state.fwd || state.seg !== 'all' || state.cmp) && (
            <button
              className="active-period-reset"
              onClick={() => router.replace(pathname, { scroll: false })}
              title="Clear all filters"
            >
              ✕ Reset
            </button>
          )}
        </div>
        <div className="as-of-inline">
          <span className="as-of-label">As of</span>
          <span className="as-of-date">{dateStr}</span>
          <span className="as-of-time">{timeStr}</span>
        </div>
      </div>
    </div>
  );
}
