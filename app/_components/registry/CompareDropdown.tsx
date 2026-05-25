'use client';

// app/_components/registry/CompareDropdown.tsx
// USALI task #9 — Comparison-source selector for ContainerRoomIntel.
// SDLY  → same-period last year (current default behaviour)
// BUDGET → finance.gl_budgets per-room-category (view pending; backend short-circuits to empty SDLY rows until live)

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

interface Props {
  activeCmp: string;
  preserveParams?: Record<string, string | undefined>;
}

const OPTIONS: { value: string; label: string }[] = [
  { value: 'sdly', label: 'vs SDLY' },
  { value: 'budget', label: 'vs Budget' },
];

export default function CompareDropdown({ activeCmp, preserveParams = {} }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(value: string) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(preserveParams)) {
      if (v) params.set(k, String(v));
    }
    if (value && value !== 'sdly') params.set('cmp', value);
    const qs = params.toString();
    startTransition(() => router.push(qs ? `?${qs}` : '?'));
  }

  return (
    <select
      value={activeCmp || 'sdly'}
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
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
