// lib/agents/maint/assetHealthScout.ts
// Asset Health Scout — daily MTBF + last-intervention sweep.

import type { AgentChipDef } from '@/components/ops/AgentStrip';

export const assetHealthScout: AgentChipDef = {
  name: 'Asset Health Scout',
  cadence: 'daily 06:00',
  status: 'idle',
  description:
    'Each morning, computes asset health score from ticket history × MTBF × age. Flags amber/red assets and proposes PPM acceleration or replacement queue entry.',
  guardrails: [
    'Approval-required for replacement queue write',
    'Read-only on ops.assets / ops.maintenance_tickets',
    'Idle until Gap-M2 census complete (~140 assets)',
  ],
};
