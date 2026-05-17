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

// Donna HoDs — canonical AI agent roster (cockpit.id_agents · 2026-05-14).
// Each entry maps a dept slug to the property-specific HoD AI agent that
// chat should route to AND the display name that appears on the page.
// `role` is the cap_prompts role slug (drives ownerRole override below).
const DONNA_HOD: Record<DeptSlug, { name: string; emoji?: string; role: string }> = {
  revenue:    { name: 'Mira',    emoji: '📈', role: 'revenue_hod_donna'    },
  sales:      { name: 'Vela',    emoji: '📞', role: 'sales_hod_donna'      },
  marketing:  { name: 'Faro',    emoji: '✦',  role: 'marketing_hod_donna'  },
  operations: { name: 'Brigada', emoji: '⚙',  role: 'operations_hod_donna' },
  finance:    { name: 'Cifra',   emoji: '€',  role: 'finance_hod_donna'    },
  // Donna has no dedicated AI HoD yet for these slots — surface them with
  // a clear "not yet wired" tagline rather than the canonical Namkhan agent.
  guest:      { name: 'Orion',   emoji: '🌌', role: 'hotel_ceo_donna'      },
  it:         { name: 'Captain Kit', emoji: '🛠', role: 'it_manager'       }, // holding-shared
  architect:  { name: 'Orion',   emoji: '🌌', role: 'hotel_ceo_donna'      },
};

function withDonnaHod(base: DeptCfg, hod: { name: string; emoji?: string; role: string }): DeptCfg {
  return {
    ...base,
    hodName: hod.name,
    hodEmoji: hod.emoji ?? base.hodEmoji,
    // PBS 2026-05-14: ownerRole MUST point at the Donna-specific cap_prompts
    // row so chat persona resolution lands on Mira/Vela/Faro/Brigada/Cifra
    // (not Vector/Mercer/Lumen/Forge/Intel which are Namkhan).
    ownerRole: hod.role,
    hodTagline: `Ask ${hod.name} anything about ${base.pillTitle.toLowerCase()}.`,
    chatPlaceholder: `e.g. a ${base.pillTitle.toLowerCase()} question for ${hod.name}…`,
    defaultAttn: [],
    defaultDocs: [],
    defaultTasks: [],
    kpiTiles: [],
  };
}

function scopeHrefs(base: DeptCfg, propertyId: number): DeptCfg {
  // PBS 2026-05-15: also rewrite any /h/{namkhan_id}/... URL embedded in the
  // base cfg (e.g. FINANCE_CFG's Reports entry is anchored at Namkhan so the
  // global Namkhan strip works; we need to swap it for the active property).
  const namkhanPrefix = `/h/${NAMKHAN_PROPERTY_ID}`;
  const scope = (href: string) => {
    if (href.startsWith(namkhanPrefix + '/') || href === namkhanPrefix) {
      return href.replace(namkhanPrefix, `/h/${propertyId}`);
    }
    if (href.startsWith('/') && !href.startsWith('/h/') && !href.startsWith('/_next')) {
      return `/h/${propertyId}${href}`;
    }
    return href;
  };

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
    // Fallback to Orion (Donna CEO) so any unmapped slug still routes to a
    // valid Donna-scoped persona, not a Namkhan one.
    const hod = DONNA_HOD[slug] ?? { name: 'Orion', emoji: '🌌', role: 'hotel_ceo_donna' };
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
