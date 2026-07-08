// app/operations/qa/agent-instructions/page.tsx
// PBS 2026-07-08: Edit the SOP generator's SYSTEM prompt without a code deploy.
// Server component. Reads active + all history rows from public.v_sop_agent_instructions
// (bridge onto knowledge.sop_agent_instructions). Delegates interactivity to
// the client editor.

import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import AgentInstructionsEditor, { type InstructionRow } from './_components/AgentInstructionsEditor';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { propertyId?: number }

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

export default async function AgentInstructionsPage({ propertyId }: Props = {}) {
  const pid = propertyId ?? PROPERTY_ID;

  const { data } = await supabase
    .from('v_sop_agent_instructions')
    .select('id, scope, version, body, active, updated_at, updated_by')
    .eq('scope', 'all')
    .order('version', { ascending: false });

  const rows: InstructionRow[] = (data as InstructionRow[]) ?? [];
  const activeRow = rows.find((r) => r.active) ?? null;

  const tabs = qaTabs(pid, 'agent');

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <DashboardPage
        title="Operations · QA · Agent Instructions"
        subtitle="Edit the LLM system prompt used by the SOP generator. Every save creates a new active version — previous versions can be restored."
        tabs={tabs}
      >
        <div style={{ gridColumn: '1 / -1' }}>
          <AgentInstructionsEditor
            initialActive={activeRow}
            history={rows}
          />
        </div>
      </DashboardPage>
    </div>
  );
}
