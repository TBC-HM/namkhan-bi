// app/operations/qa/proposals/page.tsx
// PBS 2026-07-08: AI-proposed SOP catalog. Server component. Reads
// public.v_sop_proposals filtered by property_scope for the current tenant.
// Renders inside DashboardPage chrome; delegates interactivity to
// _components/SopProposalList (client).

import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { DEPT_CFG } from '@/lib/dept-cfg';
import { getDeptCfg } from '@/lib/dept-cfg/by-property';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import SopProposalList, { type ProposalRow } from './_components/SopProposalList';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { propertyId?: number }

const SCOPE_FOR: Record<number, string> = {
  260955:  'namkhan',
  1000001: 'donna',
};

export default async function SopProposalsPage({ propertyId }: Props = {}) {
  const pid = propertyId ?? PROPERTY_ID;
  const scope = SCOPE_FOR[pid] ?? 'all';

  // property_scope='all' rows show for every tenant; own-scope rows only for match.
  const { data } = await supabase
    .from('v_sop_proposals')
    .select('*')
    .or(`property_scope.eq.all,property_scope.eq.${scope}`)
    .order('priority', { ascending: true })
    .order('dept_code', { ascending: true })
    .order('title', { ascending: true });

  const proposals: ProposalRow[] = (data as ProposalRow[]) ?? [];

  const cfg = pid === PROPERTY_ID ? DEPT_CFG.operations : getDeptCfg('operations', pid);
  const subPages = rewriteSubPagesForProperty(cfg.subPages ?? [], pid);
  const tabs: DashboardTab[] = subPages.map((s) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href.endsWith('/operations/qa/proposals'),
  }));

  const generateBaseHref = pid === PROPERTY_ID
    ? '/operations/qa/generate'
    : `/h/${pid}/operations/qa/generate`;

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <DashboardPage
        title="Operations · QA · SOP Proposals"
        subtitle={`AI-drafted list of SOPs this property needs. Review, generate, edit, accept — accepted SOPs enter the register at /operations/sops. (${proposals.length} proposals)`}
        tabs={tabs}
      >
        <div style={{ gridColumn: '1 / -1' }}>
          <SopProposalList
            proposals={proposals}
            generateBaseHref={generateBaseHref}
            seedHref="/api/sop/proposals/seed"
            propertyId={pid}
          />
        </div>
      </DashboardPage>
    </div>
  );
}
