'use client';

// components/nav/FilterStrip.tsx
// Three-control filter strip used on every pillar Snapshot page (and most sub-pages).
//
// Controls:
//   1. Window buttons:  Today · 7d · 30d · 90d · YTD  (back) ¦ Next 7 · 30 · 90 (fwd, optional)
//   2. Compare select:  none · vs Prior period · vs Same time last year
//   3. Segment select:  All · Leisure · Group · Wholesale · Corporate · Honeymoon
//
// All three drive query params (?win=, ?cmp=, ?seg=) on the same path.
// Server pages MUST read them via resolvePeriod(searchParams) — see lib/period.ts.

import Link from 'next/link';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { useMemo } from 'react';
import type { WindowKey, CompareKey, SegmentKey } from '@/lib/period';

// ---------- Tab definitions ----------
const BACK_TABS: { win: WindowKey; label: string }[] = [
  { win: 'today', label: 'Today' },
  { win: '7d',    label: '7d' },
  { win: '30d',   label: '30d' },
  { win: '90d',   label: '90d' },
  { win: 'ytd',   label: 'YTD' },
];
const FWD_TABS: { win: WindowKey; label: string }[] = [
  { win: 'next7',  label: 'Next 7' },
  { win: 'next30', label: 'Next 30' },
  { win: 'next90', label: 'Next 90' },
];

const CMP_OPTS: { v: CompareKey; label: string }[] = [
  { v: 'none', label: 'No comparison' },
  { v: 'pp',   label: 'vs Prior period' },
  { v: 'stly', label: 'vs Same time last year' },
];

const SEG_OPTS: { v: SegmentKey; label: string }[] = [
  { v: 'all',       label: 'All segments' },
  { v: 'leisure',   label: 'Leisure' },
  { v: 'group',     label: 'Group / MICE' },
  { v: 'wholesale', label: 'Wholesale' },
  { v: 'corporate', label: 'Corporate' },
  { v: 'honeymoon', label: 'Honeymoon' },
];

interface Props {
  /** When false, hides the forward window tabs (Next 7/30/90). Default true. */
  showForward?: boolean;
  /** When false, hides the compare dropdown. Default true. */
  showCompare?: boolean;
  /** When false, hides the segment dropdown. Default true. */
  showSegment?: boolean;
  /** Live-data badge text. */
  liveSource?: string;
}

export default function FilterStrip({
  showForward = true,
  showCompare = true,
  showSegment = true,
  liveSource = 'Cloudbeds · live',
}: Props) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();

  // Read current values from URL (lowercased; clamping happens on the server)
  const currentWin = (search.get('win') ?? '30d') as WindowKey;
  const currentCmp = (search.get('cmp') ?? 'none') as CompareKey;
  const currentSeg = (search.get('seg') ?? 'all') as SegmentKey;

  // Build href that preserves all other params
  const hrefWith = useMemo(() => (key: 'win' | 'cmp' | 'seg', value: string) => {
    const p = new URLSearchParams(search.toString());
    if (key === 'win' && value === '30d')  p.delete('win'); else if (key === 'win')  p.set('win',  value);
    if (key === 'cmp' && value === 'none') p.delete('cmp'); else if (key === 'cmp')  p.set('cmp',  value);
    if (key === 'seg' && value === 'all')  p.delete('seg'); else if (key === 'seg')  p.set('seg',  value);
    const qs = p.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, search]);

  const onSelect = (key: 'cmp' | 'seg') => (e: React.ChangeEvent<HTMLSelectElement>) => {
    router.push(hrefWith(key, e.target.value));
  };

  return (
    <div className="filter-strip">
      <span className="filter-label">Window</span>
      <div className="filter-group">
        {BACK_TABS.map((t) => (
          <Link
            key={t.win}
            href={hrefWith('win', t.win)}
            className={`filter-btn ${currentWin === t.win ? 'active' : ''}`}
          >
            {t.label}
          </Link>
        ))}
        {showForward && <span className="filter-divider" aria-hidden />}
        {showForward && FWD_TABS.map((t) => (
          <Link
            key={t.win}
            href={hrefWith('win', t.win)}
            className={`filter-btn fwd ${currentWin === t.win ? 'active' : ''}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {showCompare && (
        <>
          <span className="filter-divider" aria-hidden />
          <span className="filter-label">Compare</span>
          <select
            className={`filter-select ${currentCmp !== 'none' ? 'active' : ''}`}
            value={currentCmp}
            onChange={onSelect('cmp')}
            aria-label="Comparison period"
          >
            {CMP_OPTS.map((o) => (
              <option key={o.v} value={o.v}>{o.label}</option>
            ))}
          </select>
        </>
      )}

      {showSegment && (
        <>
          <span className="filter-divider" aria-hidden />
          <span className="filter-label">Segment</span>
          <select
            className={`filter-select ${currentSeg !== 'all' ? 'active' : ''}`}
            value={currentSeg}
            onChange={onSelect('seg')}
            aria-label="Market segment"
          >
            {SEG_OPTS.map((o) => (
              <option key={o.v} value={o.v}>{o.label}</option>
            ))}
          </select>
        </>
      )}

      <span className="filter-live">
        <span className="live-dot" />
        {liveSource}
      </span>
    </div>
  );
}
