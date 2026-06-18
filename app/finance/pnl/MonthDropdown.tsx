'use client';

// Month picker for /finance/pnl. Replaces the hardcoded "latest closed month".
// Updates ?month=YYYY-MM in the URL — the server component re-renders with the
// new month as `cur`. Designed to fail safe: if no value is selected the page
// falls back to its existing latest-closed-month auto-detection.

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

interface Props {
  /** Currently-selected month (YYYY-MM). Defaults to latest closed if not provided. */
  value: string;
  /** Months to render as options, oldest → newest (e.g., ['2026-01', ...]). */
  options: string[];
}

function fmtMonth(yyyymm: string): string {
  // PBS 2026-06-18 #226: quarter tokens like "2026-Q1" render as "Q1 2026"
  const qm = yyyymm.match(/^(\d{4})-Q([1-4])$/);
  if (qm) return `Q${qm[2]} ${qm[1]}`;
  const [y, m] = yyyymm.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export default function MonthDropdown({ value, options }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    const params = new URLSearchParams(sp?.toString() ?? '');
    if (next) params.set('month', next);
    else params.delete('month');
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'var(--mono)',
        fontSize: 'var(--t-xs)',
        letterSpacing: 'var(--ls-extra)',
        textTransform: 'uppercase',
        color: 'var(--ink-soft, #5A5A5A)',
      }}
    >
      Month
      <select
        value={value}
        onChange={onChange}
        style={{
          fontFamily: 'var(--sans)',
          fontSize: 'var(--t-sm)',
          letterSpacing: 0,
          textTransform: 'none',
          color: 'var(--ink, #1B1B1B)',
          background: 'var(--paper, #FFFFFF)',
          border: '1px solid var(--hairline, #E6DFCC)',
          borderRadius: 4,
          padding: '4px 8px',
          cursor: 'pointer',
        }}
      >
        {options.map((m) => (
          <option key={m} value={m}>{fmtMonth(m)}</option>
        ))}
      </select>
    </label>
  );
}
