// app/h/[property_id]/it/cockpit/chat/[role]/page.tsx
// Prompt 3 — agent-chat-spawn. Chat with any of the 31 agents by role.
//
// Server component: fetches agent metadata (display_name, avatar, tagline,
// scope, reports_to) from cockpit_agent_roster, validates property scope,
// then renders the client-side AgentChatShell.

import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AgentChatShell from '@/components/cockpit/AgentChatShell';
import Page from '@/components/page/Page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface RosterRow {
  role: string;
  display_name: string | null;
  dept: string | null;
  avatar: string | null;
  color: string | null;
  tagline: string | null;
  status: string | null;
  hierarchy_level: string | null;
  reports_to: string | null;
  property_id: number | null;
  scope_label: string | null;
}

export default async function AgentChatPage({
  params,
}: {
  params: { property_id: string; role: string };
}) {
  const propertyId = Number(params.property_id);
  const role = params.role;

  if (!Number.isFinite(propertyId) || !role) notFound();

  const supabase = createClient();

  // Look up the agent. Use cockpit_agent_roster RPC if it exists, else
  // fall back to direct id_agents query.
  let agent: RosterRow | null = null;

  // 1. Try roster RPC first (returns scope_label, reports_to, etc.)
  const scope = propertyId === 260955 ? 'namkhan' : propertyId === 1000001 ? 'donna' : 'all';
  const { data: roster } = await supabase.rpc('cockpit_agent_roster', { p_scope: scope });
  if (Array.isArray(roster)) {
    agent = (roster as RosterRow[]).find((r) => r.role === role) ?? null;
  }

  // 2. Fallback: id_agents direct
  if (!agent) {
    const { data: idAgent } = await supabase
      .schema('cockpit')
      .from('id_agents')
      .select('role, display_name, dept, avatar, color, tagline, status')
      .eq('role', role)
      .maybeSingle();

    if (idAgent) {
      agent = {
        role: idAgent.role as string,
        display_name: (idAgent.display_name ?? null) as string | null,
        dept: (idAgent.dept ?? null) as string | null,
        avatar: (idAgent.avatar ?? null) as string | null,
        color: (idAgent.color ?? null) as string | null,
        tagline: (idAgent.tagline ?? null) as string | null,
        status: (idAgent.status ?? null) as string | null,
        hierarchy_level: null,
        reports_to: null,
        property_id: null,
        scope_label: null,
      };
    }
  }

  if (!agent) notFound();

  // Property-scope check: an agent bound to a different property cannot be
  // chatted with from this property's URL.
  if (agent.property_id !== null && agent.property_id !== propertyId) {
    notFound();
  }

  return (
    <Page
      eyebrow={`Cockpit · ${agent.dept ?? 'Agent'} · Chat`}
      title={
        <>
          {agent.display_name ?? agent.role}
          {agent.tagline && (
            <em style={{ color: 'var(--accent, #a8854a)', fontSize: '0.5em', marginLeft: 12 }}>
              {agent.tagline}
            </em>
          )}
        </>
      }
    >
      <AgentChatShell
        agent={{
          role: agent.role,
          display_name: agent.display_name ?? agent.role,
          avatar: agent.avatar,
          color: agent.color,
          dept: agent.dept,
          tagline: agent.tagline,
          reports_to: agent.reports_to,
          scope_label: agent.scope_label ?? (propertyId === 260955 ? 'Namkhan' : 'Donna Portals'),
        }}
        propertyId={propertyId}
      />
    </Page>
  );
}
