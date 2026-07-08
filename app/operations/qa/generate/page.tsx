// app/operations/qa/generate/page.tsx
// PBS 2026-07-07 · 2026-07-08: Generate SOP — AI-assisted form. Renders inside
// the Operations dashboard chrome. Property/dept/purpose in → JSON preview →
// Save (server RPC via /api/sop/save). Reuses the existing SOP register
// (knowledge.sop_content via fn_sop_upsert). Property-scoped: falls back to
// Namkhan for the naked /operations path; tenant delegate at
// /h/[property_id]/operations/qa/generate.
//
// 2026-07-08: Accepts optional URL params dept, purpose, proposal_id from the
// /operations/qa/proposals page for one-click drafting.

import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { PROPERTY_ID } from '@/lib/supabase';
import { DEPT_CFG } from '@/lib/dept-cfg';
import { getDeptCfg } from '@/lib/dept-cfg/by-property';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import GenerateSopForm from './_components/GenerateSopForm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
  propertyId?: number;
  searchParams?: { dept?: string; purpose?: string; proposal_id?: string };
}

export default async function GenerateSopPage({ propertyId, searchParams }: Props = {}) {
  const pid = propertyId ?? PROPERTY_ID;

  const cfg = pid === PROPERTY_ID ? DEPT_CFG.operations : getDeptCfg('operations', pid);
  const subPages = rewriteSubPagesForProperty(cfg.subPages ?? [], pid);
  const tabs: DashboardTab[] = subPages.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: false,
  }));

  const deptPrefill    = searchParams?.dept?.trim() || undefined;
  const purposePrefill = searchParams?.purpose?.trim() || undefined;
  const proposalIdNum  = searchParams?.proposal_id ? Number(searchParams.proposal_id) : NaN;
  const proposalId     = Number.isFinite(proposalIdNum) && proposalIdNum > 0 ? proposalIdNum : null;

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <DashboardPage
        title="Operations · QA · Generate SOP"
        subtitle="AI-assisted Standard Operating Procedure generator — pick property, department, describe purpose, review, save."
        tabs={tabs}
      >
        <div style={{ gridColumn: '1 / -1' }}>
          <GenerateSopForm
            defaultPropertyId={pid}
            deptPrefill={deptPrefill}
            purposePrefill={purposePrefill}
            proposalId={proposalId}
          />
        </div>
      </DashboardPage>
    </div>
  );
}
