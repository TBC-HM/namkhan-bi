// app/finance/_components/TabStrip.tsx
//
// Shared finance-area tab strip. Used to consolidate sibling pages under a
// single top-line menu entry without merging their data-fetch logic.
//
//   • /finance/transactions ↔ /finance/pos               (Transactions hub)
//   • /finance/pnl          ↔ /finance/budget            (P&L hub)
//   • /finance/messy-data   ↔ /finance/mapping
//                           ↔ /finance/supplier-mapping  (Messy-data hub)

import TenantLink from '@/components/nav/TenantLink';
export interface TabSpec { label: string; href: string; key: string }

export default function TabStrip({
  tabs, activeKey,
}: { tabs: TabSpec[]; activeKey: string }) {
  return (
    <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--paper-deep)', marginBottom: 12 }}>
      {tabs.map((t) => {
        const active = t.key === activeKey;
        return (
          <TenantLink
            key={t.key}
            href={t.href}
            style={{
              padding: '10px 20px',
              fontFamily: 'var(--mono)',
              fontSize: 'var(--t-xs)',
              letterSpacing: 'var(--ls-extra)',
              textTransform: 'uppercase',
              textDecoration: 'none',
              fontWeight: active ? 700 : 500,
              color: active ? 'var(--brass)' : 'var(--ink-soft)',
              borderBottom: active ? '2px solid var(--brass)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t.label}
          </TenantLink>
        );
      })}
    </div>
  );
}

// ─── Canonical hub-tab sets ────────────────────────────────────────────
export const TRANSACTIONS_TABS: TabSpec[] = [
  { key: 'folio', label: 'Folio audit · PMS', href: '/finance/transactions' },
  { key: 'pos',   label: 'POS',                     href: '/finance/pos' },
];

// PBS 2026-05-15: Acc hub consolidates Transactions + Banks + POS under one
// submenu button. Rendered at the top of all 3 pages.
//
// PBS 2026-05-16: property-aware. accTabs(propertyId) returns property-scoped
// hrefs so Donna's Banks tab routes to /h/1000001/finance/banks, not Namkhan's.
// Namkhan default = 260955 — keeps the un-prefixed /finance/* URLs.
export function accTabs(propertyId: number = 260955): TabSpec[] {
  const base = propertyId === 260955 ? '/finance' : `/h/${propertyId}/finance`;
  return [
    { key: 'transactions', label: 'Transactions · PMS', href: `${base}/transactions` },
    { key: 'banks',        label: 'Banks',              href: `${base}/banks`        },
    { key: 'pos',          label: 'POS',                href: `${base}/pos`          },
  ];
}

// Back-compat (called by 3 Namkhan-default pages). Equivalent to accTabs(260955).
export const ACC_TABS: TabSpec[] = [
  { key: 'transactions', label: 'Transactions · PMS', href: '/finance/transactions' },
  { key: 'banks',        label: 'Banks',              href: '/finance/banks'        },
  { key: 'pos',          label: 'POS',                href: '/finance/pos'          },
];

export const PNL_TABS: TabSpec[] = [
  { key: 'pnl',    label: 'P&L',    href: '/finance/pnl' },
  { key: 'budget', label: 'Budget', href: '/finance/budget' },
];

export const MESSY_TABS: TabSpec[] = [
  { key: 'overview',  label: 'Overview · gaps',     href: '/finance/messy-data' },
  { key: 'accounts',  label: 'Account mapping',     href: '/finance/mapping' },
  { key: 'suppliers', label: 'Supplier mapping',    href: '/finance/supplier-mapping' },
];

// PBS 2026-05-16: Marketing Info hub consolidates 4 sibling pages under one
// submenu button. Rendered at the top of each page (Library / Events /
// Audiences / Taxonomy). Same pattern as ACC_TABS / PNL_TABS.
export const INFO_TABS: TabSpec[] = [
  { key: 'library',   label: 'Library',    href: '/marketing/library'   },
  { key: 'events',    label: 'Events',     href: '/marketing/events'    },
  { key: 'audiences', label: 'Audiences',  href: '/marketing/audiences' },
  { key: 'taxonomy',  label: 'Taxonomy',   href: '/marketing/taxonomy'  },
];

// PBS 2026-05-16: Marketing Web hub consolidates Website + Funnels + SEO
// under one submenu button. Rendered at the top of each of the 3 pages.
export const WEB_TABS: TabSpec[] = [
  { key: 'web',     label: 'Web · Booking',     href: '/marketing/web'     },
  { key: 'funnels', label: 'Funnels',           href: '/marketing/funnels' },
  { key: 'seo',     label: 'SEO · Auto-blog',   href: '/marketing/seo'     },
];

// PBS 2026-05-16: Marketing Social hub consolidates Social channels +
// Influencer portfolio under one submenu button. 2-tab strip.
export const SOCIAL_TABS: TabSpec[] = [
  { key: 'social',      label: 'Social channels',  href: '/marketing/social'      },
  { key: 'influencers', label: 'Influencers',      href: '/marketing/influencers' },
];
