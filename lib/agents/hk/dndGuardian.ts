// lib/agents/hk/dndGuardian.ts
// DND Guardian — multi-day DND welfare-check escalation.
// Mode: approval-required (Guest Services). Cadence: daily 14:00 ICT.

import type { AgentChipDef } from '@/components/ops/AgentStrip';

export const dndGuardian: AgentChipDef = {
  name: 'DND Guardian',
  cadence: 'daily 14:00',
  status: 'idle',
  description:
    'Each afternoon, scans rooms with consecutive DND days. At day 3, escalates to Guest Services per policy with a brand-tone, locale-aware welfare-check draft. Never sends without approval.',
  guardrails: [
    'Approval-required (Guest Services)',
    'No WhatsApp / SMS write — drafts only',
    'Day-3 policy threshold; configurable in settings',
  ],
};
