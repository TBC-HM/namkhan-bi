'use client';

// app/(cockpit)/_design/BookingActivityDays.tsx
// 1-7 day dropdown for the BookingActivity container. Pushes the chosen
// window into the URL via ?activityDays= while preserving the rest of
// the search params. Task #82 · 2026-05-22.

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

interface Props {
  paramKey: string;
  current: number;
}

const OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: 'Today' },
  { value: 2, label: 'Last 2 days' },
  { value: 3, label: 'Last 3 days' },
  { value: 7, label: 'Last 7 days' },
];

export default function BookingActivityDays({ paramKey, current }: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();

  function onChange(value: number) {
    const params = new URLSearchParams(search.toString());
    if (value === 1) params.delete(paramKey);
    else params.set(paramKey, String(value));
    const qs = params.toString();
    startTransition(() => router.push(qs ? `?${qs}` : '?'));
  }

  return (
    <select
      value={current}
      onChange={(e) => onChange(Number(e.target.value))}
      disabled={pending}
      style={{
        padding: '4px 12px',
        borderRadius: 4,
        border: '1px solid var(--hairline, #E6DFCC)',
        background: 'var(--paper, #FFFFFF)',
        color: 'var(--ink, #1B1B1B)',
        fontSize: 12,
        fontWeight: 500,
        fontFamily: 'inherit',
        cursor: pending ? 'wait' : 'pointer',
        opacity: pending ? 0.6 : 1,
      }}
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
