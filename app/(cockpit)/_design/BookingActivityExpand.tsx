'use client';
// app/(cockpit)/_design/BookingActivityExpand.tsx
//
// PBS 2026-07-15: expand toggle for the BookingActivity ongoing feed.
// Pushes ?activityExpanded=1 into the URL so the server-rendered feed
// re-fetches with the full row set. Replaces the retired 1-7 day dropdown
// (BookingActivityDays.tsx) — the container is now a rolling activity
// stream, day-scoped tiles live in the Revenue HoD headline strip instead.

import Link from 'next/link';
import { useSearchParams, usePathname } from 'next/navigation';

interface Props {
  paramKey: string;
  expanded: boolean;
  totalRows: number;
  shownRows: number;
}

export default function BookingActivityExpand({
  paramKey, expanded, totalRows, shownRows,
}: Props) {
  const search = useSearchParams();
  const pathname = usePathname();
  const params = new URLSearchParams(search.toString());
  if (expanded) params.delete(paramKey);
  else params.set(paramKey, '1');
  const qs = params.toString();
  const href = qs ? `${pathname}?${qs}` : pathname;
  const label = expanded
    ? `Collapse (show latest 10)`
    : `Show all ${totalRows} events`;
  return (
    <Link
      href={href}
      style={{
        padding: '4px 12px',
        borderRadius: 4,
        border: '1px solid var(--hairline, #E6DFCC)',
        background: 'var(--paper, #FFFFFF)',
        color: 'var(--ink, #1B1B1B)',
        fontSize: 12,
        fontWeight: 500,
        fontFamily: 'inherit',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}
      aria-label={label}
      title={`${shownRows} of ${totalRows} shown`}
    >
      {label}
    </Link>
  );
}
