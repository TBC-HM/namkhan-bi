// app/cockpit-v2/agent/[role]/runs/page.tsx
//
// PBS 2026-05-17: chronological runs list per agent. Red/green from
// cockpit_audit_log.success. Click any row to inspect input/output/error.
// Confirm or Dismiss-with-note pipes to /api/cockpit-v2/agent-feedback —
// dismiss creates a prompt-fix ticket for runner_v3.

import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { RunsView } from './RunsView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  params: { role: string };
}

export default async function AgentRunsPage({ params }: PageProps) {
  const sb = getSupabaseAdmin();

  const { data: agent } = await sb.schema('cockpit')
    .from('id_agents')
    .select('role, display_name, dept, property_id, scope, status')
    .eq('role', params.role)
    .limit(1)
    .maybeSingle();

  const { data: runs, error } = await sb
    .from('cockpit_audit_log')
    .select('id, created_at, agent, action, target, success, reasoning, input_tokens, output_tokens, cost_usd_milli, tool_trace, duration_ms, notes, metadata, ticket_id')
    .eq('agent', params.role)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) console.error('[runs] fetch error', error);

  if (!agent && (!runs || runs.length === 0)) {
    // Don't 404 — show empty state with hint
  }

  return (
    <RunsView
      role={params.role}
      agent={agent}
      runs={runs ?? []}
    />
  );
}
