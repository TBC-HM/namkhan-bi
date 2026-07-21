// app/operations/qa/proposals/page.tsx
// PBS 2026-07-08: AI-proposed SOP catalog. Server component. Reads
// public.v_sop_proposals filtered by property_scope for the current tenant.
// Renders inside DashboardPage chrome; delegates interactivity to
// _components/SopProposalList (client).
//
// 2026-07-08 (later): tabs strip switched from the top-level operations
// subPages to the QA-cluster tabs (Overview / Registry / Generate / Proposals /
// Agent Instructions) per PBS's QA sub-menu spec.
//
// 2026-07-21 (fix): dropped local qaTabs() — it was replacing the canonical
// Operations top strip with a duplicate of the QA sub-strip. NAV_SUBGROUPS
// (lib/nav-subgroups.ts, parentHref='/operations/sops') already renders the
// SOPs · QA registry · Proposals · Generate · Agent instructions row below,
// so we now feed DashboardPage the canonical 5-item Operations strip.

import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { OPERATIONS_SUBPAGES } from '../../_subpages';
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
    .in('property_scope', ['all', scope])
    .order('priority', { ascending: true })
    .order('dept_code', { ascending: true })
    .order('title', { ascending: true });

  const proposals: ProposalRow[] = (data as ProposalRow[]) ?? [];

  // PBS 2026-07-11 pm (dir 2) — server debug line so future "0 rows" bugs surface in Vercel logs.
  console.log('SopProposalsPage', { pid, scope, rows: proposals.length });

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({
    key: s.href,
    label: s.label,
    href: s.href,
    active: s.href === '/operations/sops', // QA parent
  }));

  const generateBaseHref = pid === PROPERTY_ID
    ? '/operations/qa/generate'
    : `/h/${pid}/operations/qa/generate`;

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <DashboardPage
        title="Operations · QA · SOP Proposals"
        subtitle={`AI-drafted list of SOPs this property needs. Review, generate, edit, accept — accepted SOPs enter the register at /operations/qa/registry. (${proposals.length} proposals)`}
        tabs={tabs}
      >
        <div style={{ gridColumn: '1 / -1' }}>
          <SopProposalList
            proposals={proposals}
            generateBaseHref={generateBaseHref}
            seedBatchHref="/api/sop/proposals/seed-batch"
            propertyId={pid}
          />
        </div>
      </DashboardPage>
    </div>
  );
}
