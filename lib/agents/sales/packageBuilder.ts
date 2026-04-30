// lib/agents/sales/packageBuilder.ts
import type { AgentChipDef } from '@/components/ops/AgentStrip';

export const packageBuilder: AgentChipDef = {
  name: 'Package Builder',
  cadence: 'weekly Mon 06:00 + on-demand',
  status: 'idle',
  description:
    'Package composer — assembles seasonal / themed packages (Honeymoon, Wellness, Coffee Trail, Cultural) with margin floor, brand voice check, vendor commitments, content brief.',
  guardrails: [
    'Marketing Content Agent + RM approval before publish',
    'Vendor commitments locked before catalog write',
    'Idle until sales.packages + vendor rate cards live',
  ],
};
