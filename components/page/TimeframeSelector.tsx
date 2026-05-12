// components/page/TimeframeSelector.tsx
// PBS 2026-05-09 (new task): "In the pulse area I need the option to change
// the time frames like last 7 last 30 last qtr std".
// Lightweight server component — emits anchor links that swap ?win= on the
// current path. Drop into any /revenue/* (or other) page that uses
// resolvePeriod() from lib/period.ts.

import Link from 'next/link';

interface Option {
  win: string;
  label: string;
}

const DEFAULT_OPTIONS: Option[] = [
  { win: 'today',  label: 'Today' },
  { win: '7d',     label: '7d' },
  { win: '30d',    label: '30d' },
  { win: '90d',    label: '90d' },
  { win: 'ytd',    label: 'YTD' },
  { win: 'l12m',   label: '12m' },
];

const FORWARD_OPTIONS: Option[] = [
  { win: 'next7',   label: 'Next 7d' },
  { win: 'next30',  label: 'Next 30d' },
  { win: 'next90',  label: 'Next 90d' },
];

interface Props {
  /** Current pathname (e.g. "/revenue/pulse") so links preserve route. */
  basePath: string;
  /** Currently selected window key from resolvePeriod (period.win). */
  active: string;
  /** Custom option set. Defaults to back-looking windows. */
  options?: Option[];
  /** Show the forward-looking next7/30/90 windows alongside. */
  includeForward?: boolean;
  /** Other URL params to preserve when switching window. */
  preserve?: Record<string, string | undefined>;
}

export default function TimeframeSelector({
  basePath,
  active,
  options = DEFAULT_OPTIONS,
  includeForward,
  preserve,
}: Props) {
  const all = includeForward ? [...options, ...FORWARD_OPTIONS] : options;
  return (
    <div style={{
      display: 'inline-flex',
      gap: 0,
      border: '1px solid var(--border-2b, #2a2520)',
      borderRadius: 4,
      overflow: 'hidden',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 11,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
    }}>
      {all.map((o) => {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(preserve ?? {})) {
          if (v != null && v !== '') params.set(k, String(v));
        }
        params.set('win', o.win);
        const isActive = active === o.win;
        return (
          <Link
            key={o.win}
            href={`${basePath}?${params.toString()}`}
            prefetch={false}
            style={{
              padding: '6px 10px',
              background: isActive ? 'var(--accent, #a8854a)' : 'transparent',
              color: isActive ? 'var(--surf-0, #0a0a0a)' : 'var(--text-2, #d8cca8)',
              borderRight: '1px solid var(--border-2b, #2a2520)',
              textDecoration: 'none',
              fontWeight: isActive ? 700 : 600,
            }}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}
