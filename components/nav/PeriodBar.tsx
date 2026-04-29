'use client';

// components/nav/PeriodBar.tsx
// Period dropdowns (Period Window / Segment / Compare).
// Pushes selections to URL searchParams so server components re-fetch with new range.
// As-of timestamp on the right + currency toggle.

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
    SEGMENT_LABELS,
    DEFAULT_PERIOD,
    type Segment,
    type Compare,
    type LookBack,
    type Forward,
} from '@/lib/period';
import CurrencyToggle from '@/components/ui/CurrencyToggle';

// Combined period window options: each maps to {back, fwd} URL params.
// The value encodes "back:last_7" or "fwd:next_7" or "back:last_30|fwd:next_30" etc.
const PERIOD_WINDOW_OPTIONS: { value: string; label: string; back: string; fwd: string }[] = [
  { value: 'last_7',        label: 'Last Week',              back: 'last_7',   fwd: '' },
  { value: 'last_30',       label: 'Last Month',             back: 'last_30',  fwd: '' },
  { value: 'last_90',       label: 'Last Quarter',           back: 'last_90',  fwd: '' },
  { value: 'ytd',           label: 'Year to Date',           back: 'ytd',      fwd: '' },
  { value: 'last_365',      label: 'Last 12 Months',         back: 'last_365', fwd: '' },
  { value: 'last_year',     label: 'Last Year',              back: 'last_year',fwd: '' },
  { value: 'next_7',        label: 'Next Week',              back: '',         fwd: 'next_7' },
  { value: 'next_30',       label: 'Next Month',             back: '',         fwd: 'next_30' },
  { value: 'next_90',       label: 'Next Quarter',           back: '',         fwd: 'next_90' },
  { value: 'next_180',      label: 'Next 6 Months',          back: '',         fwd: 'next_180' },
  { value: 'next_365',      label: 'Next 12 Months',         back: '',         fwd: 'next_365' },
  { value: 'next_year',     label: 'Next Year',              back: '',         fwd: 'next_year' },
  { value: 'last_7|next_7',   label: 'Last 7 + Next 7 days',   back: 'last_7',  fwd: 'next_7' },
  { value: 'last_30|next_30', label: 'Last 30 + Next 30 days', back: 'last_30', fwd: 'next_30' },
  { value: 'last_30|next_90', label: 'Last 30 + Next 90 days', back: 'last_30', fwd: 'next_90' },
  { value: 'last_90|next_90', label: 'Last 90 + Next 90 days', back: 'last_90', fwd: 'next_90' },
  { value: 'last_30|next_180',label: 'Last 30 + Next 180 days',back: 'last_30', fwd: 'next_180' },
  { value: 'last_30|next_365',label: 'Last 30 + Next 365 days',back: 'last_30', fwd: 'next_365' },
  ];

function getCurrentWindowValue(back: string, fwd: string): string {
    if (back && fwd) return `${back}|${fwd}`;
    if (fwd) return fwd;
    return back || 'last_30';
}

export default function PeriodBar() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

  const back = (searchParams.get('back') as LookBack) ?? DEFAULT_PERIOD.back;
    const fwd = (searchParams.get('fwd') as Forward) ?? DEFAULT_PERIOD.fwd;
    const seg = (searchParams.get('seg') as Segment) ?? DEFAULT_PERIOD.seg;
    const cmp = (searchParams.get('cmp') as Compare) ?? DEFAULT_PERIOD.cmp;

  const currentWindow = getCurrentWindowValue(back, fwd);

  function update(patch: Partial<{ back: string; fwd: string; seg: string; cmp: string }>) {
        const params = new URLSearchParams(searchParams.toString());
        Object.entries(patch).forEach(([k, v]) => {
                if (v === '' || v == null) params.delete(k);
                else params.set(k, v);
        });
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function handleWindowChange(value: string) {
        const opt = PERIOD_WINDOW_OPTIONS.find(o => o.value === value);
        if (!opt) return;
        update({ back: opt.back, fwd: opt.fwd });
  }

  // Live "as of" clock
  const [now, setNow] = useState<Date>(new Date());
    useEffect(() => {
          const id = setInterval(() => setNow(new Date()), 60_000);
          return () => clearInterval(id);
    }, []);
    const timeStr = now.toLocaleTimeString('en-GB', { hour12: false });

  return (
        <div className="period-wrap">
              <div className="period-bar">
                      <div className="period-group">
                                <span className="period-label">Period</span>
                                <select
                                              className="period-select"
                                              value={currentWindow}
                                              onChange={(e) => handleWindowChange(e.target.value)}
                                            >
                                  {PERIOD_WINDOW_OPTIONS.map((opt) => (
                                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                          ))}
                                </select>
                      </div>
              
                      <div className="period-divider" />
              
                      <div className="period-group">
                                <span className="period-label">Segment</span>
                                <select
                                              className="period-select"
                                              value={seg}
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
                                              value={cmp}
                                              onChange={(e) => update({ cmp: e.target.value })}
                                            >
                                            <option value="">No comparison</option>
                                            <option value="stly">vs STLY</option>
                                            <option value="prior">vs Prior Period</option>
                                            <option value="budget">vs Budget</option>
                                </select>
                      </div>

              </div>
                      <div className="period-active">
                                <CurrencyToggle />
                                          <span className="period-timestamp">
                                                              As of {timeStr}
                                          </span>
                      </div>
              </div>

                );
            }
