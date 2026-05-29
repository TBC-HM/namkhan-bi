'use client';

// app/_components/registry/ChannelGstMonthDropdown.tsx
// PBS 2026-05-29 — month picker for the Gross Revenue Share by Tier full-page
// primitive. Pushes ?gst_month=YYYY-MM (or removes it for "All months").

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

interface Props {
  selectedMonth: string;
  months: string[];
  preserveParams?: Record<string, string | undefined>;
}

export default function ChannelGstMonthDropdown({ selectedMonth, months, preserveParams = {} }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(value: string) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(preserveParams)) {
      if (v) params.set(k, String(v));
    }
    if (value !== 'all') params.set('gst_month', value);
    const qs = params.toString();
    startTransition(() => router.push(qs ? `?${qs}#gst-tier` : '#gst-tier'));
  }

  const currentYm = new Date().toISOString().slice(0, 7);
  const realised = months.filter((m) => m <= currentYm);
  const future = months.filter((m) => m > currentYm);

  return (
    <select
      value={selectedMonth}
      onChange={(e) => onChange(e.target.value)}
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
        fontVariantNumeric: 'tabular-nums',
        cursor: pending ? 'wait' : 'pointer',
        opacity: pending ? 0.6 : 1,
      }}
    >
      <option value="all">All months (sum)</option>
      {realised.length > 0 && (
        <optgroup label="Realised">
          {realised.map((m) => (<option key={m} value={m}>{m}</option>))}
        </optgroup>
      )}
      {future.length > 0 && (
        <optgroup label="Future (OTB)">
          {future.map((m) => (<option key={m} value={m}>{m} · OTB</option>))}
        </optgroup>
      )}
    </select>
  );
}
