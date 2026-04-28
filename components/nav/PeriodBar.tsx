'use client';

// components/nav/PeriodBar.tsx
// Period dropdowns (Look Back / Forward / Segment / Compare).
// Pushes selections to URL searchParams so server components re-fetch with new range.
// As-of timestamp on the right + currency toggle.

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LOOK_BACK_LABELS,
  FORWARD_LABELS,
  SEGMENT_LABELS,
  COMPARE_LABELS,
  DEFAULT_PERIOD,
  type LookBack,
  type Forward,
  type Segment,
  type Compare,
} from '@/lib/period';
import CurrencyToggle from '@/components/ui/CurrencyToggle';

export default function PeriodBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const back = (searchParams.get('back') as LookBack) ?? DEFAULT_PERIOD.back;
  const fwd = (searchParams.get('fwd') as Forward) ?? DEFAULT_PERIOD.fwd;
  const seg = (searchParams.get('seg') as Segment) ?? DEFAULT_PERIOD.seg;
  const cmp = (searchParams.get('cmp') as Compare) ?? DEFAULT_PERIOD.cmp;

  function update(patch: Partial<{ back: string; fwd: string; seg: string; cmp: string }>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([k, v]) => {
      if (v === '' || v == null) params.delete(k);
      else params.set(k, v);
    });
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  // Live "as of" clock
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const dateStr = now.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-GB', { hour12: false });

  return (
    <div className="period-wrap">
      <div className="period-bar">
        <div className="period-group">
          <span className="period-label">Look Back</span>
          <select
            className="period-select back"
            value={back}
            onChange={(e) => update({ back: e.target.value, fwd: '' })}
          >
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
            value={fwd}
            onChange={(e) => update({ fwd: e.target.value, ...(e.target.value ? { back: '' } : {}) })}
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

        <div className="period-active">
          <CurrencyToggle />
        </div>
      </div>

      <div className="as-of-row">
        <div className="as-of-label">As of</div>
        <div className="as-of-date">{dateStr}</div>
        <div className="as-of-time">data: {timeStr}</div>
      </div>
    </div>
  );
}
