// app/operations/qa/generate/page.tsx
// PBS 2026-07-07 · 2026-07-08: Generate SOP — AI-assisted form. Renders inside
// the Operations dashboard chrome. Property/dept/purpose in → JSON preview →
// Save (server RPC via /api/sop/save). Reuses the existing SOP register
// (knowledge.sop_content via fn_sop_upsert). Property-scoped: falls back to
// Namkhan for the naked /operations path; tenant delegate at
// /h/[property_id]/operations/qa/generate.
//
// 2026-07-08 (later): tabs strip switched from the top-level operations
// subPages to the QA-cluster tabs (Overview / Registry / Generate / Proposals
// + Agent Instructions) per PBS's QA sub-menu spec.
//
// 2026-07-08 (bug-2): server component now assembles a plain-text property
// context block (rooms / facilities / spa / activities / seasons / location)
// via lib/propertyContext and passes it to the client form as a string prop.
// The client form embeds it in the POST body to /api/sop/generate so the LLM
// has hotel-specific ground truth.

import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { PROPERTY_ID } from '@/lib/supabase';
import { getPropertyContext, renderPropertyContextForLLM } from '@/lib/propertyContext';
import GenerateSopForm from './_components/GenerateSopForm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
  propertyId?: number;
  searchParams?: { dept?: string; purpose?: string; proposal_id?: string };
}

function qaTabs(pid: number, active: 'overview' | 'registry' | 'generate' | 'proposals' | 'agent'): DashboardTab[] {
  const base = pid === PROPERTY_ID ? '' : `/h/${pid}`;
  return [
    { key: `${base}/operations/qa`,                   label: 'Overview',            href: `${base}/operations/qa`,                   active: active === 'overview'  },
    { key: `${base}/operations/qa/registry`,          label: 'Registry',            href: `${base}/operations/qa/registry`,          active: active === 'registry'  },
    { key: `${base}/operations/qa/generate`,          label: 'Generate',            href: `${base}/operations/qa/generate`,          active: active === 'generate'  },
    { key: `${base}/operations/qa/proposals`,         label: 'Proposals',           href: `${base}/operations/qa/proposals`,         active: active === 'proposals' },
    { key: `${base}/operations/qa/agent-instructions`,label: 'Agent Instructions',  href: `${base}/operations/qa/agent-instructions`,active: active === 'agent'     },
  ];
}

export default async function GenerateSopPage({ propertyId, searchParams }: Props = {}) {
  const pid = propertyId ?? PROPERTY_ID;

  const tabs = qaTabs(pid, 'generate');

  const deptPrefill    = searchParams?.dept?.trim() || undefined;
  const purposePrefill = searchParams?.purpose?.trim() || undefined;
  const proposalIdNum  = searchParams?.proposal_id ? Number(searchParams.proposal_id) : NaN;
  const proposalId     = Number.isFinite(proposalIdNum) && proposalIdNum > 0 ? proposalIdNum : null;

  // Pre-render the property context block server-side. This is a plain string
  // so it satisfies feedback_nextjs_rsc_no_function_props (no function props
  // ever cross the server→client boundary).
  const ctx = getPropertyContext(pid);
  const propertyContextText = renderPropertyContextForLLM(ctx);

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <DashboardPage
        title="Operations · QA · Generate SOP"
        subtitle={`AI-assisted Standard Operating Procedure generator — grounded in ${ctx.name} facts (${ctx.rooms.total_rooms} rooms · ${ctx.facilities.length} facilities · ${ctx.spa_services.length} spa services · ${ctx.activities.length} activities).`}
        tabs={tabs}
      >
        <div style={{ gridColumn: '1 / -1' }}>
          <GenerateSopForm
            defaultPropertyId={pid}
            deptPrefill={deptPrefill}
            purposePrefill={purposePrefill}
            proposalId={proposalId}
            propertyContextText={propertyContextText}
            propertyName={ctx.name}
            propertyRoomCount={ctx.rooms.total_rooms}
            propertyKeyCount={ctx.rooms.total_keys}
            propertyFacilityCount={ctx.facilities.length}
          />
        </div>
      </DashboardPage>
    </div>
  );
}
