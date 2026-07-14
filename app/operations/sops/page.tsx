// app/operations/sops/page.tsx
// PBS 2026-07-03 · 2026-07-08 · 2026-07-07-Generate · 2026-07-08 Proposals:
//   SOP catalog. Property-scoped via `v_sop_catalog.property_id`
//   (NULL = shared, else per-tenant). Shows shared ∪ own for the caller.
//   Search + dept filter live client-side. Sub-pages: Generate SOP, Propose SOPs.

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
  const generateHref  = pid === PROPERTY_ID ? '/operations/qa/generate'  : `/h/${pid}/operations/qa/generate`;
  const proposalsHref = pid === PROPERTY_ID ? '/operations/qa/proposals' : `/h/${pid}/operations/qa/proposals`;

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

        {/* PBS 2026-07-14 · #29 — QA sub-nav strip. Replaces the 2 inline action-bar buttons on SopBrowser.
            Surfaces: SOPs (this page) · Generate · Propose · Agent Instructions.
            Agent Instructions lives at /h/[pid]/operations/qa/agent-instructions (property-scoped only). */}
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 4, borderBottom: '1px solid #E6DFCC', marginBottom: 12 }}>
          {[
            { key: 'sops',         label: 'SOPs',              href: pid === PROPERTY_ID ? '/operations/sops'                    : `/h/${pid}/operations/sops` },
            { key: 'generate',     label: '+ Generate SOP',    href: generateHref },
            { key: 'proposals',    label: 'Propose SOPs',      href: proposalsHref },
            { key: 'instructions', label: 'Agent instructions', href: `/h/${pid}/operations/qa/agent-instructions` },
          ].map((t) => {
            const active = t.key === 'sops';
            return (
              <a key={t.key} href={t.href} style={{
                padding: '8px 14px', fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase',
                borderBottom: active ? '2px solid #084838' : '2px solid transparent',
                color: active ? '#084838' : '#5A5A5A',
                fontWeight: active ? 700 : 500,
                textDecoration: 'none', marginBottom: -1,
              }}>{t.label}</a>
            );
          })}
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <SopBrowser sops={sops} />
        </div>
      </DashboardPage>
    </div>
  );
}
