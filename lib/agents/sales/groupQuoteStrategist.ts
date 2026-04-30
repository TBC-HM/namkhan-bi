// lib/agents/sales/groupQuoteStrategist.ts
import type { AgentChipDef } from '@/components/ops/AgentStrip';

export const groupQuoteStrategist: AgentChipDef = {
  name: 'Group Quote Strategist',
  cadence: 'event-driven on Group triage',
  status: 'idle',
  description:
    'Group composer — multi-room block + F&B forecast + meeting + activities + transfers + discount band against margin floor; displacement check vs /revenue forecast. Outputs Bronze/Silver/Gold tiered proposal.',
  guardrails: [
    'RM approval required if discount > segment guardrail',
    'Cloudbeds room-block write — approval req',
    'Idle until sales.quotes + RM guardrail config live',
  ],
};
