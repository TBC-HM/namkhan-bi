// app/cockpit-v2/agent/[role]/page.tsx
//
// PBS 2026-05-17: agent debug surface. Click an agent in Team, land here.
// See the full picture: prompt (editable + versioned), skills granted,
// memories targeting this agent, docs the prompt references, recent
// invocations, deliveries. Find the bug, fix the prompt, save it. Done.

import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { AgentDebugView } from './AgentDebugView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  params: { role: string };
}

async function fetchAgentBundle(role: string) {
  const sb = getSupabaseAdmin();
  const sbCockpit = sb.schema('cockpit');

  // 1) prompt + identity
  const [{ data: promptRow }, { data: agentRow }] = await Promise.all([
    sb.from('cockpit_agent_prompts')
      .select('role, prompt, version, active, notes, department, status, updated_at, created_at')
      .eq('role', role)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
    sbCockpit.from('id_agents')
      .select('role, display_name, avatar, tagline, color, property_id, hierarchy_level, reports_to, dept, status, scope')
      .eq('role', role)
      .limit(1)
      .maybeSingle(),
  ]);

  if (!promptRow && !agentRow) return null;

  // 2) skills granted to this role
  const { data: agentSkills } = await sbCockpit
    .from('cap_agent_skills')
    .select('skill_id, enabled, created_at')
    .eq('role', role);

  const skillIds = (agentSkills ?? []).map((s) => s.skill_id);
  const { data: skills } = skillIds.length
    ? await sbCockpit.from('cap_skills')
        .select('id, name, description, category, authority_level, requires_pbs_approval, estimated_cost_usd_milli, active')
        .in('id', skillIds)
    : { data: [] as any[] };

  // 3) memories targeting this agent (role match OR 'all')
  const { data: memories } = await sb
    .from('cockpit_agent_memory')
    .select('id, memory_type, content, importance, agent_handle, created_at')
    .or(`agent_handle.eq.${role},agent_handle.eq.all,agent_handle.eq.everyone`)
    .order('importance', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(40);

  // 4) recent invocations / audit-log entries for this agent
  const { data: audit } = await sb
    .from('cockpit_audit_log')
    .select('id, created_at, action, target, success, cost_usd_milli, input_tokens, output_tokens, duration_ms, notes')
    .eq('agent', role)
    .order('created_at', { ascending: false })
    .limit(30);

  // 5) recent deliveries (cockpit_tickets where the agent's role is mentioned)
  const { data: deliveries } = await sb
    .from('cockpit_tickets')
    .select('id, source, arm, intent, status, email_subject, pr_url, created_at')
    .ilike('email_subject', `%${role}%`)
    .order('created_at', { ascending: false })
    .limit(15);

  // 6) docs referenced by this prompt (string-scan against the 11 doc_types)
  const docTypes = ['claude_md','architecture','deployment','security','data_model',
                    'design_system','api','integration','factorial_md','prd','vision_roadmap'];
  const docRefs = promptRow?.prompt
    ? docTypes.filter((t) => promptRow.prompt!.toLowerCase().includes(t.toLowerCase()))
    : [];

  return {
    role,
    prompt: promptRow,
    agent: agentRow,
    skills: (skills ?? []).map((s) => ({
      ...s,
      enabled: (agentSkills ?? []).find((as) => as.skill_id === s.id)?.enabled !== false,
    })),
    memories: memories ?? [],
    audit: audit ?? [],
    deliveries: deliveries ?? [],
    docRefs,
  };
}

export default async function AgentDebugPage({ params }: PageProps) {
  const bundle = await fetchAgentBundle(params.role);
  if (!bundle) notFound();
  return <AgentDebugView bundle={bundle} />;
}
