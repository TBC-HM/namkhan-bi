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
  const current = DEPARTMENTS.find(d => pathname.startsWith(d.href))?.label ?? 'Department';

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <select
        value={current}
        onChange={e => {
          const dept = DEPARTMENTS.find(d => d.label === e.target.value);
          if (dept) router.push(dept.href);
        }}
        style={{
          fontFamily: 'var(--sans)',
          fontSize: 'var(--t-md)',
          background: 'var(--surface)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '6px 12px',
          cursor: 'pointer',
          appearance: 'none',
          paddingRight: 28,
        }}
      >
        {DEPARTMENTS.map(d => (
          <option key={d.href} value={d.label}>{d.label}</option>
        ))}
      </select>
      <span style={{
        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
        pointerEvents: 'none', fontSize: 10, color: 'var(--muted)',
      }}>▾</span>
    </div>
  );
}
