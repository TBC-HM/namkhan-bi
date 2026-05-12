// lib/dept-cfg/by-property.ts
// Per-property dept config resolver.
//
// 2026-05-12: PBS reported that switching to Donna and clicking Marketing
// still showed Lumen (Namkhan's marketing agent). Each property has its own
// HoD names (humans for Donna, AI agents for Namkhan). This module returns
// the right DeptCfg per (slug, propertyId).
//
// For properties other than Namkhan we currently:
//   1. Override hodName/Tagline with the human HoD from tenancy.property_users
//   2. Empty out defaultAttn/Docs/Tasks/kpiTiles (no data yet)
//   3. Rewrite all internal hrefs to be property-scoped (/h/[id]/...)

import { DEPT_CFG } from './index';
import type { DeptCfg, DeptSlug } from './types';

export const NAMKHAN_PROPERTY_ID = 260955;
export const DONNA_PROPERTY_ID = 1000001;

// Donna HoDs — pulled from tenancy.property_users on 2026-05-12.
// Missing roles fall back to the property owner (Maxi).
const DONNA_HOD: Record<DeptSlug, { name: string; emoji?: string }> = {
  marketing:  { name: 'Leo',       emoji: '✶' },
  sales:      { name: 'Sebastian', emoji: '✣' },
  finance:    { name: 'Toni',      emoji: '€' },
  // No human HoD in DB yet — owner stands in:
  revenue:    { name: 'Maxi',      emoji: '⚓' },
  operations: { name: 'Maxi',      emoji: '⚙' },
  guest:      { name: 'Maxi',      emoji: '☉' },
  it:         { name: 'Maxi',      emoji: '⌘' },
  architect:  { name: 'Maxi',      emoji: '🏛' },
};

function withDonnaHod(base: DeptCfg, hod: { name: string; emoji?: string }): DeptCfg {
  return {
    ...base,
    hodName: hod.name,
    hodEmoji: hod.emoji ?? base.hodEmoji,
    hodTagline: `Ask ${hod.name} anything about ${base.pillTitle.toLowerCase()}.`,
    chatPlaceholder: `e.g. a ${base.pillTitle.toLowerCase()} question for ${hod.name}…`,
    defaultAttn: [],
    defaultDocs: [],
    defaultTasks: [],
    kpiTiles: [],
  };
}

function scopeHrefs(base: DeptCfg, propertyId: number): DeptCfg {
  const scope = (href: string) =>
    href.startsWith('/') && !href.startsWith('/h/') && !href.startsWith('/_next')
      ? `/h/${propertyId}${href}`
      : href;

  return {
    ...base,
    subPages: base.subPages?.map((p) => ({ ...p, href: scope(p.href) })),
    quickChips: base.quickChips?.map((c) => ({ ...c, href: scope(c.href) })),
    attentionRoutes: base.attentionRoutes?.map((r) => ({ ...r, href: scope(r.href) })),
    defaultDrilldown: scope(base.defaultDrilldown),
    reportTypes: base.reportTypes?.map((rt) => ({ ...rt, hrefBase: scope(rt.hrefBase) })),
  };
}

/**
 * Returns the DeptCfg for a given slug + propertyId.
 * - Namkhan (260955): returns the base config unchanged.
 * - Donna (1000001):  overrides HoD, empties data, rewrites hrefs to /h/1000001/...
 * - Other:            falls back to base cfg with hrefs scoped to that property.
 */
export function getDeptCfg(slug: DeptSlug, propertyId: number): DeptCfg {
  const base = DEPT_CFG[slug];

  if (propertyId === NAMKHAN_PROPERTY_ID) {
    return base;
  }

  if (propertyId === DONNA_PROPERTY_ID) {
    const hod = DONNA_HOD[slug] ?? { name: 'Maxi' };
    return scopeHrefs(withDonnaHod(base, hod), propertyId);
  }

  // Future properties — empty data + scoped hrefs, keep Namkhan HoDs as fallback.
  return scopeHrefs(
    {
      ...base,
      defaultAttn: [],
      defaultDocs: [],
      defaultTasks: [],
      kpiTiles: [],
    },
    propertyId,
  );
}
