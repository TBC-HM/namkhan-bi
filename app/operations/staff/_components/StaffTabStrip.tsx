// app/operations/staff/_components/StaffTabStrip.tsx
// PBS 2026-05-13 — internal tab strip inside the Staff page.
// Tabs: Register · Attendance · Schedule. Routes preserve propertyId.

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Tab { label: string; slug: '' | 'attendance' | 'schedule'; }
const TABS: Tab[] = [
  { label: 'Register',   slug: ''           },
  { label: 'Attendance', slug: 'attendance' },
  { label: 'Schedule',   slug: 'schedule'   },
];

export default function StaffTabStrip({ propertyId }: { propertyId: number }) {
  const pathname = usePathname() ?? '/operations/staff';
  const base = propertyId === 260955 ? '/operations/staff' : `/h/${propertyId}/operations/staff`;

  const activeSlug: Tab['slug'] =
    pathname.endsWith('/attendance') ? 'attendance' :
    pathname.endsWith('/schedule')   ? 'schedule'   :
    '';

  return (
    <nav style={{
      display: 'flex', gap: 2, marginTop: 14, marginBottom: 6,
      borderBottom: '1px solid var(--kpi-frame, rgba(168,133,74,0.45))',
    }}>
      {TABS.map((t) => {
        const href = t.slug === '' ? base : `${base}/${t.slug}`;
        const active = t.slug === activeSlug;
        return (
          <Link key={t.slug || 'register'} href={href} style={{
            padding: '8px 16px',
            fontFamily: 'var(--mono)', fontSize: 11,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            color: active ? 'var(--ink)' : 'var(--ink-mute)',
            background: active ? 'var(--paper-warm)' : 'transparent',
            borderTop: active ? '1px solid var(--kpi-frame)' : '1px solid transparent',
            borderLeft: active ? '1px solid var(--kpi-frame)' : '1px solid transparent',
            borderRight: active ? '1px solid var(--kpi-frame)' : '1px solid transparent',
            borderBottom: active ? '1px solid var(--paper-warm)' : 'none',
            marginBottom: -1, borderRadius: '4px 4px 0 0',
            textDecoration: 'none', fontWeight: active ? 600 : 400,
          }}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
