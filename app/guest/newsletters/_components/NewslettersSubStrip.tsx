// app/guest/newsletters/_components/NewslettersSubStrip.tsx
// PBS 2026-07-21 pm (Add 2, follow-up): 6-tab sub-strip inside Guest · Newsletters.
//   Overview · Broadcasts (newsletters) · Lifecycle · Sequences · Templates · Director
//
// Accepts either the legacy key ('newsletters' — from fbf468da) or the new
// 'broadcasts' key to point at the same URL. That keeps every caller working
// whether they were restored from fbf468da or added in the Add-2 rollout.
// Mirrors the MediaHub tab pattern (padding 4px 8px, fontSize 12, gap 8,
// borderBottom 2px solid var(--primary, #1F3A2E) when active). Uses TenantLink
// so the tenant prefix (/h/{property_id}) is preserved.

import type { CSSProperties } from 'react';
import TenantLink from '@/components/nav/TenantLink';

export type NewslettersTabKey =
  | 'overview'
  | 'newsletters'   // legacy alias for 'broadcasts' (fbf468da)
  | 'broadcasts'
  | 'lifecycle'
  | 'sequences'
  | 'templates'
  | 'director';

interface Props { active: NewslettersTabKey }

const TABS: Array<{ key: NewslettersTabKey; label: string; href: string; aliases?: NewslettersTabKey[] }> = [
  { key: 'overview',    label: 'Overview',    href: '/guest/newsletters'                    },
  { key: 'broadcasts',  label: 'Broadcasts',  href: '/guest/newsletters?tab=broadcasts',
    aliases: ['newsletters'] },
  { key: 'lifecycle',   label: 'Lifecycle',   href: '/guest/newsletters/lifecycle'          },
  { key: 'sequences',   label: 'Sequences',   href: '/guest/newsletters/sequences'          },
  { key: 'templates',   label: 'Templates',   href: '/guest/newsletters/templates'          },
  { key: 'director',    label: 'Director',    href: '/guest/newsletters/director'           },
];

const HAIR    = '#E6DFCC';
const INK_M   = '#5A5A5A';
const PRIMARY = '#1F3A2E';

function isActive(tab: (typeof TABS)[number], active: NewslettersTabKey): boolean {
  if (tab.key === active) return true;
  if (tab.aliases && tab.aliases.indexOf(active) !== -1) return true;
  return false;
}

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
        const activeNow = isActive(t, active);
        const style: CSSProperties = {
          padding: '4px 8px',
          fontSize: 12,
          fontWeight: activeNow ? 700 : 500,
          color: activeNow ? PRIMARY : INK_M,
          background: 'transparent',
          borderBottom: activeNow
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
            aria-selected={activeNow}
            style={style}
          >
            {t.label}
          </TenantLink>
        );
      })}
    </nav>
  );
}
