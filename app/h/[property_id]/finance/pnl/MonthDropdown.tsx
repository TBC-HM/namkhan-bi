'use client';

// app/h/[property_id]/finance/pnl/MonthDropdown.tsx
// Month selector for the Monthly overview panel. Navigates to ?month=YYYY-MM
// preserving any other query params (notably ?year).

import { useRouter, useSearchParams } from 'next/navigation';

interface Props {
  /** Currently-selected period (YYYY-MM). */
  current: string;
  /** All months from Jan 2025 to the latest available month for this property. */
  options: string[];
  /** Subset of months that actually have rows. */
  monthsWithData: string[];
}

function fmtMonth(p: string): string {
  return new Date(p + '-01').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export default function MonthDropdown({ current, options, monthsWithData }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasData = new Set(monthsWithData);

  function go(month: string) {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.set('month', month);
    router.push(`?${params.toString()}`);
  }

  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--t-sm)' }}>
      <span style={{ color: 'var(--tbl-fg-mute, rgba(26, 26, 26, 0.6))' }}>Month</span>
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
        {options.map((p) => (
          <option key={p} value={p}>
            {fmtMonth(p)}{hasData.has(p) ? '' : ' — no data'}
          </option>
        ))}
      </select>
    </label>
  );
}
