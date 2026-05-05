// app/guest/_components/AgentTopRow.tsx
//
// Reusable single-agent block — fetches governance.agents + last run for one
// agent code and renders status pill + name + schedule + last run minutes-ago.
// Lives at the TOP of every guest/marketing tab (per IA decision 2026-05-05).
//
// If the agent isn't registered in governance.agents yet, renders an honest
// "PLANNED · not registered" stub — never invented status.

import StatusPill, { type StatusTone } from '@/components/ui/StatusPill';
import { supabase } from '@/lib/supabase';
import { metaSm, metaDim } from './GuestShell';

interface Props {
  /** governance.agents.code to load. */
  code: string;
  /** Fallback display name when the agent isn't registered yet. */
  fallbackName: string;
  /** Optional fallback description shown when agent is missing. */
  fallbackHint?: string;
}

const AGENT_TONE: Record<string, StatusTone> = {
  active: 'active',
  beta: 'pending',
  planned: 'inactive',
  paused: 'inactive',
  inactive: 'inactive',
};

const RUN_TONE: Record<string, StatusTone> = {
  success: 'active',
  partial: 'pending',
  failed: 'expired',
  running: 'info',
};

function fmtRel(min: number | null | undefined): string {
  if (min == null) return '—';
  if (min < 60) return `${Math.round(min)}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default async function AgentTopRow({ code, fallbackName, fallbackHint }: Props) {
  const [agentR, lastRunR] = await Promise.all([
    supabase
      .schema('governance')
      .from('agents')
      .select('agent_id, code, name, status, schedule_human, last_run_at')
      .eq('code', code)
      .maybeSingle(),
    supabase
      .schema('governance')
      .from('agent_run_summary')
      .select('status, started_at, minutes_ago')
      .eq('agent_code', code)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const agent = agentR.data as null | {
    agent_id: string; code: string; name: string;
    status: string | null; schedule_human: string | null; last_run_at: string | null;
  };
  const lastRun = lastRunR.data as null | {
    status: string | null; started_at: string | null; minutes_ago: number | null;
  };

  const status = (agent?.status ?? 'planned').toLowerCase();
  const runStatus = (lastRun?.status ?? '').toLowerCase();

  return (
    <>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span className="t-eyebrow" style={{ marginRight: 6 }}>AGENT</span>
        <StatusPill tone={AGENT_TONE[status] ?? 'inactive'}>{status.toUpperCase()}</StatusPill>
        <span style={metaSm}>{agent?.name ?? fallbackName}</span>
        {agent?.schedule_human && <span style={metaDim}>· {agent.schedule_human}</span>}
        {!agent && fallbackHint && <span style={metaDim}>· {fallbackHint}</span>}
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span className="t-eyebrow" style={{ marginRight: 6 }}>LAST RUN</span>
        {lastRun ? (
          <>
            <StatusPill tone={RUN_TONE[runStatus] ?? 'inactive'}>{runStatus.toUpperCase()}</StatusPill>
            <span style={metaDim}>{fmtRel(lastRun.minutes_ago)}</span>
          </>
        ) : (
          <span style={metaDim}>{agent ? 'never' : 'no runs · agent not registered'}</span>
        )}
      </div>
    </>
  );
}
