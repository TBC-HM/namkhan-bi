// lib/agents/sales/autoOfferComposer.ts
import type { AgentChipDef } from '@/components/ops/AgentStrip';

export const autoOfferComposer: AgentChipDef = {
  name: 'Auto-Offer Composer',
  cadence: 'event-driven on FIT triage',
  status: 'run',
  description:
    'FIT composer — auto-draft a personalised offer (rooms, rates, add-ons, LOS-optimised stay extension, brand-voiced copy in target language) within 5 min of triage; target P90 ≤ 15 min reply.',
  guardrails: [
    'Never auto-sends (Tier-2 forever-approval)',
    'Pricing Validator gate before draft surfaces to queue',
    'Brand voice doc required before activation',
  ],
};
