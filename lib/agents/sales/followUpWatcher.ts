// lib/agents/sales/followUpWatcher.ts
import type { AgentChipDef } from '@/components/ops/AgentStrip';

export const followUpWatcher: AgentChipDef = {
  name: 'Follow-up Watcher',
  cadence: 'hourly + D1/D3/D7/D14',
  status: 'idle',
  description:
    'Chase unanswered quotes at 24h / 72h / 7d / 14d; auto-archive at 21d; language-localised templates; auto-pause on guest reply.',
  guardrails: [
    'Tier-1 auto after 90d validation; approval-req until then',
    'Auto-archive logged + reversible 7d',
    'Idle until quote outcome capture wired',
  ],
};
