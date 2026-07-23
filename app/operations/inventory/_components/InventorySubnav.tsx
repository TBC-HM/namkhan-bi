'use client';

// app/operations/inventory/_components/InventorySubnav.tsx
//
// Inventory & Procurement internal sub-tab strip.
// PBS 2026-07-23: expanded from 5 → 12 tabs to expose all built pages.
// Two groups separated by a visual divider:
//   Stock side: Snapshot · Stock · Par · Counts · Items
//   Procurement side: Shop → Requests → Orders
//   Reference: Catalog · Suppliers · Assets · Capex
//
// All routes use TenantLink so /h/[property_id] prefix is injected automatically.

import TenantLink from '@/components/nav/TenantLink';
import { usePathname } from 'next/navigation';

type Tab = { href: string; label: string };

const STOCK_TABS: Tab[] = [
  { href: '/operations/inventory',              label: 'Snapshot' },
  { href: '/operations/inventory/stock',        label: 'Stock' },
  { href: '/operations/inventory/par',          label: 'Par' },
  { href: '/operations/inventory/counts',       label: 'Counts' },
  { href: '/operations/inventory/items',        label: 'Items' },
];

const PROCUREMENT_TABS: Tab[] = [
  { href: '/operations/inventory/shop',         label: 'Shop' },
  { href: '/operations/inventory/requests',     label: 'Requests' },
  { href: '/operations/inventory/orders',       label: 'Orders' },
];

const REFERENCE_TABS: Tab[] = [
  { href: '/operations/inventory/catalog',      label: 'Catalog' },
  { href: '/operations/inventory/suppliers',    label: 'Suppliers' },
  { href: '/operations/inventory/assets',       label: 'Assets' },
  { href: '/operations/inventory/capex',        label: 'Capex' },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/operations/inventory') return pathname === href || pathname === href + '/';
  return pathname === href || pathname.startsWith(href + '/');
}

function TabGroup({ tabs, pathname }: { tabs: Tab[]; pathname: string }) {
  return (
    <>
      {tabs.map((t) => {
        const active = isActive(pathname, t.href);
        return (
          <TenantLink
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
          </TenantLink>
        );
      })}
    </>
  );
}

const divider: React.CSSProperties = {
  width: 1,
  height: 18,
  background: 'var(--line-soft, #d8cca8)',
  alignSelf: 'center',
  margin: '0 4px',
};

export default function InventorySubnav() {
  const pathname = usePathname() ?? '';
  return (
    <nav
      aria-label="Inventory sub-navigation"
      style={{
        display: 'flex',
        gap: 4,
        flexWrap: 'wrap',
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 4,
        paddingBottom: 6,
        borderBottom: '1px solid var(--line-soft, #d8cca8)',
      }}
    >
      <TabGroup tabs={STOCK_TABS} pathname={pathname} />
      <div style={divider} />
      <TabGroup tabs={PROCUREMENT_TABS} pathname={pathname} />
      <div style={divider} />
      <TabGroup tabs={REFERENCE_TABS} pathname={pathname} />
    </nav>
  );
}
