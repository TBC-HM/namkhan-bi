'use client';

import { useRouter, usePathname } from 'next/navigation';

const DEPARTMENTS = [
  { label: 'Revenue',    href: '/revenue' },
  { label: 'Sales',      href: '/sales' },
  { label: 'Marketing',  href: '/marketing' },
  { label: 'Operations', href: '/operations' },
  { label: 'Guest',      href: '/guest' },
  { label: 'Finance',    href: '/finance' },
  { label: 'IT',         href: '/it' },
];

export default function DeptDropdown() {
  const router = useRouter();
  const pathname = usePathname();

  const current = DEPARTMENTS.find((d) => pathname.startsWith(d.href)) ?? DEPARTMENTS[0];

  return (
    <select
      value={current.href}
      onChange={(e) => router.push(e.target.value)}
      style={{
        background: 'var(--surface-2, #1e1e2e)',
        color: 'var(--text-primary, #f0ede8)',
        border: '1px solid var(--border, #3a3a4a)',
        borderRadius: 6,
        padding: '6px 12px',
        fontSize: 14,
        fontFamily: 'inherit',
        cursor: 'pointer',
      }}
      aria-label="Switch department"
    >
      {DEPARTMENTS.map((d) => (
        <option key={d.href} value={d.href}>
          {d.label}
        </option>
      ))}
    </select>
  );
}
