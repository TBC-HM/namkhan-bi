// app/cockpit-v2/team/page.tsx
// Ask 1 — human org chart. Three property scopes (Holding / Namkhan / Donna),
// CEO on top, HODs in a row, workers in a grid under each HOD. Per-agent
// skills (cap_agent_skills JOIN cap_skills), blinking indicator when an
// agent has a cap_skill_call in the last 60 seconds, run counter (lifetime
// + last 7 days), and a clickable archive drawer rendered as a client
// component (TeamView).

import {
  fetchAgents,
  fetchSkills,
  fetchAgentSkills,
  fetchRoleRunStats,
} from '../_lib/data';
import { TeamView } from './TeamView';

export const dynamic = 'force-dynamic';

export default async function CockpitV2TeamPage() {
  const [agents, skills, agentSkills, runStats] = await Promise.all([
    fetchAgents(),
    fetchSkills(),
    fetchAgentSkills(),
    fetchRoleRunStats(),
  ]);

  return (
    <TeamView
      agents={agents}
      skills={skills}
      agentSkills={agentSkills}
      runStats={runStats}
    />
  );
}
