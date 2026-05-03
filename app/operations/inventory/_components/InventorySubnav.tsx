'use client';

// app/operations/inventory/_components/InventorySubnav.tsx
//
// Inventory & Suppliers internal sub-tab strip.
// Sits below the canonical SubNav (which has the operations pillar tabs)
// and gives users one-click navigation across the 5 inventory sub-pages
// without hunting in the quick-links grid.
//
// Pattern: brass-letterspaced mono pills. Active = paper-warm pill, others = paper bg.

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS: Array<{ href: string; label: string }> = [
  { href: '/operations/inventory',           label: 'Snapshot' },
  { href: '/operations/inventory/stock',     label: 'Stock' },
  { href: '/operations/inventory/par',       label: 'Par' },
  { href: '/operations/inventory/suppliers', label: 'Suppliers' },
  { href: '/operations/inventory/catalog',   label: 'Catalog' },
];

export default function InventorySubnav() {
  const pathname = usePathname() ?? '';
  return (
    <nav
      aria-label="Inventory sub-navigation"
      style={{
        display: 'flex',
        gap: 4,
        flexWrap: 'wrap',
        marginTop: 8,
        marginBottom: 4,
        paddingBottom: 6,
        borderBottom: '1px solid var(--line-soft, #d8cca8)',
      }}
    >
      {TABS.map((t) => {
        // /operations/inventory matches exactly; sub-routes match prefix on rest
        const active =
          t.href === '/operations/inventory'
            ? pathname === '/operations/inventory'
            : pathname === t.href || pathname.startsWith(t.href + '/');
        return (
          <Link
            key={t.href}
            href={t.href}
            style={{
              padding: '4px 10px',
              fontFamily: 'var(--mono)',
              fontSize: 'var(--t-xs)',
              letterSpacing: 'var(--ls-extra)',
              textTransform: 'uppercase',
              textDecoration: 'none',
              background: active ? 'var(--paper-warm)' : 'transparent',
              color: active ? 'var(--brass)' : 'var(--ink-mute)',
              border: '1px solid',
              borderColor: active ? 'var(--brass-soft, #c4a06b)' : 'transparent',
              borderRadius: 2,
              transition: 'background 120ms, color 120ms, border-color 120ms',
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
