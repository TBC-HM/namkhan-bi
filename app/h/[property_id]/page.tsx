// app/h/[property_id]/page.tsx
// v4 (2026-05-12 PBS correction): Felix is ALWAYS the home page, regardless
// of property. The property switcher only changes which dept links/modules
// resolve to (active vs planned shims). Felix himself doesn't switch.
//
// History:
//  - v3 (broken): tried to render a Donna-specific welcome dashboard
//  - v2 (broken): used ModuleStateGate with platform_required (always active)
//                 → rendered empty <div /> children
//  - v4: render DeptEntry unconditionally + property-scope the subPages/chips
//        so Namkhan goes to legacy /<dept> via shim, Donna goes to
//        /h/[id]/<dept> ModuleStateGate placeholder.

import DeptEntry from '@/components/dept-entry/DeptEntry';
import { DEPT_CFG } from '@/lib/dept-cfg';
import type { DeptCfg } from '@/lib/dept-cfg/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function propertyScopedCfg(base: DeptCfg, propertyId: number): DeptCfg {
  const scope = (href: string) =>
    href.startsWith('/') && !href.startsWith('/h/')
      ? `/h/${propertyId}${href}`
      : href;

  return {
    ...base,
    subPages: base.subPages?.map((p) => ({ ...p, href: scope(p.href) })),
    quickChips: base.quickChips?.map((c) => ({ ...c, href: scope(c.href) })),
  };
}

export default function PropertyHome({
  params,
}: {
  params: { property_id: string };
}) {
  const propertyId = Number(params.property_id);
  const cfg = propertyScopedCfg(DEPT_CFG.architect, propertyId);
  return <DeptEntry cfg={cfg} />;
}
