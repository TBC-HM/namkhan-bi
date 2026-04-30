// lib/agents/hk/linenWatcher.ts
// Linen Watcher — par × forecast occ × cycle-time forecast.
// Mode: approval-required for any external laundry partner engagement. Cadence: hourly.

import type { AgentChipDef } from '@/components/ops/AgentStrip';

export const linenWatcher: AgentChipDef = {
  name: 'Linen Watcher',
  cadence: 'hourly',
  status: 'idle', // → 'run' once Gap-H3 ships
  description:
    'Watches sheet/towel par % vs 14-day occupancy forecast and current laundry cycle. Detects breach risk windows; proposes pull-forward batches or external partner engagement.',
  guardrails: [
    'Approval-required for external laundry partner engagement',
    'No PO write — proposals only',
    'Idle until Gap-H3 ops.linen_pars populated',
  ],
};
