// app/operations/sops/page.tsx
// PBS 2026-07-03 · 2026-07-08 · 2026-07-07-Generate:
//   SOP catalog. Now property-scoped via `v_sop_catalog.property_id`
//   (NULL = shared, else per-tenant). Shows shared ∪ own for the caller.
//   Search + dept filter live client-side. Sub-page: Generate SOP.

import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { DEPT_CFG } from '@/lib/dept-cfg';
import { getDeptCfg } from '@/lib/dept-cfg/by-property';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import SopBrowser, { type SopRow } from './_components/SopBrowser';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface Props { propertyId?: number }

export default async function OperationsSopsPage({ propertyId }: Props = {}) {
  const pid = propertyId ?? PROPERTY_ID;
  // Property scope: shared (property_id IS NULL) ∪ this tenant's rows.
  const { data } = await supabase
    .from('v_sop_catalog')
    .select('*')
    .or(`property_id.is.null,property_id.eq.${pid}`)
    .order('sop_code');
  const sops: SopRow[] = (data as SopRow[]) ?? [];
  const generateHref = pid === PROPERTY_ID ? '/operations/qa/generate' : `/h/${pid}/operations/qa/generate`;

  // KPI strip counts
  const distinctDepts = new Set(sops.map((s) => s.dept_code)).size;
  const tiles: KpiTileProps[] = [
    { label: 'Total SOPs',   value: sops.length, size: 'sm' },
    { label: 'Active',       value: sops.filter((s) => s.status === 'active').length, size: 'sm' },
    { label: 'With visuals', value: sops.filter((s) => s.visual_required).length, size: 'sm' },
    { label: 'KB-linked',    value: sops.filter((s) => (s.kb_links_count ?? 0) > 0).length, size: 'sm' },
    { label: 'Departments',  value: distinctDepts, size: 'sm' },
  ];

  const cfg = pid === PROPERTY_ID ? DEPT_CFG.operations : getDeptCfg('operations', pid);
  const subPages = rewriteSubPagesForProperty(cfg.subPages ?? [], pid);
  const tabs: DashboardTab[] = subPages.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/operations/sops'),
  }));

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <DashboardPage
        title="Operations · SOPs"
        subtitle={`${sops.length} Standard Operating Procedures across ${distinctDepts} departments · shared corp catalog`}
        tabs={tabs}
      >
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <SopBrowser sops={sops} generateHref={generateHref} />
        </div>
      </DashboardPage>
    </div>
  );
}
