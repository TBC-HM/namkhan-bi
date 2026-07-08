// app/operations/sops/page.tsx
// PBS 2026-07-03 · 2026-07-08: SOP catalog — 56 real SOPs from public.v_sop_catalog.
// SOPs are NOT property-scoped (shared corp-level docs) but the page accepts
// `propertyId` for URL tenant-consistency and creates a Donna delegate at
// /h/[property_id]/operations/sops. Search + dept filter live client-side.

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
  const { data } = await supabase.from('v_sop_catalog').select('*').order('sop_code');
  const sops: SopRow[] = (data as SopRow[]) ?? [];

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
          <SopBrowser sops={sops} />
        </div>
      </DashboardPage>
    </div>
  );
}
