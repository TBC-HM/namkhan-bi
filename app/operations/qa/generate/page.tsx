// app/operations/qa/generate/page.tsx
// PBS 2026-07-07: Generate SOP — AI-assisted form. Renders inside the Operations
// dashboard chrome. Property/dept/purpose in → JSON preview → Save (server RPC
// via /api/sop/save). Reuses the existing SOP register (knowledge.sop_content
// via fn_sop_upsert). Property-scoped: falls back to Namkhan for the naked
// /operations path; tenant delegate at /h/[property_id]/operations/qa/generate.

import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { PROPERTY_ID } from '@/lib/supabase';
import { DEPT_CFG } from '@/lib/dept-cfg';
import { getDeptCfg } from '@/lib/dept-cfg/by-property';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import GenerateSopForm from './_components/GenerateSopForm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { propertyId?: number }

export default async function GenerateSopPage({ propertyId }: Props = {}) {
  const pid = propertyId ?? PROPERTY_ID;

  const cfg = pid === PROPERTY_ID ? DEPT_CFG.operations : getDeptCfg('operations', pid);
  const subPages = rewriteSubPagesForProperty(cfg.subPages ?? [], pid);
  const tabs: DashboardTab[] = subPages.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: false,
  }));

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <DashboardPage
        title="Operations · QA · Generate SOP"
        subtitle="AI-assisted Standard Operating Procedure generator — pick property, department, describe purpose, review, save."
        tabs={tabs}
      >
        <div style={{ gridColumn: '1 / -1' }}>
          <GenerateSopForm defaultPropertyId={pid} />
        </div>
      </DashboardPage>
    </div>
  );
}
