'use client';

// components/nav/TopNav.tsx
// Main horizontal navigation strip rendered inside the Banner on every
// Banner-shell page (cockpit, /h/[id]/*, /today, /actions, /knowledge,
// /settings, etc.).
//
// History:
//   • 2026-05-08 — restored after working-tree rollback dropped it.
//   • 2026-05-13 (PBS Apple note #18) — TopNav now lives inside <Banner>
//     so it persists on every page. Session scope filtering added: HOD
//     users only see pillars mapped to their departments. Holding /
//     property roles see all items. Failure to resolve scope is
//     fail-open (show everything).
//
// ND button (deploy feed) intentionally retained on the right edge —
// see components/nav/NDButton.tsx.

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import NDButton from './NDButton';

interface TopNavItem {
  href: string;
  title: string;
  sub: string;
  // 2026-05-13 — HOD-level visibility key. If `deptKeys` is set, the item
  // shows only when the user's ops.departments codes include at least one
  // entry. Empty / undefined => always visible.
  deptKeys?: string[];
}

type ScopeShape = {
  roleLevel: 'holding' | 'property' | 'hod';
  isAllProperties: boolean;
  propertyIds: number[];
  deptIds: string[];
};

// PBS 2026-05-09: /agents stripped — agents are only reachable via /cockpit.
// Pages still exist for direct URL access.
// PBS 2026-07-06 evening: order is Overview · Today · Actions · Revenue · Marketing · Contacts · Operations · Finance.
// Contacts is the renamed Guest area — inserted between Marketing and Operations.
const ITEMS: TopNavItem[] = [
  { href: '/overview',    title: 'Overview',          sub: 'Owner' },
  { href: '/today',       title: "Today's Snapshot",  sub: 'Operations',         deptKeys: ['front_office','housekeeping','kitchen','spa','maintenance','grounds','boat','activities','roots_service','security'] },
  { href: '/actions',     title: 'Action Plans',      sub: 'Recommendations' },
  { href: '/revenue',     title: 'Revenue',           sub: 'Management',         deptKeys: ['revenue','sales_marketing'] },
  { href: '/marketing',   title: 'Marketing',         sub: 'Channels · Reviews', deptKeys: ['marketing','sales_marketing'] },
  { href: '/guest',       title: 'Contacts',          sub: 'Guests · Prospects', deptKeys: ['sales_marketing','marketing','guest'] },
  { href: '/departments', title: 'Operations',        sub: 'F&B · Spa · Activities', deptKeys: ['front_office','housekeeping','kitchen','spa','maintenance','grounds','boat','activities','roots_service','security'] },
  { href: '/finance',     title: 'Finance',           sub: 'P&L · Budget · Ledger', deptKeys: ['finance'] },
];

export default function TopNav() {
  const pathname = usePathname() ?? '/';
  const sp = useSearchParams();
  const qs = sp.toString();

  // 2026-05-13 — session scope plumbing. Mirrors the (now-removed) NDropdown
  // dept filtering so HOD users still see only their pillars in TopNav.
  const [scope, setScope] = useState<ScopeShape | null>(null);
  const [hodDeptCodes, setHodDeptCodes] = useState<string[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/session/scope', { cache: 'no-store' });
        if (!r.ok) return;
        const s = await r.json();
        if (cancelled) return;
        setScope(s);
        if (s?.roleLevel === 'hod' && Array.isArray(s.deptIds) && s.deptIds.length > 0) {
          const r2 = await fetch(
            '/api/session/dept-codes?ids=' + encodeURIComponent(s.deptIds.join(',')),
            { cache: 'no-store' }
          );
          if (r2.ok) {
            const j = await r2.json();
            if (!cancelled) setHodDeptCodes(Array.isArray(j.codes) ? j.codes : []);
          }
        }
      } catch {
        /* fail-open: keep all items visible */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const visibleItems = (() => {
    // Holding & property roles see everything; only HOD is scoped.
    if (!scope || scope.roleLevel !== 'hod') return ITEMS;
    if (!hodDeptCodes || hodDeptCodes.length === 0) return ITEMS; // until resolved, fail-open
    const set = new Set(hodDeptCodes);
    // Items without deptKeys are utility — always visible (Overview, Action Plans).
    return ITEMS.filter((it) => !it.deptKeys || it.deptKeys.some((k) => set.has(k)));
  })();

  return (
    <div className="top-menu" role="navigation" aria-label="Primary">
      <nav className="top-menu-items">
        {visibleItems.map((it) => {
          const active = pathname.startsWith(it.href);
          const href = qs ? `${it.href}?${qs}` : it.href;
          return (
            <Link key={it.href} href={href} className={active ? 'top-menu-link active' : 'top-menu-link'}>
              <span className="top-menu-title">{it.title}</span>
              <span className="top-menu-sub">{it.sub}</span>
            </Link>
          );
        })}
      </nav>
      <div className="top-menu-aside">
        <NDButton />
      </div>
    </div>
  );
}
