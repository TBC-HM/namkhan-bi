'use client';

// app/_components/registry/TableFilterDropdown.tsx
// ADR-170 (2026-07-25) — generic URL-param filter <select> for registry tables
// (Source / Month dropdowns). Generalizes the PeriodDropdown pattern: no useState;
// pushes the chosen value into the URL preserving every other search param.
// Choosing 'all' removes the param entirely (URL stays canonical / deep-linkable).

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

interface Props {
  paramKey: string;                        // e.g. 'src_discount_discipline_transactions'
  allLabel: string;                        // e.g. 'All sources' / 'All months'
  options: string[];                       // distinct values from public.fn_table_filter_values
  active: string;                          // '' when no filter applied
  preserveParams: Record<string, string>;  // current URL params (server-supplied)
}

export default function TableFilterDropdown({
  paramKey, allLabel, options, active, preserveParams,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(value: string) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(preserveParams)) {
      if (k === paramKey) continue;
      if (v) sp.set(k, v);
    }
    if (value && value !== 'all') sp.set(paramKey, value);
    const qs = sp.toString();
    startTransition(() => router.push(qs ? `?${qs}` : '?', { scroll: false }));
  }

  return (
    <select
      value={active || 'all'}
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
        maxWidth: 200,
        cursor: pending ? 'wait' : 'pointer',
        opacity: pending ? 0.6 : 1,
      }}
    >
      <option value="all">{allLabel}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}
