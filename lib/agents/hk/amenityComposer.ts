// lib/agents/hk/amenityComposer.ts
// Amenity Composer — VIP / honeymoon / anniversary loadout proposer.
// Mode: approval-required. Trigger: check-in event.

import type { AgentChipDef } from '@/components/ops/AgentStrip';

export const amenityComposer: AgentChipDef = {
  name: 'Amenity Composer',
  cadence: 'check-in event',
  status: 'idle',
  description:
    'On check-in, reads guest profile (repeat × stay length × stated occasion) and proposes a loadout within budget caps. Cost stamped on each row; GM approval required for spend > daily cap.',
  guardrails: [
    'Approval-required (GM for cap breach, HK Supervisor for routine)',
    'Bound by governance.amenity_budget',
    'No guest message auto-fire',
  ],
};
