'use client';

// app/revenue/pickup/_components/MatrixYearDropdown.tsx
// PBS 2026-08-25 — stay-year selector for the "OTB · Pickup · Comparison · SDLY"
// matrix. Navigates to ?matrixYear=YYYY preserving every other query param.
//
// Pattern mirrors app/h/[property_id]/finance/pnl/YearDropdown.tsx. Scope is the
// MATRIX ONLY — the KPI strip and the four charts above it keep their own
// forward-looking windows and are untouched by this control.

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

interface Props {
  current: number;
  years: number[];
}

export default function MatrixYearDropdown({ current, years }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function go(year: string) {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.set('matrixYear', year);
    startTransition(() => router.push(`?${params.toString()}`, { scroll: false }));
  }

  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <span style={{ color: 'var(--ink-soft, #5A5A5A)' }}>Year</span>
      <select
        value={String(current)}
        onChange={(e) => go(e.target.value)}
        disabled={pending}
        aria-label="Pickup matrix stay year"
        style={{
          padding: '4px 10px',
          borderRadius: 4,
          border: '1px solid var(--hairline, #E0E0E0)',
          background: 'var(--paper, #FFFFFF)',
          color: 'var(--ink, #1B1B1B)',
          fontSize: 12,
          fontWeight: 500,
          fontFamily: 'inherit',
          fontVariantNumeric: 'tabular-nums',
          cursor: pending ? 'wait' : 'pointer',
        }}
      >
        {years.map((y) => (
          <option key={y} value={String(y)}>{y}</option>
        ))}
      </select>
    </label>
  );
}
