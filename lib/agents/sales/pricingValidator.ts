// lib/agents/sales/pricingValidator.ts
import type { AgentChipDef } from '@/components/ops/AgentStrip';

export const pricingValidator: AgentChipDef = {
  name: 'Pricing Validator',
  cadence: 'event-driven · every offer',
  status: 'idle',
  description:
    'Gate — every composed offer (FIT, Group, Package) checked against rate floor, BAR parity, contract floor, 7-day forward displacement. Returns pass / flag / block + reason + suggested fix.',
  guardrails: [
    'Block override = explicit human + audit',
    'No write — read-only validator',
    'Idle until BAR ladder + parity matrix wired',
  ],
};
