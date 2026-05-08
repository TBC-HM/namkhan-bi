'use client';

import { useRouter, usePathname } from 'next/navigation';

export type Department =
  | 'Revenue'
  | 'Finance'
  | 'Guest'
  | 'Operations'
  | 'HR';

const DEPT_ROUTES: Record<Department, string> = {
  Revenue:    '/revenue',
  Finance:    '/finance',
  Guest:      '/guest',
  Operations: '/operations',
  HR:         '/hr',
};

const DEPARTMENTS: Department[] = [
  'Revenue',
  'Finance',
  'Guest',
  'Operations',
  'HR',
];

interface DeptDropdownProps {
  /** Override the active department label. Defaults to path-detected value. */
  value?: Department;
  /** Called with the newly selected department. */
  onChange?: (dept: Department) => void;
}

/**
 * DeptDropdown — shared nav component.
 * Renders a <select> pre-selected to the current pillar and navigates on change.
 * Can be overridden via value/onChange for controlled usage.
 */
export default function DeptDropdown({ value, onChange }: DeptDropdownProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Detect active dept from URL if not controlled
  const detected = (Object.keys(DEPT_ROUTES) as Department[]).find((d) =>
    pathname.startsWith(DEPT_ROUTES[d])
  );
  const active = value ?? detected ?? 'Revenue';

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const dept = e.target.value as Department;
    if (onChange) {
      onChange(dept);
    } else {
      router.push(DEPT_ROUTES[dept]);
    }
  }

  return (
    <select
      value={active}
      onChange={handleChange}
      aria-label="Switch department"
      style={{
        fontFamily: 'var(--sans, "Inter Tight", sans-serif)',
        fontSize: 'var(--t-md, 13px)',
        letterSpacing: 'var(--ls-tight, -0.01em)',
        background: 'transparent',
        border: '1px solid rgba(255,255,255,0.25)',
        borderRadius: 6,
        padding: '4px 10px',
        color: 'inherit',
        cursor: 'pointer',
        outline: 'none',
      }}
    >
      {DEPARTMENTS.map((dept) => (
        <option key={dept} value={dept}>
          {dept}
        </option>
      ))}
    </select>
  );
}
