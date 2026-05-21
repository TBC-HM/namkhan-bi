// lib/dept-cfg/rewrite-subpages.ts
// PBS 2026-05-13 — utility to rewrite top-level subPages hrefs to be
// property-scoped on /h/[property_id]/* routes. Also FILTERS out hrefs
// without a property-scoped route so clicking a tab never drops user
// back to Namkhan.

import { NAMKHAN_PROPERTY_ID } from './by-property';

export interface SubPage {
  label: string;
  href: string;
}

/**
 * Hrefs that DO have a property-scoped page at /h/[id]/...
 * Update this list as more pages get the dual-route refactor.
 */
const PROPERTY_SCOPED_HREFS: ReadonlySet<string> = new Set([
  '/operations',
  '/operations/staff',
  // PBS 2026-05-13: /operations/attendance retired; Attendance + Schedule
  // are now sub-tabs of /operations/staff.
  // TODO: add /operations/restaurant, /operations/spa, /operations/activities,
  // /operations/events, /operations/inventory, /operations/suppliers,
  // /operations/catalog-cleanup once those pages are property-scoped.
  '/guest',                  // shim exists
  '/revenue',                // (snapshot, no detail pages yet)
  '/revenue/pickup',         // pickup matrix · property-aware
  '/finance',
  '/sales',
  '/marketing',
  '/it',
  '/reports',                // agent-deliveries inbox · always property-scoped
]);

export function rewriteSubPagesForProperty(
  subPages: readonly SubPage[],
  propertyId: number
): SubPage[] {
  // Namkhan is the default — no rewrite needed.
  if (propertyId === NAMKHAN_PROPERTY_ID) return [...subPages];

  // For the cross-property swap (e.g. Reports stored as /h/260955/reports
  // points at Donna once the user is on Donna), rewrite /h/{namkhan}/ → /h/{donna}/
  const namkhanPrefix = `/h/${NAMKHAN_PROPERTY_ID}`;

  // Prefix-aware check — any sub-route of a dept root counts. So
  // `/finance/ledger` is in scope because `/finance` is in the set.
  const isPropertyScoped = (href: string): boolean => {
    const path = stripQuery(href);
    if (PROPERTY_SCOPED_HREFS.has(path)) return true;
    for (const root of PROPERTY_SCOPED_HREFS) {
      if (path === root) return true;
      if (path.startsWith(root + '/')) return true;
    }
    return false;
  };

  return subPages
    // Drop tabs that don't have a property-scoped equivalent
    .filter((sp) => sp.href.startsWith('/h/') || isPropertyScoped(sp.href))
    // Rewrite remaining hrefs to /h/[id]/...
    .map((sp) => {
      // Swap Namkhan-anchored /h/260955/... URLs to the active property.
      if (sp.href.startsWith(namkhanPrefix + '/') || sp.href === namkhanPrefix) {
        return {
          label: sp.label,
          href: sp.href.replace(namkhanPrefix, `/h/${propertyId}`),
        };
      }
      if (sp.href.startsWith('/h/')) return sp;
      if (sp.href.startsWith('/')) {
        return { label: sp.label, href: `/h/${propertyId}${sp.href}` };
      }
      return sp;
    });
}

// Strip any ?query from an href before checking against PROPERTY_SCOPED_HREFS.
function stripQuery(href: string): string {
  const q = href.indexOf('?');
  return q < 0 ? href : href.slice(0, q);
}
