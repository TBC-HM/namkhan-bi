// app/operations/staff/_components/DeptPicker.tsx
// PBS 2026-05-13 — department filter for the 3 staff trend charts.
// URL: ?dept=CODE (omitted = all departments).

'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export interface DeptOption {
  code: string;
  name: string;
  hc?: number;
}

export default function DeptPicker({
  options,
  selected,
}: {
  options: DeptOption[];
  /** Currently selected dept_code, or 'all'. */
  selected: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = new URLSearchParams(sp);
    if (e.target.value === 'all') next.delete('dept');
    else next.set('dept', e.target.value);
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <select
      value={selected}
      onChange={onChange}
      title="Filter charts by department"
      style={{
        fontFamily: 'var(--mono)',
        fontSize: 'var(--t-xs)',
        letterSpacing: 'var(--ls-extra)',
        textTransform: 'uppercase',
        padding: '6px 10px',
        background: 'var(--paper-warm, #f4ecd8)',
        color: 'var(--ink)',
        border: '1px solid var(--kpi-frame, rgba(168,133,74,0.45))',
        borderRadius: 4,
        cursor: 'pointer',
        minWidth: 180,
      }}
    >
      <option value="all">All departments</option>
      {options.map((d) => (
        <option key={d.code} value={d.code}>
          {d.name}{d.hc != null ? ` · ${d.hc}` : ''}
        </option>
      ))}
    </select>
  );
}
