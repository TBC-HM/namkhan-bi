// app/operations/qa/agent-instructions/page.tsx
// PBS 2026-07-08: Edit the SOP generator's SYSTEM prompt without a code deploy.
// Server component. Reads active + all history rows from public.v_sop_agent_instructions
// (bridge onto knowledge.sop_agent_instructions). Delegates interactivity to
// the client editor.
//
// 2026-07-21 (fix): dropped local qaTabs() — it was replacing the canonical
// Operations top strip with a duplicate of the QA sub-strip. NAV_SUBGROUPS
// (lib/nav-subgroups.ts, parentHref='/operations/sops') already renders the
// SOPs · QA registry · Proposals · Generate · Agent instructions row below,
// so we now feed DashboardPage the canonical 5-item Operations strip.

import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { OPERATIONS_SUBPAGES } from '../../_subpages';
import AgentInstructionsEditor, { type InstructionRow } from './_components/AgentInstructionsEditor';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { propertyId?: number }

export default async function AgentInstructionsPage({ propertyId }: Props = {}) {
  const pid = propertyId ?? PROPERTY_ID;

  const { data } = await supabase
    .from('v_sop_agent_instructions')
    .select('id, scope, version, body, active, updated_at, updated_by')
    .eq('scope', 'all')
    .order('version', { ascending: false });

  const rows: InstructionRow[] = (data as InstructionRow[]) ?? [];
  const activeRow = rows.find((r) => r.active) ?? null;

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({
    key: s.href,
    label: s.label,
    href: s.href,
    active: s.href === '/operations/sops', // QA parent
  }));

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
