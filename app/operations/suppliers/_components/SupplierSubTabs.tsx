// app/operations/suppliers/_components/SupplierSubTabs.tsx
// Shared sub-strip for supplier surfaces. Used by both operations/suppliers
// and finance/suppliers — caller passes its own tabs.
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const HAIR = '#E6DFCC'; const INK_M = '#5A5A5A'; const FOREST = '#084838';

interface Tab { key: string; label: string; href: string }

export default function SupplierSubTabs({ tabs }: { tabs: Tab[] }) {
  const path = usePathname();
  return (
    <div style={{
      display: 'flex', gap: 4, gridColumn: '1 / -1',
      borderBottom: `2px solid ${HAIR}`, marginBottom: 4,
    }}>
      {tabs.map(t => {
        const active = path === t.href || (t.href !== '/' && path.startsWith(t.href + '/'));
        return (
          <Link key={t.key} href={t.href} style={{
            padding: '7px 16px', fontSize: 12, letterSpacing: '.05em',
            textTransform: 'uppercase', textDecoration: 'none',
            color: active ? FOREST : INK_M,
            borderBottom: active ? `2px solid ${FOREST}` : '2px solid transparent',
            fontWeight: active ? 700 : 500, marginBottom: -2,
          }}>{t.label}</Link>
        );
      })}
    </div>
  );
}
