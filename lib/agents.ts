// lib/agents.ts
// Static agent registry — placeholder definitions for the AI Agents section.
// All agents are stubbed: status='draft', model='not-yet-deployed'.
// When real Vertex AI / Anthropic functions exist, replace `runStub()` with real calls.

export type AgentStatus = 'live' | 'draft' | 'paused' | 'error';
export type AgentTrigger = 'manual' | 'scheduled' | 'event';

export interface AgentDefinition {
  id: string;                       // slug, used in URLs
  name: string;                     // display name
  category: 'revenue' | 'fb' | 'spa' | 'marketing' | 'ops' | 'forecast';
  oneLiner: string;                 // shown on card
  description: string;              // longer, on detail page
  inputs: AgentInput[];             // form fields when running
  outputType: 'table' | 'chart' | 'narrative' | 'list' | 'scenario';
  defaultPrompt: string;            // editable in Settings
  model: string;                    // e.g. 'gemini-2.5-pro', 'claude-opus-4-7'
  status: AgentStatus;
  trigger: AgentTrigger;
  schedule?: string;                // cron-style if scheduled
  lastRun?: string;                 // ISO timestamp
  accuracy?: number;                // 0-100, for live agents
  runs30d?: number;                 // count
  costPerRunUsd?: number;           // estimated
  emoji: string;                    // visual marker for cards (low effort, looks nice)
}

export interface AgentInput {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multi-select' | 'textarea';
  required?: boolean;
  default?: string | number;
  options?: { value: string; label: string }[];
  hint?: string;
}

export const AGENTS: AgentDefinition[] = [
  {
    id: 'pickup-predictor',
    name: 'Pickup Predictor',
    category: 'forecast',
    emoji: '📈',
    oneLiner: 'Forecast 30/60/90 day arrivals vs STLY',
    description: 'Trained on 3 years of pace data. Predicts whether on-the-books pace will land at, above, or below same time last year. Flags risk windows.',
    inputs: [
      { key: 'horizon', label: 'Horizon', type: 'select', default: '90', options: [
        { value: '30', label: '30 days' }, { value: '60', label: '60 days' }, { value: '90', label: '90 days' }, { value: '180', label: '180 days' },
      ]},
      { key: 'segment', label: 'Segment filter', type: 'select', default: 'all', options: [
        { value: 'all', label: 'All' }, { value: 'ota', label: 'OTA only' }, { value: 'direct', label: 'Direct only' },
      ]},
    ],
    outputType: 'chart',
    defaultPrompt: 'Analyze on-the-books reservations vs STLY for the next {horizon} days. Identify risk windows where pace is >15% behind. For each risk window, suggest 1-2 concrete actions (channel push, geo email, rate adjustment). Be specific with numbers.',
    model: 'gemini-2.5-pro',
    status: 'draft',
    trigger: 'scheduled',
    schedule: '0 7 * * MON',
  },
  {
    id: 'pricing-coach',
    name: 'Pricing Coach',
    category: 'revenue',
    emoji: '💰',
    oneLiner: 'Suggest BAR adjustments by date',
    description: 'Looks at occupancy, pickup pace, comp set, and DOW patterns. Outputs date-by-date BAR suggestions with reasoning.',
    inputs: [
      { key: 'date_from', label: 'From', type: 'date', required: true },
      { key: 'date_to',   label: 'To',   type: 'date', required: true },
      { key: 'aggression', label: 'Strategy', type: 'select', default: 'balanced', options: [
        { value: 'conservative', label: 'Conservative (small moves)' },
        { value: 'balanced', label: 'Balanced' },
        { value: 'aggressive', label: 'Aggressive (max yield)' },
      ]},
    ],
    outputType: 'table',
    defaultPrompt: 'For each date in range, recommend a BAR change (% delta vs current). Consider: current pace vs STLY, on-the-books occupancy, day-of-week pattern, lead-time distribution. Flag dates where occupancy >85% as raise candidates and <40% with <30 days lead as drop candidates.',
    model: 'gemini-2.5-pro',
    status: 'draft',
    trigger: 'manual',
  },
  {
    id: 'fb-capture',
    name: 'F&B Capture Agent',
    category: 'fb',
    emoji: '🍽️',
    oneLiner: 'Rank guests most likely to convert F&B',
    description: 'Identifies in-house and arriving guests with highest F&B propensity but zero current spend. Suggests offer + channel.',
    inputs: [
      { key: 'window', label: 'Guest window', type: 'select', default: 'in_house', options: [
        { value: 'in_house', label: 'In-house now' },
        { value: 'arriving_7d', label: 'Arriving in 7 days' },
        { value: 'arriving_30d', label: 'Arriving in 30 days' },
      ]},
      { key: 'top_n', label: 'Top N guests', type: 'number', default: 10 },
    ],
    outputType: 'list',
    defaultPrompt: 'For each guest in window with F&B spend = $0, score conversion likelihood based on: country (TH/US weak, EU strong), stay length, room type, channel. Output top {top_n} ranked. For each, suggest specific offer (breakfast inclusion, lunch promo, dinner experience) at price point.',
    model: 'gemini-2.5-pro',
    status: 'draft',
    trigger: 'scheduled',
    schedule: '0 9 * * *',
  },
  {
    id: 'spa-capture',
    name: 'Spa Capture Agent',
    category: 'spa',
    emoji: '🌿',
    oneLiner: 'Rank guests most likely to book spa',
    description: 'Same idea as F&B but for spa treatments. Considers stay length, traveling party, prior spa history.',
    inputs: [
      { key: 'window', label: 'Guest window', type: 'select', default: 'in_house', options: [
        { value: 'in_house', label: 'In-house now' },
        { value: 'arriving_7d', label: 'Arriving in 7 days' },
      ]},
      { key: 'therapist_avail', label: 'Therapist availability', type: 'select', default: 'auto', options: [
        { value: 'auto', label: 'Auto-detect' },
        { value: 'high', label: 'High (low utilization)' },
        { value: 'low', label: 'Low (push hard)' },
      ]},
    ],
    outputType: 'list',
    defaultPrompt: 'Score each in-house/arriving guest for spa propensity. Suggest treatment + time slot per guest. Prioritize guests in stays >3 nights and couples.',
    model: 'gemini-2.5-pro',
    status: 'draft',
    trigger: 'manual',
  },
  {
    id: 'ota-mix-optimizer',
    name: 'OTA Mix Optimizer',
    category: 'revenue',
    emoji: '🔀',
    oneLiner: 'Suggest channel rebalancing',
    description: 'Analyzes channel mix vs commission cost vs guest LTV. Flags over-reliance on high-commission channels and direct upside.',
    inputs: [
      { key: 'lookback_days', label: 'Lookback', type: 'number', default: 90 },
    ],
    outputType: 'list',
    defaultPrompt: 'Analyze channel performance over last {lookback_days} days. For each channel: revenue, commission cost, net revenue, ADR, length of stay, repeat rate. Identify imbalances. Suggest 3 specific actions to shift mix toward higher-margin channels.',
    model: 'gemini-2.5-pro',
    status: 'draft',
    trigger: 'manual',
  },
  {
    id: 'outlook-agent',
    name: 'Outlook Agent',
    category: 'forecast',
    emoji: '📊',
    oneLiner: 'Weekly executive summary',
    description: 'Generates a 3-page Monday morning brief: last week performance, current week pace, next 30/60/90 outlook, top 3 actions.',
    inputs: [
      { key: 'audience', label: 'Audience', type: 'select', default: 'owner', options: [
        { value: 'owner', label: 'Owner / Investor' },
        { value: 'gm', label: 'GM / Operations' },
        { value: 'rev', label: 'Revenue Manager' },
      ]},
    ],
    outputType: 'narrative',
    defaultPrompt: 'Write a Monday morning brief for {audience}. Include: 1) last week vs STLY (occ, ADR, RevPAR, GOPPAR), 2) current week pace, 3) 30/60/90 day outlook with risk flags, 4) Top 3 actions ranked by impact. Be blunt, no fluff. Use $ figures, not %.',
    model: 'claude-opus-4-7',
    status: 'draft',
    trigger: 'scheduled',
    schedule: '0 6 * * MON',
  },
  {
    id: 'what-if',
    name: 'What-If Simulator',
    category: 'revenue',
    emoji: '🔮',
    oneLiner: 'Simulate pricing & strategy scenarios',
    description: 'Free-form "what if I do X" scenario tool. Estimates impact on occupancy, ADR, revenue, profit.',
    inputs: [
      { key: 'scenario', label: 'Scenario', type: 'textarea', required: true, hint: 'e.g. "Cut BAR 10% for next 14 nights" or "Add a free breakfast offer for direct bookings"' },
      { key: 'horizon_days', label: 'Time horizon', type: 'number', default: 30 },
    ],
    outputType: 'scenario',
    defaultPrompt: 'Simulate the effect of: {scenario} over the next {horizon_days} days. Estimate impact on: occupancy, ADR, RevPAR, total revenue, GOPPAR. Show baseline vs scenario in a table. List assumptions and sensitivity ranges.',
    model: 'claude-opus-4-7',
    status: 'draft',
    trigger: 'manual',
  },
  {
    id: 'review-responder',
    name: 'Review Responder',
    category: 'marketing',
    emoji: '✍️',
    oneLiner: 'Drafts replies to unanswered reviews',
    description: 'Generates on-brand responses to incoming reviews. Tone matches Soho House casual luxury. Flags ones that need human escalation.',
    inputs: [
      { key: 'tone', label: 'Tone', type: 'select', default: 'warm', options: [
        { value: 'warm', label: 'Warm & personal' },
        { value: 'concise', label: 'Concise & professional' },
        { value: 'apologetic', label: 'Apologetic (for negative)' },
      ]},
      { key: 'auto_publish', label: 'Auto-publish if rating ≥ 4.5', type: 'select', default: 'no', options: [
        { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No (review first)' },
      ]},
    ],
    outputType: 'list',
    defaultPrompt: 'For each unanswered review, draft a response in {tone} tone. Match Namkhan voice: gracious, specific (reference what they mentioned), no corporate-speak. For ratings ≤ 3, flag for human review and suggest specific operational follow-up.',
    model: 'claude-opus-4-7',
    status: 'draft',
    trigger: 'event',
  },
  {
    id: 'dq-auditor',
    name: 'DQ Auditor',
    category: 'ops',
    emoji: '🔍',
    oneLiner: 'Finds data anomalies in Cloudbeds',
    description: 'Continuous data quality watchdog. Flags missing fields, suspicious values, sync gaps. Outputs exception report with severity.',
    inputs: [
      { key: 'severity', label: 'Min severity', type: 'select', default: 'medium', options: [
        { value: 'low', label: 'Low+ (everything)' },
        { value: 'medium', label: 'Medium+' },
        { value: 'high', label: 'High only' },
      ]},
    ],
    outputType: 'table',
    defaultPrompt: 'Scan reservations, transactions, room blocks for anomalies. Examples: missing rate plan, market segment NULL, F&B spend on cancelled stays, transactions without classification, etc. Output ranked exception list with: ID, anomaly type, severity, suggested fix.',
    model: 'gemini-2.5-pro',
    status: 'draft',
    trigger: 'scheduled',
    schedule: '0 4 * * *',
  },
  {
    id: 'comp-set-watcher',
    name: 'Comp Set Watcher',
    category: 'revenue',
    emoji: '👁️',
    oneLiner: 'Flags rate parity breaches',
    description: 'Daily comparison of our rates vs comp set on key OTAs. Alerts when we are >10% above market or undercut our own direct rate.',
    inputs: [
      { key: 'sensitivity', label: 'Alert sensitivity', type: 'select', default: 'medium', options: [
        { value: 'low', label: 'Only major (>15% gap)' },
        { value: 'medium', label: 'Medium (>10%)' },
        { value: 'high', label: 'Tight (>5%)' },
      ]},
    ],
    outputType: 'list',
    defaultPrompt: 'Compare our published rates vs comp set on Booking.com and Expedia. Flag dates where: 1) we are >X% above market, 2) OTA rate undercuts our direct rate, 3) parity breach across channels. List actions to take.',
    model: 'gemini-2.5-pro',
    status: 'draft',
    trigger: 'scheduled',
    schedule: '0 5 * * *',
  },
];

export function getAgent(id: string): AgentDefinition | undefined {
  return AGENTS.find(a => a.id === id);
}

export function agentsByCategory(): Record<string, AgentDefinition[]> {
  const groups: Record<string, AgentDefinition[]> = {};
  for (const a of AGENTS) {
    (groups[a.category] ||= []).push(a);
  }
  return groups;
}

export const CATEGORY_LABELS: Record<string, string> = {
  forecast:  'Forecasting',
  revenue:   'Revenue',
  fb:        'Food & Beverage',
  spa:       'Spa & Activities',
  marketing: 'Marketing',
  ops:       'Operations',
};
