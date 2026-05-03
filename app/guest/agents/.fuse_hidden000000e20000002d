// app/guest/agents/page.tsx
// Guest · Agents — pillar agent governance hub.

import AgentsHub from '@/components/agents/AgentsHub';
import type { AgentChipDef } from '@/components/ops/AgentStrip';

const reputationWatchdog: AgentChipDef = {
  name: 'Reputation Watchdog',
  cadence: 'hourly',
  status: 'idle',
  description: 'Aggregates score deltas across Booking, Google, Tripadvisor, Expedia; flags emerging themes (cleanliness, A/C, food) before they tank rank.',
  guardrails: ['Recommend only', 'No public response without GM approval'],
};

const journeyFrictionDetector: AgentChipDef = {
  name: 'Journey Friction Detector',
  cadence: 'daily 04:00',
  status: 'idle',
  description: 'Walks the full guest journey (booking → pre-arrival → check-in → in-stay → check-out → post-stay) and flags friction points using PMS events + survey + review data.',
  guardrails: ['Read-only', 'Dedupe with SOP backlog'],
};

const inStaySentimentAgent: AgentChipDef = {
  name: 'In-Stay Sentiment',
  cadence: 'every 30 min during stay',
  status: 'idle',
  description: 'Detects friction in real time from messaging, F&B/spa interactions, and door logs; flags rooms at risk of bad review.',
  guardrails: ['Approval-required for proactive contact', 'Privacy filter on chat content'],
};

const surveySynthesizer: AgentChipDef = {
  name: 'Survey Synthesizer',
  cadence: 'weekly',
  status: 'idle',
  description: 'Themes post-stay survey + open text feedback into actionable categories with verbatim quotes; routes to department owner.',
  guardrails: ['PII redaction', 'Sample-size minimum 20 responses'],
};

const loyaltyTrigger: AgentChipDef = {
  name: 'Loyalty Trigger',
  cadence: 'real-time on booking',
  status: 'idle',
  description: 'Identifies returning guests, anniversaries, milestone stays, and high-LTV profiles; recommends recognition gestures.',
  guardrails: ['No automatic comp · GM approves every gesture', 'Spend cap per guest · $50'],
};

const winbackComposer: AgentChipDef = {
  name: 'Win-back Composer',
  cadence: 'weekly · Wed 10:00',
  status: 'idle',
  description: 'Identifies dormant guests (last stay > 18mo) with high pre-COVID frequency; drafts personalized return offers.',
  guardrails: ['Approval-required send', 'Max discount 10%', 'Frequency cap 1/quarter'],
};

const vipPredictor: AgentChipDef = {
  name: 'VIP Predictor',
  cadence: 'on booking',
  status: 'idle',
  description: 'Predicts VIP / high-LTV guests at booking time from booking patterns, channel, and prior stay value; flags for FO + GM pre-arrival.',
  guardrails: ['Recommend only', 'No tier auto-promotion'],
};

export const dynamic = 'force-dynamic';

export default function GuestAgentsPage() {
  return (
    <AgentsHub
      pillarKey="guest"
      pillarLabel="Guest"
      intro="Voice-of-guest agents across reputation, journey, sentiment, loyalty and win-back. Idle until guest profile + survey + reputation feeds are wired."
      agents={[
        reputationWatchdog,
        journeyFrictionDetector,
        inStaySentimentAgent,
        surveySynthesizer,
        loyaltyTrigger,
        winbackComposer,
        vipPredictor,
      ]}
      brandRules={[
        'No public response to a review without GM approval',
        'PII never crosses agent boundaries · redaction enforced',
        'Comp / gesture spend cap $50 per guest · GM sign-off above',
        'No proactive in-stay contact between 22:00–08:00 unless emergency',
      ]}
    />
  );
}
