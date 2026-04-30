// lib/agents/sales/inquiryTriager.ts
import type { AgentChipDef } from '@/components/ops/AgentStrip';

export const inquiryTriager: AgentChipDef = {
  name: 'Inquiry Triager',
  cadence: 'every 2 min on inbound',
  status: 'idle', // → 'run' once sales.inquiries + email-ingest webhook ship
  description:
    'Detector / classifier — every inbound (FIT / Group / Wedding / Retreat / B2B / Press / Long-stay), value tier (A/B/C), urgency, sentiment, language, dedupe-match. Routes to Composer / Strategist / Specialist.',
  guardrails: [
    'Approval-required handoff (no auto-send)',
    'Idle until sales.inquiries + ingest webhook live',
    'Audit log per classification',
  ],
};
