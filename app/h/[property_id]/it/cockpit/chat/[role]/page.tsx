// app/h/[property_id]/it/cockpit/chat/[role]/page.tsx
// PBS 2026-07-20 pm · rewrite to new design chrome (DashboardPage) + a small
// "Back to Legal" strip for John (and similar contextual back-links for other
// dept agents). Fixes the bare-page look where the chat previously floated
// on a blank canvas with just a big serif name.
//
// Also passes agent metadata through unchanged — the actual chat mechanics
// live in AgentChatShell + /api/cockpit/chat-v2.

import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AgentChatShell from '@/components/cockpit/AgentChatShell';
import HoldingThemeOverride from '@/components/HoldingThemeOverride';
import { DashboardPage, Container } from '@/app/(cockpit)/_design';

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

// Map an agent's dept to a contextual "Back to X" link inside the property.
// Adds an eyebrow that says which HoD area PBS came from.
function backLinkForDept(propertyId: number, dept: string | null, role: string): { label: string; href: string } {
  const p = propertyId;
  const d = (dept ?? '').toLowerCase();
  if (role === 'legal_specialist' || d.includes('legal')) return { label: '← Back to Legal', href: `/finance/legal` };
  if (d.includes('revenue'))                              return { label: '← Back to Revenue', href: `/h/${p}/revenue` };
  if (d.includes('sales'))                                return { label: '← Back to Sales',   href: `/sales` };
  if (d.includes('marketing'))                            return { label: '← Back to Marketing', href: `/marketing` };
  if (d.includes('finance') || d.includes('hr'))          return { label: '← Back to Finance', href: `/h/${p}/finance` };
  if (d.includes('operations') || d.includes('ops'))      return { label: '← Back to Operations', href: `/h/${p}/operations` };
  return { label: '← Cockpit', href: `/h/${p}/it/cockpit` };
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
  let agent: RosterRow | null = null;

  // 1. Roster RPC (scope='all' so Holding-scoped agents resolve)
  const { data: roster } = await supabase.rpc('cockpit_agent_roster', { p_scope: 'all' });
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
  if (agent.property_id !== null && agent.property_id !== propertyId) notFound();

  const back = backLinkForDept(propertyId, agent.dept, agent.role);
  const scopeLabel = agent.scope_label ?? (propertyId === 260955 ? 'Namkhan' : 'Donna Portals');
  const subtitle = [
    agent.tagline,
    agent.reports_to ? `Reports to ${agent.reports_to}` : null,
    scopeLabel,
  ].filter(Boolean).join(' · ');

  return (
    <>
      {/* Holding-scoped agents (John, Carla, Sherlock) keep Beyond Circle palette. */}
      {agent.property_id === null && <HoldingThemeOverride />}
      <DashboardPage
        title={`Chat · ${agent.display_name ?? agent.role}`}
        subtitle={subtitle || `Chat with ${agent.display_name ?? agent.role}`}
        tabs={[
          { key: 'back', label: back.label, href: back.href },
          { key: 'chat', label: 'Chat', href: `/h/${propertyId}/it/cockpit/chat/${agent.role}`, active: true },
          { key: 'cockpit', label: 'Cockpit', href: `/h/${propertyId}/it/cockpit` },
        ]}
      >
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title={agent.display_name ?? agent.role} subtitle={agent.tagline ?? undefined}>
            <div style={{ padding: 12 }}>
              <AgentChatShell
                agent={{
                  role: agent.role,
                  display_name: agent.display_name ?? agent.role,
                  avatar: agent.avatar,
                  color: agent.color,
                  dept: agent.dept,
                  tagline: agent.tagline,
                  reports_to: agent.reports_to,
                  scope_label: scopeLabel,
                }}
                propertyId={propertyId}
              />
            </div>
          </Container>
        </div>
      </DashboardPage>
    </>
  );
}
