// lib/dept-cfg/rewrite-subpages.ts
// PBS 2026-05-13 — utility to rewrite top-level subPages hrefs to be
// property-scoped on /h/[property_id]/* routes.
//
// DEPT_CFG.X.subPages export Namkhan-style hrefs (/operations/staff etc.).
// When a non-Namkhan property renders the same page, those hrefs must map
// to /h/[propertyId]/operations/staff or clicking a tab kicks the user out
// of their property context.

import { NAMKHAN_PROPERTY_ID } from './by-property';

export interface SubPage {
  label: string;
  href: string;
}

export function rewriteSubPagesForProperty(
  subPages: readonly SubPage[],
  propertyId: number
): SubPage[] {
  // Namkhan is the default — no rewrite needed.
  if (propertyId === NAMKHAN_PROPERTY_ID) return [...subPages];

  return subPages.map((sp) => {
    if (sp.href.startsWith('/h/')) return sp; // already scoped
    if (sp.href.startsWith('/')) {
      return { label: sp.label, href: `/h/${propertyId}${sp.href}` };
    }
    return sp;
  });
}
