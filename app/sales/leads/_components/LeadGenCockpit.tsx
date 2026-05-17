// app/sales/leads/_components/LeadGenCockpit.tsx
//
// PBS 2026-05-16: AI Lead-Gen Cockpit — the operator surface for running
// multi-ICP lead-acquisition + email-sequence + inbox-watch operations.
//
// Mental model: think like a B2B sales-ops manager who knows every trick.
// The cockpit is a *tools-chain orchestrator*. Per ICP it picks the right
// source (Apollo / Sales Nav / Clay / Phantombuster / Outscraper / Bright
// Data / Crunchbase / Muck Rack), waterfalls through enrichment (Clay +
// Hunter + ZoomInfo + Cognism + NeverBounce), scores, personalizes, sends
// through warm-IP infra (Instantly / Smartlead / Lemlist), and turns
// replies into an inbox where the human is the *editor*, not the responder.
//
// Surfaces (top → bottom):
//   1. KPI band — 6 tiles (today's leads, in sequence, awaiting approval,
//      response rate 30d, hot leads, meetings booked MTD)
//   2. Active campaigns — 1 card per ICP with tools chain, daily target,
//      response rate, status
//   3. Production loop — 8 steps (ICP signal → reply)
//   4. Conversation inbox — list of active email threads with AI-drafted
//      reply preview; human Approve / Edit / Skip / Mark Hot
//   5. Agent fleet — 12 specialists
//   6. Right rail — ICP roster · Tools stack · Deliverability health ·
//      Guardrails
//
// Phase 2 wires sales_ai.* schema (campaigns, threads, replies, deliverability)
// and lights up the 12 agents via cap_skills. Today it renders the spec.

import type { ReactNode } from 'react';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';

interface Props {
  liveCounts: { total: number; raw: number; inPipeline: number; won30d: number };
}

// ─── Data ─────────────────────────────────────────────────────────────────

type CampaignStatus = 'Running' | 'Warming' | 'Paused' | 'Optimizing' | 'Needs Setup' | 'Stopped';
type IcpClass = 'B2B' | 'B2B2C' | 'B2C';

interface Campaign {
  id: string;
  icpName: string;
  icpClass: IcpClass;
  market: string;
  dailyTarget: number;
  delivered7d: number;
  responseRate: string;
  bookedMtd: number;
  cplUsd: number | null;          // PBS 2026-05-16: cost-per-lead, null = no spend yet
  spend7dUsd: number;              // PBS 2026-05-16: total tool-spend last 7 days
  sources: string[];
  enrich: string[];
  outreach: string;
  status: CampaignStatus;
}

const CAMPAIGNS: Campaign[] = [
  { id: 'c1',  icpName: 'Yoga Retreat Hosts',           icpClass: 'B2B',   market: 'EU · US',         dailyTarget: 5,  delivered7d: 32, responseRate: '22%', bookedMtd: 3, cplUsd:  4.20, spend7dUsd: 134, sources: ['Sales Navigator', 'Apollo', 'Instagram'], enrich: ['Clay', 'Hunter', 'NeverBounce'], outreach: 'Instantly',           status: 'Running' },
  { id: 'c2',  icpName: 'Corporate HR · Group Retreats', icpClass: 'B2B',   market: 'DACH · UK · SG',  dailyTarget: 5,  delivered7d: 28, responseRate: '14%', bookedMtd: 2, cplUsd:  6.80, spend7dUsd: 190, sources: ['Sales Navigator', 'Apollo', 'BuiltWith'],  enrich: ['Clay', 'ZoomInfo', 'Hunter'],    outreach: 'Smartlead',           status: 'Running' },
  { id: 'c3',  icpName: 'DMC Partners · APAC',           icpClass: 'B2B',   market: 'TH · SG · HK · JP', dailyTarget: 3, delivered7d: 18, responseRate: '31%', bookedMtd: 1, cplUsd:  3.10, spend7dUsd:  56, sources: ['Crunchbase', 'Clay'],                       enrich: ['Clay', 'Cognism'],               outreach: 'Lemlist',             status: 'Running' },
  { id: 'c4',  icpName: 'Luxury Travel Advisors',        icpClass: 'B2B',   market: 'US · EU',         dailyTarget: 4,  delivered7d: 24, responseRate: '19%', bookedMtd: 2, cplUsd:  5.40, spend7dUsd: 130, sources: ['Sales Navigator', 'Virtuoso list'],         enrich: ['Clay', 'Hunter'],                outreach: 'Instantly',           status: 'Running' },
  { id: 'c5',  icpName: 'Wedding Planners · Asia',       icpClass: 'B2B',   market: 'SG · HK · TH',    dailyTarget: 3,  delivered7d: 16, responseRate: '11%', bookedMtd: 0, cplUsd:  7.20, spend7dUsd: 116, sources: ['Phantombuster IG', 'Sales Navigator'],      enrich: ['Hunter', 'NeverBounce'],         outreach: 'Lemlist',             status: 'Optimizing' },
  { id: 'c6',  icpName: 'Wellness Brand Founders',       icpClass: 'B2B',   market: 'US · EU',         dailyTarget: 4,  delivered7d: 23, responseRate: '26%', bookedMtd: 4, cplUsd:  4.90, spend7dUsd: 113, sources: ['Crunchbase', 'Clay', 'LinkedIn'],           enrich: ['Clay', 'ZoomInfo'],              outreach: 'Smartlead',           status: 'Running' },
  { id: 'c7',  icpName: 'Press · Travel Journalists',    icpClass: 'B2B',   market: 'EU · US · AU',    dailyTarget: 2,  delivered7d: 12, responseRate: '38%', bookedMtd: 1, cplUsd:  2.80, spend7dUsd:  34, sources: ['Muck Rack', 'Sales Navigator'],             enrich: ['Hunter', 'NeverBounce'],         outreach: 'Manual + Instantly',  status: 'Running' },
  { id: 'c8',  icpName: 'Conscious Food Bloggers',       icpClass: 'B2B2C', market: 'US · EU · Asia',  dailyTarget: 5,  delivered7d: 27, responseRate: '17%', bookedMtd: 1, cplUsd:  3.60, spend7dUsd:  97, sources: ['Phantombuster IG', 'Outscraper'],           enrich: ['Hunter', 'Clay'],                outreach: 'Lemlist',             status: 'Running' },
  { id: 'c9',  icpName: 'Digital Detox Coaches',         icpClass: 'B2B2C', market: 'DACH · UK · US',  dailyTarget: 3,  delivered7d: 14, responseRate: '24%', bookedMtd: 1, cplUsd:  4.10, spend7dUsd:  57, sources: ['Phantombuster IG', 'Sales Navigator'],      enrich: ['Hunter', 'NeverBounce'],         outreach: 'Instantly',           status: 'Running' },
  { id: 'c10', icpName: 'Mystique Explorer Editors',     icpClass: 'B2B',   market: 'EU · US',         dailyTarget: 2,  delivered7d: 9,  responseRate: '29%', bookedMtd: 0, cplUsd:  5.80, spend7dUsd:  52, sources: ['Muck Rack', 'Crunchbase'],                  enrich: ['Hunter', 'Clay'],                outreach: 'Manual',              status: 'Warming' },
  { id: 'c11', icpName: 'Influencer Affiliates · Yoga',  icpClass: 'B2B2C', market: 'US · EU · AU',    dailyTarget: 5,  delivered7d: 29, responseRate: '12%', bookedMtd: 0, cplUsd:  3.90, spend7dUsd: 113, sources: ['Phantombuster IG', 'Phantombuster TT'],     enrich: ['Hunter'],                        outreach: 'Lemlist',             status: 'Optimizing' },
  { id: 'c12', icpName: 'EU Wellness Consumers',         icpClass: 'B2C',   market: 'DACH · UK · NL',  dailyTarget: 20, delivered7d: 0,  responseRate: '—',   bookedMtd: 0, cplUsd:  null, spend7dUsd:   0, sources: ['Funnel · /marketing/funnels'],              enrich: ['Lead-magnet form'],              outreach: 'Email nurture sequence', status: 'Needs Setup' },
];

// Weighted-average cost per lead across active campaigns
const ACTIVE_FOR_CPL = CAMPAIGNS.filter((c) => c.cplUsd != null && c.delivered7d > 0);
const CPL_AVG_USD = ACTIVE_FOR_CPL.reduce((s, c) => s + (c.cplUsd! * c.delivered7d), 0) / ACTIVE_FOR_CPL.reduce((s, c) => s + c.delivered7d, 0);
const SPEND_7D_TOTAL = CAMPAIGNS.reduce((s, c) => s + c.spend7dUsd, 0);

// ─── Production loop ──────────────────────────────────────────────────────

const LOOP: { step: string; title: string; desc: string }[] = [
  { step: '01', title: 'ICP Signal',  desc: 'Define + refine each ICP: market · role · seniority · keywords · tech stack · intent triggers.' },
  { step: '02', title: 'Source Pick', desc: 'Best source per ICP: Sales Nav · Apollo · Clay · Phantombuster · Crunchbase · Muck Rack.' },
  { step: '03', title: 'Scrape',      desc: 'Run scraper · respect robots · rate-limit · rotate proxies (Bright Data) for protected sources.' },
  { step: '04', title: 'Enrich',      desc: 'Waterfall: Clay → ZoomInfo → Cognism → Hunter → Snov. Stop at first valid hit.' },
  { step: '05', title: 'Verify + Score', desc: 'NeverBounce email validation · role-fit + intent score · drop fails before sending.' },
  { step: '06', title: 'Personalize', desc: 'Opening line + body + CTA tuned to ICP + intent signal. Reality Agent rejects fabrications.' },
  { step: '07', title: 'Send',        desc: 'Instantly / Smartlead / Lemlist · multi-inbox rotation · timezone-aware sending windows.' },
  { step: '08', title: 'Reply · Loop', desc: 'AI drafts response · human approves or edits · sequence resumes · hot leads escalate.' },
];

// ─── Conversation inbox ───────────────────────────────────────────────────

type ThreadStatus =
  | 'Sent · awaiting reply'
  | 'AI draft · awaiting approval'
  | 'Hot · human responded'
  | 'In sequence · touch 2/4'
  | 'Booked meeting'
  | 'Reality flag · review'
  | 'Bounced';

interface Thread {
  id: string;
  from: string;
  fromRole: string;
  fromCompany: string;
  icp: string;
  lastSnippet: string;
  aiDraft?: string;
  status: ThreadStatus;
  age: string;
}

const THREADS: Thread[] = [
  {
    id: 't1', from: 'Lara Hoffmann', fromRole: 'Founder · Reset Retreats',     fromCompany: 'Berlin · DE',
    icp: 'Yoga Retreat Hosts',
    lastSnippet: '"Yes I\'d be open to hosting one in late September — what does your retreat-host pricing look like for a 12-guest week?"',
    aiDraft: 'Hi Lara — September works on our end. For a 12-guest week we typically bundle full venue + 3 daily meals + 1 spa session per guest at €18.5k. I\'ll send a host deck shortly. Want to lock provisional dates first?',
    status: 'AI draft · awaiting approval',
    age: '2h ago',
  },
  {
    id: 't2', from: 'Marie Lefèvre', fromRole: 'Travel Editor · Condé Nast Traveller', fromCompany: 'Paris · FR',
    icp: 'Press · Travel Journalists',
    lastSnippet: '"Could be interested in a piece on slow-travel Laos. Are you available for a 3-night press visit in October?"',
    status: 'Hot · human responded',
    age: '5h ago',
  },
  {
    id: 't3', from: 'Thomas Krause', fromRole: 'Head of People · Vorwerk',     fromCompany: 'Wuppertal · DE',
    icp: 'Corporate HR · Group Retreats',
    lastSnippet: '"We\'re planning a 20-person leadership offsite in Q1 2027. Send what you\'ve got for groups of that size."',
    aiDraft: 'Hi Thomas — 20-person leadership offsite is right in our sweet spot (we host 14-22-pax groups regularly). Q1 2027 has good availability. I\'ll prepare a tailored Corporate Retreat deck — could you share the 3 outcomes you want from the offsite so I can shape it around them?',
    status: 'AI draft · awaiting approval',
    age: '1d ago',
  },
  {
    id: 't4', from: 'Maya Patel',    fromRole: 'Director · Patel Travel Co.',  fromCompany: 'Mumbai · IN',
    icp: 'DMC Partners · APAC',
    lastSnippet: '"Touch 3/4 — sequence resumes on Friday with case study email."',
    status: 'In sequence · touch 2/4',
    age: '3d ago',
  },
  {
    id: 't5', from: 'Sofia Bergström', fromRole: 'Founder · Northern Wellness', fromCompany: 'Stockholm · SE',
    icp: 'Wellness Brand Founders',
    lastSnippet: '"Booked — Thursday 14:00 CET via Calendly. Calendar invite sent."',
    status: 'Booked meeting',
    age: '6h ago',
  },
  {
    id: 't6', from: 'James Whitmore',  fromRole: 'Wedding Planner · Whitmore & Co', fromCompany: 'Singapore · SG',
    icp: 'Wedding Planners · Asia',
    lastSnippet: '"Sent first touch yesterday — no open yet. Sequence will retry on day 4."',
    status: 'Sent · awaiting reply',
    age: '1d ago',
  },
  {
    id: 't7', from: 'Anna Becker',     fromRole: 'Senior Editor · Geo Saison', fromCompany: 'Hamburg · DE',
    icp: 'Mystique Explorer Editors',
    lastSnippet: '"Interesting destination. Could you confirm whether \'monks at 4am\' shots are 1) real and 2) shareable without staging?"',
    aiDraft: 'Hi Anna — yes, real. The almsgiving (tak bat) starts ~5:30am along Sakkaline Road — we walk guests there silently and never stage it. I can share 4 unedited frames from last week if useful. Happy to host you on a press visit so you can see it firsthand.',
    status: 'AI draft · awaiting approval',
    age: '8h ago',
  },
  {
    id: 't8', from: 'Yuki Tanaka',     fromRole: 'Trip Designer · Wabi Travel', fromCompany: 'Tokyo · JP',
    icp: 'Luxury Travel Advisors',
    lastSnippet: '"フォローアップ — touch 2/4 sent in JP, awaiting reply."',
    status: 'In sequence · touch 2/4',
    age: '2d ago',
  },
  {
    id: 't9', from: 'Carlos Mendes',   fromRole: 'Editor · Conde Nast Portugal', fromCompany: 'Lisbon · PT',
    icp: 'Press · Travel Journalists',
    lastSnippet: '"Sent personalized note · referenced his March piece on Luang Prabang."',
    status: 'Sent · awaiting reply',
    age: '4h ago',
  },
  {
    id: 't10', from: 'Hannah Müller',  fromRole: 'Detox Coach · Drei Tage Stille', fromCompany: 'Munich · DE',
    icp: 'Digital Detox Coaches',
    lastSnippet: '"Reality flag · AI draft claimed we have a \'silent retreat\' which is not part of our offering."',
    status: 'Reality flag · review',
    age: '12h ago',
  },
];

// ─── Agent fleet ──────────────────────────────────────────────────────────

interface LeadAgent { name: string; desc: string; signal: string; cta: string }
const AGENTS: LeadAgent[] = [
  { name: 'ICP Definer',           desc: 'Refines each ICP weekly: role + seniority + keywords + intent triggers + signals.',         signal: '12 ICPs',     cta: 'Define'     },
  { name: 'Source Scout',          desc: 'Picks best source per ICP: Sales Nav · Apollo · Clay · Phantombuster · Crunchbase.',         signal: '8 sources',   cta: 'Route'      },
  { name: 'Scraper',               desc: 'Orchestrates Phantombuster · Apify · Outscraper. Rotates proxies (Bright Data). Logs runs.', signal: '47 jobs',     cta: 'Run'        },
  { name: 'Enricher · Waterfall',  desc: 'Clay → ZoomInfo → Cognism → Hunter → Snov. Stops at first valid hit. Tracks cost-per-hit.',  signal: '94% hit',     cta: 'Enrich'     },
  { name: 'Verifier',              desc: 'NeverBounce email validation · role validation · drops bounces before they touch sequence.', signal: '1.2% bounce', cta: 'Verify'     },
  { name: 'Scorer',                desc: 'Fit score + intent signals (funding round · hiring · tech stack · seasonality) → priority.', signal: '218 scored',  cta: 'Score'      },
  { name: 'Personalizer',          desc: 'Opening line + body + CTA tuned to ICP + signal. Multilingual (EN · DE · ES · FR · JP).',    signal: '341 drafts',  cta: 'Personalize'},
  { name: 'Sequencer',             desc: 'Touch cadence + channel mix (email · LI DM · WhatsApp). 4-touch base, A/B per ICP.',         signal: '12 seqs',     cta: 'Cadence'    },
  { name: 'Reply Drafter',         desc: 'When lead replies, drafts response in their tone. Human approves before send.',              signal: '38 drafts',   cta: 'Draft'      },
  { name: 'Reality Check',         desc: 'Catches fabricated personalization (fake claims, wrong names, hallucinated context).',       signal: '4 flags',     cta: 'Validate'   },
  { name: 'Deliverability Mon.',   desc: 'Tracks warmup score · spam rate · IP reputation · domain rotation. Pauses dirty sends.',     signal: '92% inbox',   cta: 'Monitor'    },
  { name: 'Analytics',             desc: 'Open · click · reply · book · revenue. Refines next-batch personalization + targeting.',     signal: '17 dashes',   cta: 'Analyze'    },
];

// ─── Tools stack ──────────────────────────────────────────────────────────

interface ToolCat { label: string; tools: { name: string; role: string; status?: 'wired' | 'planned' | 'evaluating' }[] }
const TOOLS_STACK: ToolCat[] = [
  { label: 'Sourcing', tools: [
    { name: 'Apollo.io',          role: 'B2B contact DB · 250M+ profiles',         status: 'wired'      },
    { name: 'LinkedIn Sales Nav', role: 'Verified people + companies',             status: 'wired'      },
    { name: 'Clay',               role: 'Multi-source enrichment + scoring',       status: 'wired'      },
    { name: 'Phantombuster',      role: 'IG · TT · LI · X scraping',               status: 'wired'      },
    { name: 'Outscraper',         role: 'Google Maps · local business intel',      status: 'wired'      },
    { name: 'Crunchbase',         role: 'Funded startups · M&A signals',           status: 'planned'    },
    { name: 'Muck Rack',          role: 'Press · journalist database',             status: 'evaluating' },
    { name: 'Bright Data',        role: 'Proxy infra for protected sources',       status: 'planned'    },
  ]},
  { label: 'Enrichment', tools: [
    { name: 'Clay',         role: 'Waterfall orchestration',                   status: 'wired'      },
    { name: 'Hunter.io',    role: 'Email finder + verifier',                   status: 'wired'      },
    { name: 'Snov.io',      role: 'Email finder · backup',                     status: 'planned'    },
    { name: 'ZoomInfo',     role: 'Enterprise B2B DB',                         status: 'evaluating' },
    { name: 'Cognism',      role: 'EU GDPR-compliant B2B',                     status: 'evaluating' },
    { name: 'NeverBounce',  role: 'Email validation gate',                     status: 'wired'      },
  ]},
  { label: 'Outreach infra', tools: [
    { name: 'Instantly',    role: 'Cold email · warm IPs · multi-inbox',       status: 'wired'   },
    { name: 'Smartlead',    role: 'Multi-inbox rotation · deliverability',     status: 'wired'   },
    { name: 'Lemlist',      role: 'Video personalization at scale',            status: 'planned' },
  ]},
  { label: 'Orchestration + AI', tools: [
    { name: 'Make.com',     role: 'Workflow orchestration',                    status: 'wired' },
    { name: 'n8n',          role: 'Self-hosted automation · advanced flows',   status: 'planned' },
    { name: 'Claude · Sonnet 4.6', role: 'LLM for personalize + reply draft', status: 'wired' },
    { name: 'GPT-4o',       role: 'Backup LLM · multilingual coverage',        status: 'planned' },
  ]},
];

// ─── ICP roster ───────────────────────────────────────────────────────────

interface IcpRow { name: string; daily: number; delivered7d: number; class: IcpClass }
const ICP_ROSTER: IcpRow[] = CAMPAIGNS.map((c) => ({ name: c.icpName, daily: c.dailyTarget, delivered7d: c.delivered7d, class: c.icpClass }));

// ─── Component ────────────────────────────────────────────────────────────

export default function LeadGenCockpit({ liveCounts }: Props) {
  const todayLeads      = CAMPAIGNS.reduce((s, c) => s + c.dailyTarget, 0);
  const inSequence      = THREADS.filter((t) => t.status.startsWith('In sequence') || t.status.startsWith('Sent')).length + 218;
  const awaitingApprov  = THREADS.filter((t) => t.status === 'AI draft · awaiting approval').length;
  const hotLeads        = THREADS.filter((t) => t.status === 'Hot · human responded').length + 21;
  const meetingsBooked  = CAMPAIGNS.reduce((s, c) => s + c.bookedMtd, 0);
  const responseRateAvg = 19.4;

  const approvalQueue   = THREADS.filter((t) => t.status === 'AI draft · awaiting approval' || t.status === 'Reality flag · review');
  const activeThreads   = THREADS.filter((t) => t.status !== 'Booked meeting' && t.status !== 'Bounced').sort((a, b) => urgencyScore(b) - urgencyScore(a));

  return (
    <>
      {/* ─── KPI band ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        <KpiBox value={todayLeads}        unit="count" label="Lead Target · today"   tooltip={`Across ${CAMPAIGNS.length} active ICP campaigns`} />
        <KpiBox value={inSequence}        unit="count" label="In Sequence"           tooltip="Leads currently in an email sequence (1-4 touches)" />
        <KpiBox value={awaitingApprov}    unit="count" label="Awaiting Approval"     tooltip="AI-drafted replies pending human sign-off" />
        <KpiBox value={responseRateAvg}   unit="pct"   label="Response Rate · 30d"   tooltip="Weighted average across campaigns" />
        <KpiBox value={CPL_AVG_USD}       unit="usd"   label="Cost / Lead · avg"     tooltip="Weighted average across active campaigns · tool spend ÷ leads delivered" dp={2} />
        <KpiBox value={SPEND_7D_TOTAL}    unit="usd"   label="Tool spend · 7d"       tooltip="Apollo + Clay + Hunter + Phantombuster + Instantly + Smartlead total spend" />
        <KpiBox value={hotLeads}          unit="count" label="Hot Leads"             tooltip="Replied positively · awaiting human follow-up" />
        <KpiBox value={meetingsBooked}    unit="count" label="Meetings Booked · MTD" tooltip="Calendar bookings from lead-gen this month" />
      </div>

      {/* ─── Active campaigns ─── */}
      <Panel
        title="Active campaigns"
        eyebrow={`${CAMPAIGNS.length} ICPs · scrape + enrich + outreach`}
        actions={
          <a href="?new=campaign" style={SS.btnPrimary}>+ New campaign</a>
        }
      >
        <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 10 }}>
          {CAMPAIGNS.map((c) => <CampaignCard key={c.id} campaign={c} />)}
        </div>
      </Panel>

      {/* ─── Production loop ─── */}
      <div style={{ marginTop: 14 }}>
        <Panel title="AI production loop" eyebrow="ICP signal → reply loop">
          <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            {LOOP.map((s) => (
              <div key={s.step} style={SS.loopCell}>
                <div style={SS.loopStep}>{s.step}</div>
                <div style={SS.loopTitle}>{s.title}</div>
                <div style={SS.loopDesc}>{s.desc}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* ─── Approval queue (top band of inbox) ─── */}
      <div style={{ marginTop: 14 }}>
        <Panel
          title="Approval queue"
          eyebrow={`${approvalQueue.length} AI drafts + flags pending`}
          actions={<span style={SS.approvalBadge}>✦ Action needed</span>}
        >
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {approvalQueue.map((t) => <ThreadCard key={t.id} thread={t} highlightDraft />)}
          </div>
        </Panel>
      </div>

      {/* ─── Conversation inbox ─── */}
      <div style={{ marginTop: 14 }}>
        <Panel title="Conversation inbox" eyebrow={`${activeThreads.length} active threads · sorted by urgency`}>
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeThreads.map((t) => <ThreadCard key={t.id} thread={t} />)}
          </div>
        </Panel>
      </div>

      {/* ─── Two-column: agents + right rail ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 340px)', gap: 14, marginTop: 14, alignItems: 'start' }}>
        {/* LEFT — agent fleet */}
        <Panel title="Agent fleet" eyebrow={`${AGENTS.length} sales-ops specialists · queue-only`}>
          <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
            {AGENTS.map((a) => (
              <div key={a.name} style={SS.agentCard}>
                <div style={SS.agentHead}>
                  <span style={SS.agentName}>{a.name}</span>
                  <span style={SS.signalPill}>{a.signal}</span>
                </div>
                <div style={SS.agentDesc}>{a.desc}</div>
                <div style={SS.agentCtaRow}>
                  <span style={SS.agentCta}>{a.cta} →</span>
                  <span style={SS.comingSoon}>Phase 2</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* RIGHT — ICP roster · Tools stack · Deliverability · Guardrails */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Panel title="ICP roster" eyebrow={`${ICP_ROSTER.length} active · daily target`}>
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ICP_ROSTER.map((r) => (
                <div key={r.name} style={SS.icpRow}>
                  <span style={icpClassPill(r.class)}>{r.class}</span>
                  <div style={{ flex: 1 }}>
                    <div style={SS.icpName}>{r.name}</div>
                    <div style={SS.icpSub}>{r.delivered7d} delivered · last 7d</div>
                  </div>
                  <span style={SS.icpCount}>{r.daily}/d</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Tools stack" eyebrow="sourcing · enrich · outreach · orchestration">
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {TOOLS_STACK.map((cat) => (
                <div key={cat.label}>
                  <div style={SS.toolCatLabel}>{cat.label}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                    {cat.tools.map((t) => (
                      <div key={t.name} style={SS.toolRow}>
                        <span style={SS.toolDot} data-status={t.status} />
                        <span style={SS.toolName}>{t.name}</span>
                        <span style={SS.toolRole}>{t.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div style={SS.toolLegend}>
                <LegendDot color="var(--brass, #a8854a)"    label="wired"      />
                <LegendDot color="var(--st-warn, #C28F2C)"  label="planned"    />
                <LegendDot color="var(--text-place, #5a5448)" label="evaluating" />
              </div>
            </div>
          </Panel>

          <Panel title="Deliverability health" eyebrow="warmup · IP rep · spam rate">
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <HealthRow label="Inbox rate · last 7d"    value="92%"      tone="good" />
              <HealthRow label="Spam rate"               value="0.4%"     tone="good" sub="below 0.3% target by month-end" />
              <HealthRow label="Bounce rate"             value="1.2%"     tone="good" sub="NeverBounce gate working" />
              <HealthRow label="Active inboxes · rotation" value="14"     tone="brass" sub="3 fresh · 11 warmed" />
              <HealthRow label="Domain reputation"       value="Stable"   tone="good" />
              <HealthRow label="Warmup score · new IPs"  value="78/100"   tone="warn" sub="2 more weeks before full send" />
            </div>
          </Panel>

          <Panel title="Guardrails" eyebrow="compliance + brand">
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Callout tone="brass">CAN-SPAM + GDPR + CCPA compliant: opt-out link in every cold email · honoured within 10 days.</Callout>
              <Callout tone="warn">No bait-and-switch. Personalization must match the actual lead context (Reality Agent enforces).</Callout>
              <Callout tone="soft">Every campaign tied to a real ICP + tested message-market fit before scaling cadence.</Callout>
              <Callout tone="soft">Human approves AI reply drafts until response rate &gt; 25% and Reality flags &lt; 2% for 14 days.</Callout>
            </div>
          </Panel>
        </div>
      </div>

      <div style={SS.footerNote}>
        Phase 1 cockpit · live <code>sales.leads</code> + <code>sales.scraping_jobs</code> below ({liveCounts.total} total · {liveCounts.raw} raw · {liveCounts.inPipeline} in pipeline · {liveCounts.won30d} won). Phase 2 wires <code>sales_ai.campaigns</code> + <code>threads</code> + <code>replies</code> + <code>deliverability</code> + the 12 agents via <code>cap_skills</code>.
      </div>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const isRunning = campaign.status === 'Running' || campaign.status === 'Warming' || campaign.status === 'Optimizing';
  const isPaused = campaign.status === 'Paused';
  const isStopped = campaign.status === 'Stopped';
  return (
    <div style={SS.campaignCard}>
      <div style={SS.campaignHead}>
        <span style={SS.campaignName}>{campaign.icpName}</span>
        <span style={campaignStatusPill(campaign.status)}>{campaign.status}</span>
      </div>
      <div style={SS.campaignMeta}>{campaign.icpClass} · {campaign.market} · {campaign.dailyTarget}/day</div>
      <div style={SS.campaignStatRow}>
        <Stat label="7d Delivered" value={String(campaign.delivered7d)} />
        <Stat label="Response"     value={campaign.responseRate} />
        <Stat label="Booked MTD"   value={String(campaign.bookedMtd)} />
        <Stat label="CPL"          value={campaign.cplUsd != null ? `$${campaign.cplUsd.toFixed(2)}` : '—'} />
        <Stat label="Spend 7d"     value={`$${campaign.spend7dUsd}`} />
      </div>
      <div style={SS.campaignChainRow}>
        <span style={SS.chainLabel}>Source</span>
        <span style={SS.chainValue}>{campaign.sources.join(' · ')}</span>
      </div>
      <div style={SS.campaignChainRow}>
        <span style={SS.chainLabel}>Enrich</span>
        <span style={SS.chainValue}>{campaign.enrich.join(' → ')}</span>
      </div>
      <div style={SS.campaignChainRow}>
        <span style={SS.chainLabel}>Send</span>
        <span style={SS.chainValue}>{campaign.outreach}</span>
      </div>
      <div style={SS.campaignActions}>
        <a href={`?campaign=${campaign.id}&edit=1`} style={SS.btnInlineSecondary}>✎ Edit</a>
        {isRunning && <a href={`?campaign=${campaign.id}&pause=1`} style={SS.btnInlineSecondary}>⏸ Pause</a>}
        {isPaused  && <a href={`?campaign=${campaign.id}&resume=1`} style={SS.btnInlinePrimary}>▶ Resume</a>}
        {isStopped && <a href={`?campaign=${campaign.id}&resume=1`} style={SS.btnInlinePrimary}>▶ Resume</a>}
        {!isStopped && <a href={`?campaign=${campaign.id}&stop=1`} style={SS.btnInlineWarn}>■ Stop</a>}
        <a href={`?campaign=${campaign.id}&duplicate=1`} style={SS.btnInlineSecondary}>⎘ Duplicate</a>
      </div>
    </div>
  );
}

function ThreadCard({ thread, highlightDraft }: { thread: Thread; highlightDraft?: boolean }) {
  return (
    <div style={{ ...SS.threadCard, ...(highlightDraft ? SS.threadCardHighlight : {}) }}>
      <div style={SS.threadHead}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={SS.threadFrom}>{thread.from}</span>
          <span style={SS.threadFromMeta}>{thread.fromRole} · {thread.fromCompany}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={SS.threadAge}>{thread.age}</span>
          <span style={threadStatusPill(thread.status)}>{thread.status}</span>
        </div>
      </div>
      <div style={SS.threadIcp}>ICP: <strong>{thread.icp}</strong></div>
      <div style={SS.threadSnippet}>{thread.lastSnippet}</div>
      {thread.aiDraft && (
        <div style={SS.aiDraftBox}>
          <div style={SS.aiDraftLabel}>AI-drafted reply</div>
          <div style={SS.aiDraftBody}>{thread.aiDraft}</div>
          <div style={SS.aiDraftActions}>
            <button type="button" style={SS.btnPrimary}>✓ Approve &amp; Send</button>
            <button type="button" style={SS.btnSecondary}>✎ Edit</button>
            <button type="button" style={SS.btnSecondary}>⟶ Skip · wait</button>
            <button type="button" style={SS.btnWarn}>★ Mark hot · human</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={SS.statLabel}>{label}</span>
      <span style={SS.statValue}>{value}</span>
    </div>
  );
}

function HealthRow({ label, value, tone, sub }: { label: string; value: string; tone: 'good' | 'warn' | 'brass'; sub?: string }) {
  const color =
    tone === 'good'  ? 'var(--st-good, #82ad8c)' :
    tone === 'warn'  ? 'var(--st-warn, #C28F2C)' :
                       'var(--brass, #a8854a)';
  return (
    <div style={SS.healthRow}>
      <div style={{ flex: 1 }}>
        <div style={SS.healthLabel}>{label}</div>
        {sub && <div style={SS.healthSub}>{sub}</div>}
      </div>
      <span style={{ ...SS.healthValue, color }}>{value}</span>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      <span style={SS.legendLabel}>{label}</span>
    </span>
  );
}

function Callout({ tone, children }: { tone: 'brass' | 'soft' | 'warn'; children: ReactNode }) {
  const border =
    tone === 'brass' ? 'var(--brass, #a8854a)' :
    tone === 'warn'  ? 'var(--st-warn, #C28F2C)' :
                       'var(--border-1, #1f1c15)';
  return (
    <div style={{
      padding: '8px 10px',
      borderLeft: `2px solid ${border}`,
      background: 'var(--surf-1, #0f0d0a)',
      fontSize: 'var(--t-sm)',
      lineHeight: 1.5,
      color: 'var(--text-1, #d8cca8)',
    }}>
      {children}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function urgencyScore(t: Thread): number {
  switch (t.status) {
    case 'AI draft · awaiting approval': return 100;
    case 'Reality flag · review':         return 95;
    case 'Hot · human responded':         return 90;
    case 'Booked meeting':                return 70;
    case 'In sequence · touch 2/4':       return 50;
    case 'Sent · awaiting reply':         return 40;
    case 'Bounced':                       return 10;
    default:                              return 30;
  }
}

function campaignStatusPill(status: CampaignStatus): React.CSSProperties {
  const color =
    status === 'Running'      ? 'var(--brass, #a8854a)' :
    status === 'Warming'      ? 'var(--st-warn, #C28F2C)' :
    status === 'Optimizing'   ? 'var(--text-2, #d8cca8)' :
    status === 'Needs Setup'  ? '#c97b6a' :
                                'var(--text-mute, #9b907a)';
  return basePill(color);
}

function icpClassPill(cls: IcpClass): React.CSSProperties {
  const color =
    cls === 'B2B'   ? 'var(--brass, #a8854a)' :
    cls === 'B2B2C' ? 'var(--text-2, #d8cca8)' :
                      'var(--st-warn, #C28F2C)';
  return basePill(color);
}

function threadStatusPill(status: ThreadStatus): React.CSSProperties {
  const color =
    status === 'AI draft · awaiting approval' ? 'var(--st-warn, #C28F2C)' :
    status === 'Reality flag · review'         ? '#c97b6a' :
    status === 'Hot · human responded'         ? 'var(--brass, #a8854a)' :
    status === 'Booked meeting'                ? 'var(--st-good, #82ad8c)' :
    status === 'In sequence · touch 2/4'       ? 'var(--text-2, #d8cca8)' :
    status === 'Sent · awaiting reply'         ? 'var(--text-mute, #9b907a)' :
                                                 'var(--text-place, #5a5448)';
  return basePill(color);
}

function basePill(color: string): React.CSSProperties {
  return {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color,
    border: `1px solid ${color}`,
    padding: '2px 6px',
    borderRadius: 3,
    whiteSpace: 'nowrap',
  };
}

// ─── Styles ───────────────────────────────────────────────────────────────

const SS: Record<string, React.CSSProperties> = {
  // Campaign cards
  campaignCard: {
    background: 'var(--surf-1, #0f0d0a)',
    border: '1px solid var(--border-1, #1f1c15)',
    borderLeft: '3px solid var(--brass, #a8854a)',
    borderRadius: 6,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  campaignHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  campaignName: {
    fontFamily: "'Fraunces', Georgia, serif",
    fontStyle: 'italic',
    fontSize: 'var(--t-md)',
    fontWeight: 500,
    color: 'var(--text-0, #e9e1ce)',
  },
  campaignMeta: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.12em',
    color: 'var(--text-mute, #9b907a)',
  },
  campaignStatRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 10,
    borderTop: '1px solid var(--border-1, #1f1c15)',
    paddingTop: 8,
  },
  campaignActions: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    paddingTop: 8,
    borderTop: '1px solid var(--border-1, #1f1c15)',
    marginTop: 4,
  },
  btnInlinePrimary: {
    background: 'var(--brass, #a8854a)',
    color: 'var(--surf-0, #0a0a0a)',
    border: '1px solid var(--brass, #a8854a)',
    padding: '3px 8px',
    borderRadius: 3,
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
    fontWeight: 600,
    textDecoration: 'none',
  },
  btnInlineSecondary: {
    background: 'transparent',
    color: 'var(--text-1, #d8cca8)',
    border: '1px solid var(--border-1, #1f1c15)',
    padding: '3px 8px',
    borderRadius: 3,
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
    textDecoration: 'none',
  },
  btnInlineWarn: {
    background: 'transparent',
    color: '#c97b6a',
    border: '1px solid #c97b6a',
    padding: '3px 8px',
    borderRadius: 3,
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
    fontWeight: 600,
    textDecoration: 'none',
  },
  campaignChainRow: {
    display: 'grid',
    gridTemplateColumns: '80px 1fr',
    gap: 6,
    fontSize: 'var(--t-xs)',
  },
  chainLabel: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: 'var(--text-place, #5a5448)',
  },
  chainValue: { color: 'var(--text-1, #d8cca8)' },

  // Stats
  statLabel: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: 'var(--text-place, #5a5448)',
  },
  statValue: { fontSize: 'var(--t-sm)', fontWeight: 600, color: 'var(--text-0, #e9e1ce)', fontVariantNumeric: 'tabular-nums' },

  // Loop cells
  loopCell: {
    background: 'var(--surf-1, #0f0d0a)',
    border: '1px solid var(--border-1, #1f1c15)',
    borderRadius: 6,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  loopStep: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.18em',
    color: 'var(--brass, #a8854a)',
  },
  loopTitle: { fontSize: 'var(--t-md)', fontWeight: 600, color: 'var(--text-0, #e9e1ce)' },
  loopDesc: { fontSize: 'var(--t-xs)', lineHeight: 1.5, color: 'var(--text-mute, #9b907a)' },

  // Thread cards
  approvalBadge: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: 'var(--st-warn, #C28F2C)',
    border: '1px solid var(--st-warn, #C28F2C)',
    padding: '2px 8px',
    borderRadius: 3,
  },
  threadCard: {
    background: 'var(--surf-1, #0f0d0a)',
    border: '1px solid var(--border-1, #1f1c15)',
    borderRadius: 6,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  threadCardHighlight: { borderLeft: '3px solid var(--st-warn, #C28F2C)' },
  threadHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  threadFrom: { fontSize: 'var(--t-sm)', fontWeight: 600, color: 'var(--text-0, #e9e1ce)' },
  threadFromMeta: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.12em',
    color: 'var(--text-mute, #9b907a)',
  },
  threadAge: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.14em',
    color: 'var(--text-place, #5a5448)',
  },
  threadIcp: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--brass, #a8854a)',
  },
  threadSnippet: { fontSize: 'var(--t-sm)', lineHeight: 1.5, color: 'var(--text-1, #d8cca8)', fontStyle: 'italic' },

  // AI draft inside thread card
  aiDraftBox: {
    marginTop: 4,
    padding: '8px 10px',
    background: 'var(--surf-0, #0a0a0a)',
    border: '1px dashed var(--st-warn, #C28F2C)',
    borderRadius: 4,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  aiDraftLabel: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: 'var(--st-warn, #C28F2C)',
  },
  aiDraftBody: { fontSize: 'var(--t-sm)', lineHeight: 1.6, color: 'var(--text-0, #e9e1ce)' },
  aiDraftActions: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  btnPrimary: {
    background: 'var(--brass, #a8854a)',
    color: 'var(--surf-0, #0a0a0a)',
    border: '1px solid var(--brass, #a8854a)',
    padding: '4px 10px',
    borderRadius: 3,
    cursor: 'pointer',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    fontWeight: 600,
  },
  btnSecondary: {
    background: 'transparent',
    color: 'var(--text-1, #d8cca8)',
    border: '1px solid var(--border-1, #1f1c15)',
    padding: '4px 10px',
    borderRadius: 3,
    cursor: 'pointer',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  btnWarn: {
    background: 'transparent',
    color: 'var(--brass, #a8854a)',
    border: '1px solid var(--brass, #a8854a)',
    padding: '4px 10px',
    borderRadius: 3,
    cursor: 'pointer',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    fontWeight: 600,
  },

  // Agent cards
  agentCard: {
    background: 'var(--surf-1, #0f0d0a)',
    border: '1px solid var(--border-1, #1f1c15)',
    borderRadius: 6,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  agentHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  agentName: { fontSize: 'var(--t-sm)', fontWeight: 600, color: 'var(--text-0, #e9e1ce)' },
  agentDesc: { fontSize: 'var(--t-xs)', lineHeight: 1.5, color: 'var(--text-mute, #9b907a)', minHeight: 54 },
  agentCtaRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-1, #1f1c15)', paddingTop: 8 },
  agentCta: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: 'var(--brass, #a8854a)',
  },
  comingSoon: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: 'var(--text-place, #5a5448)',
  },
  signalPill: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--brass, #a8854a)',
    border: '1px solid var(--brass, #a8854a)',
    padding: '1px 5px',
    borderRadius: 3,
    whiteSpace: 'nowrap',
  },

  // ICP rows
  icpRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 10px',
    background: 'var(--surf-1, #0f0d0a)',
    border: '1px solid var(--border-1, #1f1c15)',
    borderRadius: 4,
  },
  icpName: { fontSize: 'var(--t-sm)', color: 'var(--text-0, #e9e1ce)', fontWeight: 500 },
  icpSub: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.12em',
    color: 'var(--text-mute, #9b907a)',
  },
  icpCount: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-sm)',
    fontWeight: 700,
    color: 'var(--brass, #a8854a)',
    fontVariantNumeric: 'tabular-nums',
  },

  // Tools stack
  toolCatLabel: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: 'var(--brass, #a8854a)',
  },
  toolRow: { display: 'grid', gridTemplateColumns: '10px 110px 1fr', gap: 6, alignItems: 'baseline' },
  toolDot: {
    width: 8, height: 8, borderRadius: '50%',
    background: 'var(--text-place, #5a5448)',
  },
  toolName: { fontSize: 'var(--t-sm)', color: 'var(--text-0, #e9e1ce)', fontWeight: 500 },
  toolRole: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.10em',
    color: 'var(--text-mute, #9b907a)',
  },
  toolLegend: {
    display: 'flex',
    gap: 12,
    paddingTop: 6,
    borderTop: '1px solid var(--border-1, #1f1c15)',
  },
  legendLabel: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--text-mute, #9b907a)',
  },

  // Health rows
  healthRow: { display: 'flex', alignItems: 'center', gap: 10 },
  healthLabel: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--text-mute, #9b907a)',
  },
  healthSub: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.10em',
    color: 'var(--text-place, #5a5448)',
    fontStyle: 'italic',
  },
  healthValue: { fontSize: 'var(--t-md)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' },

  footerNote: {
    marginTop: 18,
    padding: '10px 12px',
    fontSize: 'var(--t-xs)',
    color: 'var(--text-mute, #9b907a)',
    fontStyle: 'italic',
    borderTop: '1px solid var(--border-1, #1f1c15)',
  },
};
