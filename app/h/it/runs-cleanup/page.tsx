// app/h/it/runs-cleanup/page.tsx
// Prompt 5 — agent-runs-cleanup. Audit dashboard for 318 stuck `queued`
// runs in governance.agent_runs.
//
// PHASE-1 (this commit): READ-ONLY display. Lists runs grouped by agent,
// shows hours-stuck, payload preview. Action buttons (Retry / Archive)
// are stubbed until the migration ticket adds the SECURITY DEFINER RPCs
// and the missing columns (retry_count, archived_at, archive_reason).
//
// See cockpit.intake_items ticket "agent-runs-cleanup migration" for the
// schema work needed before actions go live.

import { createClient } from '@/lib/supabase/server';
import Page from '@/components/page/Page';
import RunsCleanupClient from '@/components/cockpit/RunsCleanupClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface StuckRun {
  run_id: string;
  agent_id: string;
  agent_role: string;
  agent_name: string;
  property_id: number | null;
  status: string;
  started_at: string;
  hours_stuck: number;
  input_excerpt: string;
  error_message: string | null;
}

const STUCK_THRESHOLD_MIN = 15;

export default async function RunsCleanupPage() {
  const supabase = createClient();

  // Stuck = status=queued AND started_at older than threshold.
  // (We don't have a separate `queued_at` column yet — started_at is the
  // closest analog. The migration ticket adds queued_at + retry_count.)
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MIN * 60 * 1000).toISOString();

  const { data: runsRaw, error } = await supabase
    .schema('governance')
    .from('agent_runs')
    .select('run_id, agent_id, property_id, status, started_at, input, error_message')
    .eq('status', 'queued')
    .lt('started_at', cutoff)
    .order('started_at', { ascending: true })
    .limit(500);

  // Look up agent names in a single batched query
  const agentIds = Array.from(new Set((runsRaw ?? []).map((r) => r.agent_id as string)));
  let agentMap = new Map<string, { role: string; display_name: string }>();
  if (agentIds.length > 0) {
    const { data: agents } = await supabase
      .schema('cockpit')
      .from('id_agents')
      .select('agent_id, role, display_name')
      .in('agent_id', agentIds);
    agentMap = new Map(
      (agents ?? []).map((a) => [
        a.agent_id as string,
        { role: a.role as string, display_name: (a.display_name ?? a.role) as string },
      ]),
    );
  }

  const now = Date.now();
  const runs: StuckRun[] = (runsRaw ?? []).map((r) => {
    const startedMs = new Date(r.started_at as string).getTime();
    const hours = Math.max(0, (now - startedMs) / 3_600_000);
    const inputStr = r.input ? JSON.stringify(r.input).slice(0, 240) : '';
    const agent = agentMap.get(r.agent_id as string);
    return {
      run_id: r.run_id as string,
      agent_id: r.agent_id as string,
      agent_role: agent?.role ?? '?',
      agent_name: agent?.display_name ?? '(unknown agent)',
      property_id: (r.property_id ?? null) as number | null,
      status: r.status as string,
      started_at: r.started_at as string,
      hours_stuck: Math.round(hours * 10) / 10,
      input_excerpt: inputStr,
      error_message: (r.error_message ?? null) as string | null,
    };
  });

  // Group by agent
  const byAgent = new Map<string, StuckRun[]>();
  for (const run of runs) {
    const key = `${run.agent_role}|${run.agent_name}`;
    const arr = byAgent.get(key) ?? [];
    arr.push(run);
    byAgent.set(key, arr);
  }

  const summary = {
    total: runs.length,
    agents: byAgent.size,
    over_24h: runs.filter((r) => r.hours_stuck >= 24).length,
    over_48h: runs.filter((r) => r.hours_stuck >= 48).length,
    error: error?.message ?? null,
  };

  return (
    <Page
      eyebrow="IT · Runtime"
      title={
        <>
          Stuck runs <em style={{ color: 'var(--accent, #a8854a)' }}>cleanup</em>
        </>
      }
    >
      <RunsCleanupClient
        summary={summary}
        runsByAgent={Array.from(byAgent.entries()).map(([key, items]) => ({
          key,
          role: items[0].agent_role,
          name: items[0].agent_name,
          items,
        }))}
      />
    </Page>
  );
}
