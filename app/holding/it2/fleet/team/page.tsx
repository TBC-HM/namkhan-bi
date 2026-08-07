// app/holding/it2/fleet/team/page.tsx
// Agent Team v2 (brief agent-team-page-v2, slice 2).
// Default view: KPI row + filterable 4-pillar agent list fed by the
// PostgREST bridges public.v_agent_pillars / public.v_fleet_team_kpis
// (claude_md §0.5 — never direct cockpit.*/governance.* reads).
// The original org chart (TeamView) remains available as an optional mode.

import {
  fetchAgents,
  fetchSkills,
  fetchAgentSkills,
  fetchRoleRunStats,
} from '@/lib/cockpit/data';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { TeamModeSwitch } from './TeamModeSwitch';
import type { PillarRow, FleetKpis } from './PillarsView';

export const dynamic = 'force-dynamic';

async function fetchPillars(): Promise<PillarRow[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('v_agent_pillars')
    .select('*')
    .order('department', { ascending: true, nullsFirst: false })
    .order('role', { ascending: true })
    .limit(500);
  if (error) {
    console.error('[fleet-team-v2] fetchPillars error', error);
    return [];
  }
  return (data as PillarRow[]) ?? [];
}

async function fetchFleetKpis(): Promise<FleetKpis | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from('v_fleet_team_kpis').select('*').maybeSingle();
  if (error) {
    console.error('[fleet-team-v2] fetchFleetKpis error', error);
    return null;
  }
  return (data as FleetKpis) ?? null;
}

export default async function CockpitV2TeamPage() {
  const [pillars, kpis, agents, skills, agentSkills, runStats] = await Promise.all([
    fetchPillars(),
    fetchFleetKpis(),
    fetchAgents(),
    fetchSkills(),
    fetchAgentSkills(),
    fetchRoleRunStats(),
  ]);

  return (
    <TeamModeSwitch
      pillars={pillars}
      kpis={kpis}
      agents={agents}
      skills={skills}
      agentSkills={agentSkills}
      runStats={runStats}
    />
  );
}
