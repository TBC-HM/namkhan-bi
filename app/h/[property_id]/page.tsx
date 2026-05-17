// app/h/[property_id]/page.tsx
// v5 (PBS 2026-05-14): per-property landing = hotel CEO entry.
// Felix (holding) lives at /holding. /h/[id]/ is now the property's CEO:
//   • Namkhan (260955) → Nova
//   • Donna   (1000001) → Orion
// The top-level dept menus (Revenue · Sales · Marketing · Operations ·
// Finance · Guest · IT) are CANONICAL — same labels, same order, same
// canonical components on every property. Only the page palette changes
// per property (ThemeInjector swaps tokens by brand_palette).
//
// Chat role is overridden to the property's CEO cap_prompts row so the
// LLM persona matches.

import DeptEntry from '@/components/dept-entry/DeptEntry';
import { DEPT_CFG } from '@/lib/dept-cfg';
import type { DeptCfg } from '@/lib/dept-cfg/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NAMKHAN_PROPERTY_ID = 260955;
const DONNA_PROPERTY_ID   = 1000001;

interface CeoOverride {
  hodName: string;
  hodEmoji: string;
  hodTagline: string;
  chatPlaceholder: string;
  ownerRole: string;
  pillTitle: string;
}

// Names + emojis sourced from cockpit.id_agents in Supabase (the agreed
// canonical roster). Both CEOs operate in English — PBS rule.
const CEO_BY_PROPERTY: Record<number, CeoOverride> = {
  [NAMKHAN_PROPERTY_ID]: {
    hodName: 'Nova',
    hodEmoji: '🌟',
    hodTagline: 'AI Hotel CEO · The Namkhan. Ask anything cross-department.',
    chatPlaceholder: 'e.g. how is the resort doing today?',
    ownerRole: 'hotel_ceo_namkhan',
    pillTitle: 'Namkhan',
  },
  [DONNA_PROPERTY_ID]: {
    hodName: 'Orion',
    hodEmoji: '🌌',
    hodTagline: 'AI Hotel CEO · Donna Portals. Ask anything cross-department.',
    chatPlaceholder: 'e.g. how is the hotel doing today?',
    ownerRole: 'hotel_ceo_donna',
    pillTitle: 'Donna Portals',
  },
};

function propertyCeoCfg(propertyId: number): DeptCfg {
  const base = DEPT_CFG.architect;
  const ceo = CEO_BY_PROPERTY[propertyId];

  const scope = (href: string) =>
    href.startsWith('/') && !href.startsWith('/h/')
      ? `/h/${propertyId}${href}`
      : href;

  const scoped: DeptCfg = {
    ...base,
    // PBS 2026-05-14: the CEO entry page itself does NOT render a
    // SubPagesStrip — the persistent TopDeptStrip in the property layout
    // already shows the 7 canonical dept buttons. We keep them out of cfg
    // here to avoid a duplicate row.
    subPages: undefined,
    quickChips: base.quickChips?.map((c) => ({ ...c, href: scope(c.href) })),
    attentionRoutes: base.attentionRoutes?.map((r) => ({ ...r, href: scope(r.href) })),
    defaultDrilldown: scope(base.defaultDrilldown),
  };

  if (ceo) {
    return {
      ...scoped,
      pillTitle: ceo.pillTitle,
      hodName: ceo.hodName,
      hodEmoji: ceo.hodEmoji,
      hodTagline: ceo.hodTagline,
      chatPlaceholder: ceo.chatPlaceholder,
      ownerRole: ceo.ownerRole,
    };
  }
  return scoped;
}

export default function PropertyHome({
  params,
}: {
  params: { property_id: string };
}) {
  const propertyId = Number(params.property_id);
  const cfg = propertyCeoCfg(propertyId);
  return <DeptEntry cfg={cfg} />;
}
