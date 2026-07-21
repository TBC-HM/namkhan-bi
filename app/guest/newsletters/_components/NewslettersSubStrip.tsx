// app/guest/newsletters/_components/NewslettersSubStrip.tsx
// PBS 2026-07-21 pm (Add 2): 3-tab sub-strip inside Guest · Newsletters.
//   Broadcasts (default) · Lifecycle · Templates
// Mirrors the MediaHub tab pattern (padding 4px 8px, fontSize 12,
// gap 8, borderBottom 2px solid var(--primary, #1F3A2E) when active).
// Uses TenantLink so the tenant prefix (/h/{property_id}) is preserved.

import type { CSSProperties } from 'react';
import TenantLink from '@/components/nav/TenantLink';

export type NewslettersTabKey = 'broadcasts' | 'lifecycle' | 'templates';

interface Props { active: NewslettersTabKey }

const TABS: Array<{ key: NewslettersTabKey; label: string; href: string }> = [
  { key: 'broadcasts', label: 'Broadcasts', href: '/guest/newsletters'            },
  { key: 'lifecycle',  label: 'Lifecycle',  href: '/guest/newsletters/lifecycle'  },
  { key: 'templates',  label: 'Templates',  href: '/guest/newsletters/templates'  },
];

const HAIR    = '#E6DFCC';
const INK_M   = '#5A5A5A';
const PRIMARY = '#1F3A2E';

export default function NewslettersSubStrip({ active }: Props) {
  return (
    <nav
      role="tablist"
      aria-label="Newsletters sub-tabs"
      style={{
        gridColumn: '1 / -1',
        display: 'flex',
        gap: 8,
        borderBottom: '1px solid ' + HAIR,
        background: 'transparent',
        marginBottom: 8,
        fontFamily: 'inherit',
      }}
    >
      {TABS.map((t) => {
        const isActive = t.key === active;
        const style: CSSProperties = {
          padding: '4px 8px',
          fontSize: 12,
          fontWeight: isActive ? 700 : 500,
          color: isActive ? PRIMARY : INK_M,
          background: 'transparent',
          borderBottom: isActive
            ? `2px solid var(--primary, ${PRIMARY})`
            : '2px solid transparent',
          textDecoration: 'none',
          textTransform: 'none',
          letterSpacing: 0,
          marginBottom: -1,
          fontFamily: 'inherit',
        };
        return (
          <TenantLink
            key={t.key}
            href={t.href}
            role="tab"
            aria-selected={isActive}
            style={style}
          >
            {t.label}
          </TenantLink>
        );
      })}
    </nav>
  );
}
