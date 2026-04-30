// lib/agents/maint/energyAnomalyHunter.ts
// Energy Anomaly Hunter — weather-normalised kWh/m³ deviations.

import type { AgentChipDef } from '@/components/ops/AgentStrip';

export const energyAnomalyHunter: AgentChipDef = {
  name: 'Energy Anomaly Hunter',
  cadence: '4 h',
  status: 'idle',
  description:
    'Compares meter readings against weather-normalised baselines (HDD/CDD adjusted). Detects spikes that suggest leak, AC fault, or operating-hours drift. Composes a ticket draft on detection.',
  guardrails: [
    'Approval-required for ticket creation > "cosmetic" priority',
    'Read-only on energy + weather sources',
    'Idle until Gap-M4 ops.energy_readings + weather_norm populated',
  ],
};
