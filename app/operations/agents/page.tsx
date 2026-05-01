// app/operations/agents/page.tsx
// Operations · Agents — pillar agent governance hub.
// Reuses /lib/agents/hk/* + /lib/agents/maint/* roster.

import AgentsHub from '@/components/agents/AgentsHub';
import type { AgentChipDef } from '@/components/ops/AgentStrip';

import { hkCoordinator }     from '@/lib/agents/hk/coordinator';
import { linenWatcher }      from '@/lib/agents/hk/linenWatcher';
import { dndGuardian }       from '@/lib/agents/hk/dndGuardian';
import { amenityComposer }   from '@/lib/agents/hk/amenityComposer';

import { ppmScheduler }      from '@/lib/agents/maint/ppmScheduler';
import { slaWatcher }        from '@/lib/agents/maint/slaWatcher';
import { assetHealthScout }  from '@/lib/agents/maint/assetHealthScout';
import { energyAnomalyHunter } from '@/lib/agents/maint/energyAnomalyHunter';

// Cross-ops agents (F&B / spa / today briefing) — defined inline until they get their own files.
const todayBriefer: AgentChipDef = {
  name: 'Today Briefer',
  cadence: '06:30 daily',
  status: 'idle',
  description: 'Compiles arrivals, VIPs, F&B covers, spa bookings, weather, and standout events into the morning huddle one-pager.',
  guardrails: ['No external send · GM-only digest', 'Pulls from PMS + POS + spa'],
};

const fbMenuEngineer: AgentChipDef = {
  name: 'F&B Menu Engineer',
  cadence: 'weekly · Mon 03:00',
  status: 'idle',
  description: 'Star/Plowhorse/Puzzle/Dog classification across the menu using POS data; flags low-margin / low-popularity items.',
  guardrails: ['Recommendation only · no auto-86', 'Min 30d sales window'],
};

const spaPacer: AgentChipDef = {
  name: 'Spa Booking Pacer',
  cadence: 'hourly',
  status: 'idle',
  description: 'Predicts spa fill rate vs. capacity; surfaces upsell windows for in-house guests and flags dead therapist hours.',
  guardrails: ['Approval-required upsell push', 'Therapist roster respected'],
};

export const dynamic = 'force-dynamic';

export default function OperationsAgentsPage() {
  return (
    <AgentsHub
      pillarKey="operations"
      pillarLabel="Operations"
      intro="Property-floor agents across housekeeping, maintenance, F&B, spa and today briefing. Most idle until ops schemas + sensor feeds ship."
      agents={[
        todayBriefer,
        hkCoordinator,
        linenWatcher,
        dndGuardian,
        amenityComposer,
        ppmScheduler,
        slaWatcher,
        assetHealthScout,
        energyAnomalyHunter,
        fbMenuEngineer,
        spaPacer,
      ]}
      brandRules={[
        'Quiet hours respected (22:00–07:00) for all guest-facing nudges',
        'No room-status auto-mutation · housekeeping confirms physical state',
        'PPM lockouts cannot push asset offline during occupied stays',
      ]}
    />
  );
}
