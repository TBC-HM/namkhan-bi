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
  '/finance',
  '/sales',
  '/marketing',
  '/it',
]);

export function rewriteSubPagesForProperty(
  subPages: readonly SubPage[],
  propertyId: number
): SubPage[] {
  // Namkhan is the default — no rewrite needed.
  if (propertyId === NAMKHAN_PROPERTY_ID) return [...subPages];

  return subPages
    // Drop tabs that don't have a property-scoped equivalent
    .filter((sp) => sp.href.startsWith('/h/') || PROPERTY_SCOPED_HREFS.has(sp.href))
    // Rewrite remaining hrefs to /h/[id]/...
    .map((sp) => {
      if (sp.href.startsWith('/h/')) return sp;
      if (sp.href.startsWith('/')) {
        return { label: sp.label, href: `/h/${propertyId}${sp.href}` };
      }
      return sp;
    });
}
