// lib/agents/hk/coordinator.ts
// HK Coordinator — sequencing + reassignment recommendations.
// Mode: approval-required (no auto-fire). Cadence: 30 min.

import type { AgentChipDef } from '@/components/ops/AgentStrip';

export const hkCoordinator: AgentChipDef = {
  name: 'HK Coordinator',
  cadence: '30 min',
  status: 'idle', // → 'run' once Gap-H1 + Gap-H2 ship
  description:
    'Detector reads room_status × hk_assignments × arrivals ETA. Composer proposes reassignments and cleaning sequences. All decisions queue for HK Supervisor approval — never auto-executed.',
  guardrails: [
    'Approval-required (HK Supervisor)',
    'No Cloudbeds write — internal sequencing only',
    'Idle until Gap-H1 ops.room_status populated',
  ],
};
