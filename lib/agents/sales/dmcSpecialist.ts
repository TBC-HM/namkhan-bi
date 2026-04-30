// lib/agents/sales/dmcSpecialist.ts
import type { AgentChipDef } from '@/components/ops/AgentStrip';

export const dmcSpecialist: AgentChipDef = {
  name: 'DMC / B2B Specialist',
  cadence: 'event-driven on B2B triage',
  status: 'idle',
  description:
    'Wholesaler-aware — contracted-rate-aware quoting, allotment-aware blocks, partner-tier upsell, contract floor enforcement. Counter-quote on floor breach.',
  guardrails: [
    'Always human approval (Reservations Lead) — never auto',
    'Idle until sales.dmc_contracts seeded',
    'Contract floor breach = hard block',
  ],
};
