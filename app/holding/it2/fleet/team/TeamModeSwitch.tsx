'use client';

// app/holding/it2/fleet/team/TeamModeSwitch.tsx
// Slice 2 of agent-team-page-v2: the 4-pillar list is now the DEFAULT view;
// the 112-node org chart is demoted to an optional mode behind this toggle.

import { useState } from 'react';
import { TeamView } from './TeamView';
import { PillarsView, type PillarRow, type FleetKpis } from './PillarsView';
import type { Agent, Skill, AgentSkill, RoleRunStats } from '@/lib/cockpit/types';

type Props = {
  pillars: PillarRow[];
  kpis: FleetKpis | null;
  agents: Agent[];
  skills: Skill[];
  agentSkills: AgentSkill[];
  runStats: Record<string, RoleRunStats>;
};

export function TeamModeSwitch({ pillars, kpis, agents, skills, agentSkills, runStats }: Props) {
  const [mode, setMode] = useState<'pillars' | 'orgchart'>('pillars');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {(['pillars', 'orgchart'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              background: mode === m ? '#F4EFE2' : 'transparent',
              border: '1px solid #E6DFCC',
              borderColor: mode === m ? 'var(--primary, #1F3A2E)' : '#E6DFCC',
              borderRadius: 4, padding: '4px 12px', fontSize: 12, cursor: 'pointer',
              fontWeight: mode === m ? 600 : 400,
              color: mode === m ? 'var(--primary, #1F3A2E)' : 'var(--ink-soft, #5A5A5A)',
              fontFamily: 'inherit',
            }}
          >
            {m === 'pillars' ? 'Agents & pillars' : 'Org chart'}
          </button>
        ))}
      </div>
      {mode === 'pillars' ? (
        <PillarsView rows={pillars} kpis={kpis} />
      ) : (
        <TeamView agents={agents} skills={skills} agentSkills={agentSkills} runStats={runStats} />
      )}
    </div>
  );
}
