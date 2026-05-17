'use client';

// app/h/[property_id]/finance/pnl/YearDropdown.tsx
// Year selector for the Annual view panel. Navigates to ?year=YYYY
// preserving any other query params.

import { useRouter, useSearchParams } from 'next/navigation';

interface Props {
  current: string;
  years: string[];         // ordered list, e.g. ['2024','2025','2026']
  yearsWithData: string[]; // subset that actually have rows for the active property
}

export default function YearDropdown({ current, years, yearsWithData }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasData = new Set(yearsWithData);

  function go(year: string) {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.set('year', year);
    // When year changes, the previously-selected month belongs to the old year.
    // Drop ?month so the page falls back to the latest-with-data month of the new year.
    params.delete('month');
    router.push(`?${params.toString()}`);
  }

  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--t-sm)' }}>
      <span style={{ color: 'var(--tbl-fg-mute, rgba(26, 26, 26, 0.6))' }}>Year</span>
      <select
        value={current}
        onChange={(e) => go(e.target.value)}
        style={{
          padding: '4px 8px',
          borderRadius: 4,
          border: '1px solid var(--tbl-border-strong, rgba(26, 26, 26, 0.2))',
          background: 'var(--tbl-bg, #F5F0E4)',
          color: 'var(--tbl-fg, #1A1A1A)',
          fontSize: 'var(--t-sm)',
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}{hasData.has(y) ? '' : ' — no data'}
          </option>
        ))}
      </select>
    </label>
  );
}
