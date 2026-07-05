// app/marketing/funnels/page.tsx
//
// PBS 2026-05-16: AI Funnel Growth Cockpit — Phase 1 static cockpit.
// PBS 2026-07-05: re-shelled to new paper-white design (DashboardPage + KpiTile
// + MARKETING_SUBPAGES tabs). All original data + panels preserved. HARDCODED
// banner added per PBS's rule: mark static content, never delete it.
//
// Surfaces:
//   • KPI band — 6 tiles (Active, Score avg, Sessions, Lead capture,
//     Booking CVR, Revenue attribution)
//   • Funnel domain portfolio — 6 cards (Retreat Laos, Yoga Retreat,
//     Couples Retreat, Eco Retreat, Slow Travel, Digital Detox)
//   • Production loop — 7 steps
//   • Agent fleet — 12 agents
//   • Right rail — Opportunity Radar · Lead Magnet Library · Score
//     Formula · Guardrails
//
// Phase-2 wires the funnel_ai.* schema from the spec (8 tables + 2
// views) and lights up the agent fleet via cap_skills.

import type { CSSProperties, ReactNode } from 'react';
import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

// ─── Design tokens (paper-white palette) ─────────────────────────────────
const HAIR = '#E6DFCC';
const INK = '#1B1B1B';
const INK_MUTE = '#5A5A5A';
const INK_FAINT = '#8A8A8A';
const GREEN = '#084838';
const CREAM = '#F7F0E1';
const AMBER = '#C28F2C';
const RED = '#B03826';

// ─── Data ─────────────────────────────────────────────────────────────────

interface Funnel {
  name: string;
  domain: string;
  type: 'B2C Wellness' | 'B2C Yoga' | 'B2C Couples' | 'B2C Eco' | 'B2C Slow Travel' | 'B2C Detox' | 'B2B Host' | 'B2B DMC';
  icp: string;
  market: string;
  keyword: string;
  trafficTrend: string;
  score: number;
  status: 'Scaling' | 'Testing' | 'Research' | 'Needs Approval' | 'Live';
  cvr: string;
  revenue: string;
  leadMagnet: string;
  cta: string;
}

const FUNNELS: Funnel[] = [
  { name: 'Retreat Laos',      domain: 'retreatlaos.xy',        type: 'B2C Wellness',    icp: 'EU Wellness Women',    market: 'DACH · UK',  keyword: 'wellness retreat Laos',       trafficTrend: '+42%', score: 91, status: 'Scaling',        cvr: '4.2%', revenue: '$38k MTD', leadMagnet: '5-Day Laos Reset PDF',          cta: 'Booking + WhatsApp' },
  { name: 'Yoga Retreat Asia', domain: 'yogaretreatasia.xy',    type: 'B2C Yoga',        icp: 'Yoga Guests',          market: 'EU · US',    keyword: 'yoga retreat Laos',           trafficTrend: '+28%', score: 84, status: 'Testing',        cvr: '3.1%', revenue: '$12k MTD', leadMagnet: 'Which Retreat Fits You Quiz',   cta: 'Inquiry form' },
  { name: 'Couples Laos',      domain: 'couplesretreatasia.xy', type: 'B2C Couples',     icp: 'Luxury Couples',       market: 'US · EU',    keyword: 'couples retreat Laos',        trafficTrend: '+19%', score: 78, status: 'Live',           cvr: '5.4%', revenue: '$24k MTD', leadMagnet: 'Romantic Laos Escape Planner',  cta: 'Booking + package link' },
  { name: 'Eco Retreat Asia',  domain: 'ecoretreatasia.xy',     type: 'B2C Eco',         icp: 'Conscious Travelers',  market: 'EU · NL',    keyword: 'eco retreat Southeast Asia',  trafficTrend: '+33%', score: 81, status: 'Live',           cvr: '3.8%', revenue: '$18k MTD', leadMagnet: 'Farm-to-Table Laos Guide',      cta: 'Email + booking' },
  { name: 'Slow Travel Laos',  domain: 'travellaos.xy',         type: 'B2C Slow Travel', icp: 'Cultural Travelers',   market: 'EU · AU',    keyword: 'slow travel Laos',            trafficTrend: '+11%', score: 72, status: 'Research',       cvr: '2.4%', revenue: '$7k MTD',  leadMagnet: '7-Day Slow Travel Itinerary',   cta: 'Itinerary download' },
  { name: 'Digital Detox',     domain: 'digitaldetoxasia.xy',   type: 'B2C Detox',       icp: 'Burnout Travelers',    market: 'DACH · UK',  keyword: 'digital detox Asia',          trafficTrend: '+63%', score: 76, status: 'Needs Approval', cvr: '—',    revenue: '—',        leadMagnet: 'Digital Detox Checklist',       cta: 'Retreat inquiry' },
];

interface FunnelAgent { name: string; desc: string; signal: string; cta: string }

const AGENTS: FunnelAgent[] = [
  { name: 'Trend Radar',         desc: 'Scans Google Trends, Search Console, social signals and booking seasonality for emerging demand.',           signal: '7 signals', cta: 'Scan' },
  { name: 'Keyword Research',    desc: 'Builds clusters, classifies intent, scores difficulty, finds long-tails by market and language.',              signal: '4.2k kw',   cta: 'Research' },
  { name: 'Funnel Opportunity',  desc: 'Decides build vs research more vs reject. Verifies demand · intent · ICP · competition · brand risk.',         signal: '3 builds',  cta: 'Decide' },
  { name: 'Domain Strategy',     desc: 'Recommends new domain vs page cluster. Maps domain types to ICPs and content angles.',                          signal: '5 ideas',   cta: 'Strategize' },
  { name: 'Funnel Architect',    desc: 'Designs page structure, emotional journey, CTA placement, FAQ + booking flow.',                                 signal: '12 specs',  cta: 'Design' },
  { name: 'Funnel Copy',         desc: 'Writes landing-page copy with ICP voice, intent match and conversion micro-decisions.',                         signal: '28 drafts', cta: 'Write' },
  { name: 'Lead Magnet',         desc: 'Creates PDFs, retreat decks, quizzes, itineraries, checklists and sample schedules.',                           signal: '14 assets', cta: 'Generate' },
  { name: 'Visual Asset',        desc: 'Selects or commissions hero images and on-brand visuals. Reality-checked against actual resort.',               signal: '36 visuals',cta: 'Curate' },
  { name: 'Booking CTA',         desc: 'Maps intent to conversion path: booking engine · form · WhatsApp · payment link · package upsell.',             signal: '6 paths',   cta: 'Wire' },
  { name: 'Publishing',          desc: 'Ships approved pages live with DNS, SSL, tracking, sitemap and internal-link injection.',                       signal: '4 ready',   cta: 'Publish' },
  { name: 'Analytics',           desc: 'Tracks sessions, source, keyword, country, scroll depth, CTA clicks, leads, bookings, revenue.',                signal: '11 dashes', cta: 'Analyze' },
  { name: 'Refinement',          desc: 'Proposes better titles, hero images, CTAs, lead magnets · or kill/scale decisions for weak pages.',             signal: '8 fixes',   cta: 'Refine' },
];

const LOOP: { step: string; title: string; desc: string }[] = [
  { step: '01', title: 'Research',  desc: 'Trends, keywords, competitors, booking data, social signals, seasonality.' },
  { step: '02', title: 'Analytics', desc: 'GA4 + Search Console + booking-engine attribution feeds the radar.'         },
  { step: '03', title: 'Reason',    desc: 'Demand · intent · ICP fit · competition · brand-risk gate. Reject SEO garbage.' },
  { step: '04', title: 'Approve',   desc: 'Human signs off on domain · concept · claims · CTA · lead magnet.'           },
  { step: '05', title: 'Publish',   desc: 'Page goes live with tracking, forms, booking + WhatsApp wired up.'           },
  { step: '06', title: 'Analyze',   desc: 'Sessions · CTA clicks · leads · bookings · revenue · keyword rank.'           },
  { step: '07', title: 'Refine',    desc: 'AI proposes hero/CTA/keyword tweaks. Kill, rebuild, or scale.'                },
];

interface Opportunity { keyword: string; market: string; score: number; reason: string; verdict: 'Build' | 'Research more' | 'Reject' }

const OPPORTUNITIES: Opportunity[] = [
  { keyword: 'wellness retreat Laos · DE',  market: 'DACH',     score: 92, reason: 'Search demand up 38% QoQ · 4 weak competitors · German variant gap', verdict: 'Build' },
  { keyword: 'host yoga retreat Asia',      market: 'US · UK',  score: 81, reason: 'B2B intent · low DR competitors · matches Phase 2 host funnel',       verdict: 'Build' },
  { keyword: 'luxury jungle resort Laos',   market: 'US',       score: 74, reason: 'Premium intent but conflicts with SLH brand line — needs alignment',  verdict: 'Research more' },
  { keyword: 'cheap Laos backpacker',       market: 'AU',       score: 22, reason: 'High volume but anti-ICP — would dilute brand · skip',                verdict: 'Reject' },
];

interface LeadMagnet { title: string; target: string; type: 'PDF' | 'Quiz' | 'Deck' | 'Itinerary' | 'Checklist'; segment: 'B2C' | 'B2B' }

const LEAD_MAGNETS: LeadMagnet[] = [
  { title: '5-Day Laos Reset PDF',                 target: 'Wellness travelers',  type: 'PDF',        segment: 'B2C' },
  { title: '7-Day Slow Travel Laos Itinerary',     target: 'Slow travel guests',  type: 'Itinerary',  segment: 'B2C' },
  { title: 'Which Retreat Fits You Quiz',          target: 'Undecided seekers',   type: 'Quiz',       segment: 'B2C' },
  { title: 'Farm-to-Table Laos Guide',             target: 'Food travelers',      type: 'PDF',        segment: 'B2C' },
  { title: 'Romantic Laos Escape Planner',         target: 'Couples',             type: 'PDF',        segment: 'B2C' },
  { title: 'Digital Detox Checklist',              target: 'Burnout travelers',   type: 'Checklist',  segment: 'B2C' },
  { title: 'Host Your Retreat Deck',               target: 'Retreat leaders',     type: 'Deck',       segment: 'B2B' },
  { title: 'Wellness Group Pricing Sheet',         target: 'Yoga teachers',       type: 'PDF',        segment: 'B2B' },
  { title: 'DMC Partner Kit',                      target: 'Travel partners',     type: 'PDF',        segment: 'B2B' },
];

const SCORE_WEIGHTS: { label: string; weight: number }[] = [
  { label: 'Search demand',     weight: 15 },
  { label: 'Commercial intent', weight: 15 },
  { label: 'ICP fit',           weight: 15 },
  { label: 'Conversion rate',   weight: 20 },
  { label: 'Lead quality',      weight: 15 },
  { label: 'Booking value',     weight: 10 },
  { label: 'Brand/reality fit', weight: 10 },
];

// ─── Page ─────────────────────────────────────────────────────────────────

export default function MarketingFunnelsPage() {
  const activeFunnels   = FUNNELS.filter((f) => f.status === 'Live' || f.status === 'Scaling').length;
  const avgScore        = Math.round(FUNNELS.reduce((s, f) => s + f.score, 0) / FUNNELS.length);
  const totalMtdRevenue = 99_000;
  const totalLeads      = 247;
  const totalSessions   = 31_400;
  const avgCvr          = 3.8;

  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map(s => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/marketing/funnels',
  }));

  const tiles: KpiTileProps[] = [
    { label: 'Active Funnels',    value: activeFunnels,    size: 'sm', footnote: 'Live + Scaling' },
    { label: 'Avg Funnel Score',  value: `${avgScore}/100`, size: 'sm', footnote: 'weighted 7-metric' },
    { label: 'Organic Sessions',  value: totalSessions.toLocaleString(), size: 'sm', footnote: 'GA4 · last 30d' },
    { label: 'Leads · MTD',       value: totalLeads,       size: 'sm', footnote: 'email · WhatsApp · form' },
    { label: 'Booking CVR · avg', value: `${avgCvr}%`,     size: 'sm' },
    { label: 'Attributed Rev.',   value: `$${(totalMtdRevenue/1000).toFixed(0)}k`, size: 'sm', footnote: 'last-click + assisted' },
  ];

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage
        title="Marketing · AI Funnel Growth Cockpit"
        subtitle="Research → Analytics → Reason → Approve → Publish → Analyze → Refine — decision engine, not a page generator"
        tabs={tabs}
      >
        {/* HARDCODED banner */}
        <div style={{ gridColumn:'1 / -1', padding:'10px 14px', background:'#FFF4D6', border:'1px solid '+AMBER, borderRadius:4, fontSize:12, color:INK, lineHeight:1.6 }}>
          <strong>HARDCODED DATA · Phase 1.</strong> All numbers below are static spec. Phase 2 wires <code>funnel_ai.funnel_domains + funnel_pages + funnel_leads + funnel_metrics</code> (8 tables + 2 views) and lights up the 12 agents via <code>cap_skills</code>. Email nurture for never-stayed leads is a separate product → <a href="/marketing/prospects" style={{ color:GREEN }}>Prospects · Sequences</a>.
        </div>

        {/* Headline KPI band */}
        <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:8 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>

        {/* Funnel domain portfolio */}
        <div style={{ gridColumn:'1 / -1' }}>
          <SectionHead title="Funnel domain portfolio" eyebrow={`${FUNNELS.length} domains · controlled portfolio`} />
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:12 }}>
            {FUNNELS.map((f) => <FunnelCard key={f.domain} funnel={f} />)}
          </div>
        </div>

        {/* Production loop */}
        <div style={{ gridColumn:'1 / -1' }}>
          <SectionHead title="AI production loop" eyebrow="research → refine" />
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:10 }}>
            {LOOP.map((s) => (
              <div key={s.step} style={S.workflowCell}>
                <div style={S.workflowStep}>{s.step}</div>
                <div style={S.workflowTitle}>{s.title}</div>
                <div style={S.workflowDesc}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Two-column: agents (left) + right rail */}
        <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'minmax(0, 1fr) minmax(0, 340px)', gap:14, alignItems:'start' }}>
          {/* LEFT — agent fleet */}
          <div>
            <SectionHead title="Agent fleet" eyebrow={`${AGENTS.length} funnel specialists · queue-only`} />
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:10 }}>
              {AGENTS.map((a) => (
                <div key={a.name} style={S.agentCard}>
                  <div style={S.agentHead}>
                    <span style={S.agentName}>{a.name}</span>
                    <span style={S.signalPill}>{a.signal}</span>
                  </div>
                  <div style={S.agentDesc}>{a.desc}</div>
                  <div style={S.agentCtaRow}>
                    <span style={S.agentCta}>{a.cta} →</span>
                    <span style={S.comingSoon}>Phase 2</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — opportunities + lead magnets + score + guardrails */}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <SectionHead title="Opportunity radar" eyebrow={`${OPPORTUNITIES.length} signals · this week`} />
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {OPPORTUNITIES.map((o) => (
                  <div key={o.keyword} style={S.opRow}>
                    <div style={S.opHead}>
                      <span style={S.opKw}>&ldquo;{o.keyword}&rdquo;</span>
                      <span style={verdictPill(o.verdict)}>{o.verdict}</span>
                    </div>
                    <div style={S.opMeta}>{o.market} · score {o.score}/100</div>
                    <div style={S.opReason}>{o.reason}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <SectionHead title="Lead magnet library" eyebrow={`${LEAD_MAGNETS.length} assets · B2C + B2B`} />
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {LEAD_MAGNETS.map((m) => (
                  <div key={m.title} style={S.magnetRow}>
                    <div style={S.magnetHead}>
                      <span style={S.magnetTitle}>{m.title}</span>
                      <span style={statusPill(m.segment === 'B2C' ? 'brass' : 'soft')}>{m.segment}</span>
                    </div>
                    <div style={S.magnetMeta}>{m.type} · {m.target}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <SectionHead title="Funnel score formula" eyebrow="weighted 7-metric" />
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {SCORE_WEIGHTS.map((w) => (
                  <div key={w.label} style={S.weightRow}>
                    <span style={S.weightLabel}>{w.label}</span>
                    <div style={S.weightBarOuter}>
                      <div style={{ ...S.weightBarInner, width: `${w.weight * 5}%` }} />
                    </div>
                    <span style={S.weightVal}>{w.weight}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <SectionHead title="Guardrails" eyebrow="non-negotiable" />
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <Callout tone="brass">Fewer stronger funnels. <strong>Never 500 weak pages.</strong></Callout>
                <Callout tone="warn">Every funnel passes demand + intent + ICP + brand-risk gate before publishing.</Callout>
                <Callout tone="soft">AI proposes — human approves domain, claims, CTA, lead magnet, retreat naming.</Callout>
                <Callout tone="soft">Reality Agent checks visuals + copy against actual resort experience.</Callout>
              </div>
            </div>
          </div>
        </div>

        <div style={{ gridColumn:'1 / -1', marginTop:18, padding:'10px 12px', fontSize:11, color:INK_MUTE, fontStyle:'italic', borderTop:'1px solid '+HAIR }}>
          Phase 1 cockpit · static spec. Phase 2 wires <code>funnel_ai.funnel_domains</code> + <code>funnel_pages</code> + <code>funnel_leads</code> + <code>funnel_metrics</code> (8 tables + 2 views per spec) and lights up the 12 agents via <code>cap_skills</code>.
        </div>
      </DashboardPage>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────

function SectionHead({ title, eyebrow }: { title: string; eyebrow?: string }) {
  return (
    <div style={{ marginBottom:8 }}>
      <div style={{ fontSize:14, fontWeight:600, color:INK }}>{title}</div>
      {eyebrow && <div style={{ fontSize:11, color:INK_MUTE, marginTop:2 }}>{eyebrow}</div>}
    </div>
  );
}

function FunnelCard({ funnel }: { funnel: Funnel }) {
  const statusTone: 'brass' | 'soft' | 'warn' | 'mute' =
    funnel.status === 'Scaling' || funnel.status === 'Live' ? 'brass' :
    funnel.status === 'Needs Approval'                     ? 'warn'  :
    funnel.status === 'Testing'                            ? 'soft'  : 'mute';
  return (
    <div style={S.funnelCard}>
      <div style={S.funnelHead}>
        <span style={S.funnelName}>{funnel.name}</span>
        <span style={statusPill(statusTone)}>{funnel.status}</span>
      </div>
      <div style={S.funnelDomain}>{funnel.domain}</div>
      <div style={S.funnelType}>{funnel.type} · {funnel.icp} · {funnel.market}</div>
      <div style={S.funnelKeyword}>&ldquo;{funnel.keyword}&rdquo;</div>
      <div style={S.funnelStatRow}>
        <Stat label="Score"   value={`${funnel.score}/100`} />
        <Stat label="CVR"     value={funnel.cvr} />
        <Stat label="Trend"   value={funnel.trafficTrend} />
        <Stat label="Revenue" value={funnel.revenue} />
      </div>
      <div style={S.funnelFooter}>
        <span style={S.funnelFooterLabel}>Lead magnet</span>
        <span style={S.funnelFooterValue}>{funnel.leadMagnet}</span>
      </div>
      <div style={S.funnelFooter}>
        <span style={S.funnelFooterLabel}>CTA</span>
        <span style={S.funnelFooterValue}>{funnel.cta}</span>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={S.statLabel}>{label}</span>
      <span style={S.statValue}>{value}</span>
    </div>
  );
}

function Callout({ tone, children }: { tone: 'brass' | 'soft' | 'warn'; children: ReactNode }) {
  const border =
    tone === 'brass' ? GREEN :
    tone === 'warn'  ? AMBER :
                       HAIR;
  return (
    <div style={{
      padding: '8px 10px',
      borderLeft: `2px solid ${border}`,
      background: CREAM,
      fontSize: 12,
      lineHeight: 1.5,
      color: INK,
    }}>
      {children}
    </div>
  );
}

// ─── Pill helpers ─────────────────────────────────────────────────────────

function statusPill(tone: 'brass' | 'soft' | 'warn' | 'mute'): CSSProperties {
  const color =
    tone === 'brass' ? GREEN :
    tone === 'warn'  ? AMBER :
    tone === 'mute'  ? INK_FAINT :
                       INK_MUTE;
  return {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 10,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color,
    border: `1px solid ${color}`,
    padding: '2px 6px',
    borderRadius: 3,
    whiteSpace: 'nowrap',
  };
}

function verdictPill(verdict: Opportunity['verdict']): CSSProperties {
  const tone: 'brass' | 'soft' | 'warn' | 'mute' =
    verdict === 'Build'         ? 'brass' :
    verdict === 'Research more' ? 'warn'  : 'mute';
  return statusPill(tone);
}

// ─── Styles (paper-white palette) ────────────────────────────────────────

const S: Record<string, CSSProperties> = {
  funnelCard: {
    background: '#FFFFFF',
    border: '1px solid '+HAIR,
    borderLeft: '3px solid '+GREEN,
    borderRadius: 6,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  funnelHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  funnelName: {
    fontFamily: "'Fraunces', Georgia, serif",
    fontStyle: 'italic',
    fontSize: 16,
    fontWeight: 500,
    color: INK,
  },
  funnelDomain: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 10,
    letterSpacing: '0.12em',
    color: GREEN,
  },
  funnelType: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 10,
    letterSpacing: '0.08em',
    color: INK_MUTE,
  },
  funnelKeyword: { fontSize: 12, color: INK, fontStyle: 'italic' },
  funnelStatRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 10,
    borderTop: '1px solid '+HAIR,
    paddingTop: 8,
  },
  funnelFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
    fontSize: 11,
  },
  funnelFooterLabel: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: INK_FAINT,
  },
  funnelFooterValue: { color: INK, textAlign: 'right' },

  statLabel: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 10,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: INK_FAINT,
  },
  statValue: { fontSize: 12, fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums' },

  workflowCell: {
    background: '#FFFFFF',
    border: '1px solid '+HAIR,
    borderRadius: 6,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  workflowStep: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 10,
    letterSpacing: '0.16em',
    color: GREEN,
  },
  workflowTitle: { fontSize: 13, fontWeight: 600, color: INK },
  workflowDesc: { fontSize: 11, lineHeight: 1.5, color: INK_MUTE },

  agentCard: {
    background: '#FFFFFF',
    border: '1px solid '+HAIR,
    borderRadius: 6,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  agentHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  agentName: { fontSize: 12, fontWeight: 600, color: INK },
  agentDesc: { fontSize: 11, lineHeight: 1.5, color: INK_MUTE, minHeight: 54 },
  agentCtaRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid '+HAIR, paddingTop: 8 },
  agentCta: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 10,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: GREEN,
  },
  comingSoon: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 10,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: INK_FAINT,
  },
  signalPill: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 10,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: GREEN,
    border: '1px solid '+GREEN,
    padding: '1px 5px',
    borderRadius: 3,
    whiteSpace: 'nowrap',
  },

  opRow: {
    background: '#FFFFFF',
    border: '1px solid '+HAIR,
    borderRadius: 6,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  opHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  opKw: { fontSize: 12, color: INK, fontStyle: 'italic' },
  opMeta: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 10,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: INK_MUTE,
  },
  opReason: { fontSize: 11, lineHeight: 1.5, color: INK },

  magnetRow: {
    background: '#FFFFFF',
    border: '1px solid '+HAIR,
    borderRadius: 6,
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  magnetHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  magnetTitle: { fontSize: 12, color: INK },
  magnetMeta: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 10,
    letterSpacing: '0.10em',
    color: INK_MUTE,
  },

  weightRow: { display: 'grid', gridTemplateColumns: '110px 1fr 36px', gap: 8, alignItems: 'center' },
  weightLabel: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 10,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: INK_MUTE,
  },
  weightBarOuter: {
    height: 6,
    background: CREAM,
    border: '1px solid '+HAIR,
    borderRadius: 3,
    overflow: 'hidden',
  },
  weightBarInner: {
    height: '100%',
    background: GREEN,
  },
  weightVal: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 10,
    color: GREEN,
    textAlign: 'right',
  },
};
