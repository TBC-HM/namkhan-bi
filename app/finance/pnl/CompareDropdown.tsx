'use client';

// Comparison-mode dropdown for the main USALI schedule grid.
// Writes ?compare=budget|forecast|ly to the URL — server component re-renders
// with the selected scenario as the comparison column.

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export type CompareMode = 'budget' | 'forecast' | 'ly';

interface Props {
  value: CompareMode;
}

const LABELS: Record<CompareMode, string> = {
  budget:   'Budget',
  forecast: 'Forecast',
  ly:       'Last Year',
};

export default function CompareDropdown({ value }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as CompareMode;
    const params = new URLSearchParams(sp?.toString() ?? '');
    if (next === 'budget') params.delete('compare');
    else params.set('compare', next);
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
        color: 'var(--brass)',
      }}
    >
      Compare vs
      <select
        value={value}
        onChange={onChange}
        style={{
          fontFamily: 'var(--sans)',
          fontSize: 'var(--t-sm)',
          letterSpacing: 0,
          textTransform: 'none',
          color: 'var(--ink)',
          background: 'var(--surf-2, #f5f1e7)',
          border: '1px solid var(--rule, #d6cfb8)',
          borderRadius: 4,
          padding: '4px 8px',
          cursor: 'pointer',
        }}
      >
        {(['budget','forecast','ly'] as CompareMode[]).map(m => (
          <option key={m} value={m}>{LABELS[m]}</option>
        ))}
      </select>
    </label>
  );
}
