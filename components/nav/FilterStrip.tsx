// components/nav/FilterStrip.tsx
// Period filter strip below sub-nav. Shows windows (Today/7d/30d/90d/YTD), dates, live status.
// Currently a static visual; URL params not wired (per session: PeriodBar broken).
// Server component. Period state lives in URL (?win=30d) — links handled here.

import Link from 'next/link';

const WINDOWS: { key: string; label: string; days: number }[] = [
  { key: 'today', label: 'Today', days: 1 },
  { key: '7d',    label: '7d',    days: 7 },
  { key: '30d',   label: '30d',   days: 30 },
  { key: '90d',   label: '90d',   days: 90 },
  { key: 'ytd',   label: 'YTD',   days: 0 },
];

interface Props {
  currentWin?: string;
  baseHref: string;             // e.g. '/overview' — preserves the page on filter click
  rangeLabel?: string;          // e.g. '23 → 29 Apr 2026'
  liveSource?: string;          // e.g. 'Cloudbeds · live'
}

export default function FilterStrip({
  currentWin = '30d',
  baseHref,
  rangeLabel,
  liveSource = 'Cloudbeds · live',
}: Props) {
  return (
    <div className="filter-strip">
      <span>Window:</span>
      <div className="filter-group">
        {WINDOWS.map((w) => (
          <Link
            key={w.key}
            href={`${baseHref}?win=${w.key}`}
            className={`filter-btn ${currentWin === w.key ? 'active' : ''}`}
          >
            {w.label}
          </Link>
        ))}
      </div>
      {rangeLabel && (
        <>
          <span className="filter-divider">·</span>
          <span>{rangeLabel}</span>
        </>
      )}
      <span className="filter-live">
        <span className="live-dot" />
        {liveSource}
      </span>
    </div>
  );
}
