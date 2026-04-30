// lib/agents/maint/slaWatcher.ts
// SLA Watcher — applies governance.agents mandate (urgent 4h, corrective 48h, cosmetic 7d).

import type { AgentChipDef } from '@/components/ops/AgentStrip';

export const slaWatcher: AgentChipDef = {
  name: 'SLA Watcher',
  cadence: '30 min',
  status: 'idle',
  description:
    'Reads ops.maintenance_tickets and applies SLA rules from governance.agents (urgent 4h, corrective 48h, cosmetic 7d). Flags rooms approaching breach windows. Recommends reassignment, escalation, or vendor dispatch.',
  guardrails: [
    'Approval-required for vendor dispatch',
    'No PO write — dispatch proposals only',
    'Idle until Gap-M1 ops.maintenance_tickets has rows',
  ],
};
