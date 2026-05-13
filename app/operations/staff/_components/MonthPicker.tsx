// app/operations/staff/_components/MonthPicker.tsx
// PBS 2026-05-13 — month dropdown for Department breakdown. Pushes
// ?month=YYYY-MM-01 to the URL, server re-renders the page scoped to that month.

'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function fmtPeriodLabel(iso: string): string {
  const [y, m] = iso.split('-');
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
}

export default function MonthPicker({
  months,
  selected,
}: {
  /** Available months in `YYYY-MM-01` format, newest first. */
  months: string[];
  selected: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = new URLSearchParams(sp);
    next.set('month', e.target.value);
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <select
      value={selected}
      onChange={onChange}
      title="Period"
      style={{
        fontFamily: 'var(--mono)',
        fontSize: 'var(--t-xs)',
        letterSpacing: 'var(--ls-extra)',
        textTransform: 'uppercase',
        padding: '6px 10px',
        background: 'var(--surf-1, #fbf9f2)',
        color: 'var(--ink)',
        border: '1px solid var(--kpi-frame, rgba(168,133,74,0.45))',
        borderRadius: 4,
        cursor: 'pointer',
      }}
    >
      {months.map((m) => (
        <option key={m} value={m}>{fmtPeriodLabel(m)}</option>
      ))}
    </select>
  );
}
