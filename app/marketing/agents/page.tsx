// app/marketing/agents/page.tsx
// Marketing · Agents — pillar agent governance hub.

import AgentsHub from '@/components/agents/AgentsHub';
import type { AgentChipDef } from '@/components/ops/AgentStrip';

const reviewResponder: AgentChipDef = {
  name: 'Review Responder',
  cadence: 'every 30 min',
  status: 'idle',
  description: 'Drafts responses to new OTA + Google reviews using brand-voice guidelines. Severity-tiered (5★ short ack · 1-2★ escalate to GM).',
  guardrails: ['Approval-required for every send', 'No legal/medical claims', 'No comp offers without GM'],
};

const socialComposer: AgentChipDef = {
  name: 'Social Composer',
  cadence: 'daily 09:00',
  status: 'idle',
  description: 'Drafts IG/FB/TikTok posts from upcoming events, weather, F&B specials, and guest-permitted UGC. Outputs caption + hashtag pack + schedule slot.',
  guardrails: ['Brand voice locked', 'No guest faces without consent log', 'Music license check on Reels'],
};

const reputationAlerter: AgentChipDef = {
  name: 'Reputation Alerter',
  cadence: 'hourly',
  status: 'idle',
  description: 'Watches Booking score drops, Google rating shifts, TripAdvisor rank changes, and viral threats; routes to GM with playbook.',
  guardrails: ['Page GM if rating drops > 0.2 in 7d', 'Aggregator-source verified before alert'],
};

const influencerOutreach: AgentChipDef = {
  name: 'Influencer Outreach',
  cadence: 'weekly',
  status: 'idle',
  description: 'Surfaces qualified creators (audience fit, eng rate, brand safety); drafts outreach + comp package; logs in CRM.',
  guardrails: ['Min audience filter · 10k', 'Brand-safety screen', 'GM approval per offer'],
};

const contentCalendarPlanner: AgentChipDef = {
  name: 'Content Calendar Planner',
  cadence: 'weekly · Sun 18:00',
  status: 'idle',
  description: 'Plans next-7d content across owned channels around peak windows, festivals, weather, and upcoming inventory pressure.',
  guardrails: ['No overlap with paid media flights', 'Festival blackout dates honored'],
};

const seoMonitor: AgentChipDef = {
  name: 'SEO Monitor',
  cadence: 'daily 02:00',
  status: 'idle',
  description: 'Tracks brand + non-brand keyword positions, GMB photo updates, schema integrity, and broken inbound links from partner sites.',
  guardrails: ['Recommendation only', 'No live site mutations'],
};

const paidMediaOptimizer: AgentChipDef = {
  name: 'Paid Media Optimizer',
  cadence: 'every 4h',
  status: 'paused',
  description: 'Watches Google Ads / Meta / BDC TravelAds / Expedia bid efficiency; auto-pauses underperforming campaigns when CPA breaches threshold.',
  guardrails: ['Auto-pause on > $60 CPA', 'Spend cap enforced', 'Daily velocity cap $500/day'],
};

export const dynamic = 'force-dynamic';

export default function MarketingAgentsPage() {
  return (
    <AgentsHub
      pillarKey="marketing"
      pillarLabel="Marketing"
      intro="Brand-reach agents across reviews, social, reputation, influencers, content, SEO, and paid media. Mostly idle until ingest + ad-API connections ship."
      agents={[
        reviewResponder,
        socialComposer,
        reputationAlerter,
        influencerOutreach,
        contentCalendarPlanner,
        seoMonitor,
        paidMediaOptimizer,
      ]}
      spendCapMonthly={5000}
      spendUsedMtd={3200}
      brandRules={[
        'Brand voice locked · no superlatives ("luxury", "best", "world-class") without owner approval',
        'No guest faces / property interiors in paid creative without consent log',
        'No price discounting in paid messaging > 15%',
        'Festival / blackout dates respected for promotional pushes',
      ]}
    />
  );
}
