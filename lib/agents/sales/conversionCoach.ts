// lib/agents/sales/conversionCoach.ts
import type { AgentChipDef } from '@/components/ops/AgentStrip';

export const conversionCoach: AgentChipDef = {
  name: 'Conversion Coach',
  cadence: 'every 15m + 02:00 batch',
  status: 'idle',
  description:
    'Scorer + recommender — score open offers (close prob 0–1), surface won/lost patterns, weekly elasticity / lead-time / segment insights. Cold-start until N≥50 outcomes.',
  guardrails: [
    'Insight-only — no writes',
    'Calibrating until N≥50 closed quotes',
    'Idle until sales.lost_reasons taxonomy live',
  ],
};
