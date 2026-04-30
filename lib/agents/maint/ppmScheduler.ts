// lib/agents/maint/ppmScheduler.ts
// PPM Scheduler — generates daily PPM tasks from templates.

import type { AgentChipDef } from '@/components/ops/AgentStrip';

export const ppmScheduler: AgentChipDef = {
  name: 'PPM Scheduler',
  cadence: 'daily 06:00',
  status: 'idle',
  description:
    'Walks ops.ppm_templates and generates next-N-day PPM tasks per asset. Skips during occupancy peaks (>90%) and blackout windows. Auto-assigns to Maintenance Lead by default.',
  guardrails: [
    'Approval-required for blackout-window override',
    'No external write — internal task creation only',
    'Idle until Gap-M5 templates seeded',
  ],
};
