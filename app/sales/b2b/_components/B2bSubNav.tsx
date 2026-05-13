// app/sales/b2b/_components/B2bSubNav.tsx
// Sub-tab nav for B2B/DMC: Contracts · Reconciliation · Performance.
// Drill-down (/sales/b2b/partner/[id]) opens via row click, not nav.
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/sales/b2b',                label: 'Contracts' },
  { href: '/sales/b2b/reconciliation', label: 'Reconciliation', badge: 12 },
  { href: '/sales/b2b/performance',    label: 'Performance' },
];

export default function B2bSubNav() {
  const path = usePathname();
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        borderBottom: '1px solid #e6dfc9',
        margin: '14px 0 18px',
      }}
    >
      {TABS.map((t) => {
        const active = path === t.href || (t.href === '/sales/b2b' && path === '/sales/b2b/contracts');
        return (
          <Link
            key={t.href}
            href={t.href}
            style={{
              padding: '8px 14px',
              fontSize: "var(--t-md)",
              color: active ? '#4a4538' : '#8a8170',
              borderBottom: active ? '2px solid #a17a4f' : '2px solid transparent',
              textDecoration: 'none',
              fontWeight: active ? 600 : 400,
              marginBottom: -1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {t.label}
            {t.badge ? (
              <span
                style={{
                  background: 'var(--st-warn-bg)',
                  border: '1px solid #f3d57a',
                  color: '#5e4818',
                  borderRadius: 10,
                  padding: '1px 7px',
                  fontSize: "var(--t-xs)",
                  fontWeight: 600,
                }}
              >
                {t.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
