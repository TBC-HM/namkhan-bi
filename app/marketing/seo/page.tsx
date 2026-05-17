// app/marketing/seo/page.tsx
//
// PBS 2026-05-16: SEO Auto-Blog + Local SEO Cockpit.
//
// Source spec: ~/Desktop/seo_auto_blog_local_seo_agentic_cockpit_ui.jsx (442
// lines, shadcn/Tailwind prototype). Adapted to brass design system: every
// Card → <Panel>, every shadcn Badge → mono chip in brass tokens, every
// numeric fontSize → var(--t-*), no hex literals.
//
// Surfaces (server component, no client interactivity Phase 1):
//   • Header band: 6 KPI tiles (Organic Sessions, Ranking Keywords, Articles,
//     Attributed Revenue, Weak Pages, CTR Improvement)
//   • Topic Clusters: 4 cluster cards (Wellness Laos, Luang Prabang Local
//     SEO, Digital Detox Asia, Farm To Table Laos)
//   • Production Loop: 8 numbered steps (Research → Refine)
//   • Agent Fleet: 6 cards (Keyword Intelligence, Local SEO, Content
//     Architect, AI Blog Writer, Reality & Brand, SEO Analytics)
//   • Right rail: Content Pipeline (4 items) · Local SEO Dominance · AI
//     Insights · Guardrails
//
// Phase-2 placeholder: cluster-detail drawer + cap_skills wiring lands when
// social_ai.* / seo.* schema exists.

import type { ReactNode } from 'react';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import { MARKETING_SUBPAGES } from '../_subpages';
import TabStrip, { WEB_TABS } from '@/app/finance/_components/TabStrip';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

// ─── Data ─────────────────────────────────────────────────────────────────

interface Cluster {
  name: string;
  keyword: string;
  pages: number;
  traffic: string;
  rank: string;
  score: number;
  status: 'Scaling' | 'Growing' | 'Opportunity' | 'Stable';
}

const CLUSTERS: Cluster[] = [
  { name: 'Wellness Laos',            keyword: 'wellness retreat Laos',        pages: 38, traffic: '+42%', rank: '#3 avg',  score: 92, status: 'Scaling'     },
  { name: 'Luang Prabang Local SEO',  keyword: 'things to do Luang Prabang',   pages: 61, traffic: '+28%', rank: '#5 avg',  score: 84, status: 'Growing'     },
  { name: 'Digital Detox Asia',       keyword: 'digital detox retreat Asia',   pages: 14, traffic: '+63%', rank: '#11 avg', score: 78, status: 'Opportunity' },
  { name: 'Farm To Table Laos',       keyword: 'farm to table Laos',           pages: 22, traffic: '+17%', rank: '#4 avg',  score: 81, status: 'Stable'      },
];

interface SeoAgent { name: string; desc: string; signal: string; cta: string }

const AGENTS: SeoAgent[] = [
  { name: 'Keyword Intelligence', desc: 'Builds keyword clusters, intent groups, seasonal trends and topical authority maps.', signal: '4.2k keywords', cta: 'Research'  },
  { name: 'Local SEO',            desc: 'Targets Luang Prabang and hyperlocal searches with maps, attractions, itineraries.', signal: '91 local pages', cta: 'Build'     },
  { name: 'Content Architect',    desc: 'Designs article structures, internal linking, FAQ blocks and conversion flow.',     signal: '128 outlines',   cta: 'Structure' },
  { name: 'AI Blog Writer',       desc: 'Creates SEO articles, multilingual variants and funnel-integrated content.',         signal: '312 drafts',     cta: 'Write'     },
  { name: 'Reality & Brand',      desc: 'Checks that content reflects the actual resort, location and real experiences.',    signal: '18 revisions',   cta: 'Validate'  },
  { name: 'SEO Analytics',        desc: 'Tracks rankings, CTR, traffic, bookings, decay and content opportunities.',         signal: '26 insights',    cta: 'Analyze'   },
];

interface PipelineItem { title: string; cluster: string; lang: string; stage: 'Ready to Publish' | 'Human Review' | 'AI Draft' | 'Queued'; seo: number }

const PIPELINE: PipelineItem[] = [
  { title: '7-Day Wellness Retreat in Laos',              cluster: 'Wellness Laos',  lang: 'EN', stage: 'Ready to Publish', seo: 94 },
  { title: 'Best Eco Resorts Near Luang Prabang',         cluster: 'Local SEO',      lang: 'DE', stage: 'Human Review',     seo: 87 },
  { title: 'Digital Detox Retreats in Southeast Asia',    cluster: 'Digital Detox',  lang: 'EN', stage: 'AI Draft',         seo: 81 },
  { title: 'What To Do In Luang Prabang During Rainy…',   cluster: 'Local SEO',      lang: 'FR', stage: 'Queued',           seo: 76 },
];

const WORKFLOW: { step: string; title: string; desc: string }[] = [
  { step: '01', title: 'Research',  desc: 'Google Trends, Search Console, keyword gaps, competitors and seasonality.' },
  { step: '02', title: 'Reason',    desc: 'AI decides if topic has commercial value or is SEO garbage.'               },
  { step: '03', title: 'Structure', desc: 'Outline, entities, FAQs, internal links, CTA and funnel path.'             },
  { step: '04', title: 'Write',     desc: 'Generate multilingual article variants with localized nuance.'             },
  { step: '05', title: 'Review',    desc: 'Human and reality agent validate claims, tone and visuals.'                },
  { step: '06', title: 'Publish',   desc: 'Push to CMS, sitemap, schema, internal links and social distribution.'     },
  { step: '07', title: 'Analyze',   desc: 'Track rankings, CTR, traffic, leads, bookings and decay.'                  },
  { step: '08', title: 'Refine',    desc: 'AI refreshes weak pages, expands clusters and improves conversion.'        },
];

// ─── Page ─────────────────────────────────────────────────────────────────

export default function MarketingSeoPage() {
  return (
    <Page
      eyebrow="Marketing · SEO"
      title={<>SEO <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>auto-blog</em> · Local SEO engine</>}
      subPages={MARKETING_SUBPAGES}
    >
      <TabStrip tabs={WEB_TABS} activeKey="seo" />

      {/* ─── Headline KPI band ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        <KpiBox value={128_000} unit="count" label="Organic Sessions"   delta={{ value: 31,  unit: 'pp', period: 'QoQ' }} tooltip="GA4 organic sessions, last 90d vs prior 90d" />
        <KpiBox value={4281}    unit="count" label="Ranking Keywords"   tooltip="Tracked in Search Console — 612 in top 10" valueText="4,281" />
        <KpiBox value={318}     unit="count" label="Published Articles" tooltip="12 languages across all clusters" />
        <KpiBox value={412_000} unit="usd"   label="Attributed Revenue" tooltip="SEO-assisted bookings — last-click + assisted attribution" />
        <KpiBox value={23}      unit="count" label="Weak Pages"         tooltip="Rankings decaying — need refresh" state="data-needed" needs="Search Console drilldown" />
        <KpiBox value={18}      unit="pp"    label="CTR Improvement"    delta={{ value: 18, unit: 'pp', period: 'titles+meta' }} />
      </div>

      {/* ─── Topic Clusters ─── */}
      <Panel title="Topic clusters" eyebrow="4 strategic SEO territories">
        <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {CLUSTERS.map((c) => (
            <ClusterCard key={c.name} cluster={c} />
          ))}
        </div>
      </Panel>

      {/* ─── Production Loop ─── */}
      <div style={{ marginTop: 14 }}>
        <Panel title="AI production loop" eyebrow="research → refine">
          <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            {WORKFLOW.map((s) => (
              <div key={s.step} style={S.workflowCell}>
                <div style={S.workflowStep}>{s.step}</div>
                <div style={S.workflowTitle}>{s.title}</div>
                <div style={S.workflowDesc}>{s.desc}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* ─── Two-column body: agents (left) + right rail ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 340px)', gap: 14, marginTop: 14, alignItems: 'start' }}>
        {/* LEFT — agent fleet */}
        <Panel title="Agent fleet" eyebrow="6 SEO specialists · queue-only">
          <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
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
        </Panel>

        {/* RIGHT — pipeline + dominance + insights + guardrails */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Panel title="Content pipeline" eyebrow={`${PIPELINE.length} in flight`}>
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {PIPELINE.map((p) => (
                <div key={p.title} style={S.pipelineRow}>
                  <div style={S.pipelineHead}>
                    <span style={S.pipelineTitle}>{p.title}</span>
                    <span style={scorePill(p.seo)}>{p.seo}</span>
                  </div>
                  <div style={S.pipelineMeta}>{p.cluster} · {p.lang}</div>
                  <div style={stagePill(p.stage)}>{p.stage}</div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Local SEO dominance" eyebrow="Luang Prabang hyperlocal">
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Callout tone="brass">AI continuously generates hyperlocal pages around Luang Prabang attractions, activities, temples and seasonal events.</Callout>
              <Callout tone="soft">Internal linking pushes authority toward retreat and booking funnels.</Callout>
              <Callout tone="warn">Weak local pages refreshed before rankings decay.</Callout>
            </div>
          </Panel>

          <Panel title="AI insights" eyebrow="signal · last 30d">
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Callout tone="brass">▲ German wellness pages converting <strong>2.1×</strong> higher than English info pages.</Callout>
              <Callout tone="warn">▼ 3 digital-detox articles attract traffic but weak intent — needs retreat CTA.</Callout>
              <Callout tone="soft">✦ Recommend new cluster: <em>Luxury Jungle Retreat Asia</em>.</Callout>
            </div>
          </Panel>

          <Panel title="Guardrails" eyebrow="non-negotiable">
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Callout tone="brass">No AI spam blogging. Every cluster must support a real business goal.</Callout>
              <Callout tone="warn">Reality Agent validates all content against actual resort experience + Laos context.</Callout>
              <Callout tone="soft">SEO articles must connect to funnels, lead magnets or booking paths.</Callout>
            </div>
          </Panel>
        </div>
      </div>

      <div style={S.footerNote}>
        Phase 1 cockpit · static spec. Phase 2 wires <code>seo.clusters</code> + <code>seo.articles</code> + <code>cap_skills</code> binding for the 6 agents; until then the action buttons are visual.
      </div>
    </Page>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────

function ClusterCard({ cluster }: { cluster: Cluster }) {
  const tone =
    cluster.status === 'Scaling'     ? 'brass' :
    cluster.status === 'Growing'     ? 'soft'  :
    cluster.status === 'Opportunity' ? 'warn'  : 'mute';
  return (
    <div style={S.clusterCard}>
      <div style={S.clusterHead}>
        <span style={S.clusterName}>{cluster.name}</span>
        <span style={statusPill(tone)}>{cluster.status}</span>
      </div>
      <div style={S.clusterKeyword}>“{cluster.keyword}”</div>
      <div style={S.clusterStatRow}>
        <Stat label="Score" value={`${cluster.score}/100`} />
        <Stat label="Traffic" value={cluster.traffic} />
        <Stat label="Rank" value={cluster.rank} />
      </div>
      <div style={S.clusterPages}>{cluster.pages} pages indexed</div>
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

// ─── Pill helpers ─────────────────────────────────────────────────────────

function statusPill(tone: 'brass' | 'soft' | 'warn' | 'mute'): React.CSSProperties {
  const color =
    tone === 'brass' ? 'var(--brass, #a8854a)' :
    tone === 'warn'  ? 'var(--st-warn, #C28F2C)' :
    tone === 'mute'  ? 'var(--text-mute, #9b907a)' :
                       'var(--text-2, #d8cca8)';
  return {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color,
    border: `1px solid ${color}`,
    padding: '2px 6px',
    borderRadius: 3,
    whiteSpace: 'nowrap',
  };
}

function scorePill(score: number): React.CSSProperties {
  const tone: 'brass' | 'soft' | 'warn' = score >= 90 ? 'brass' : score >= 80 ? 'soft' : 'warn';
  return statusPill(tone);
}

function stagePill(stage: PipelineItem['stage']): React.CSSProperties {
  const tone: 'brass' | 'soft' | 'warn' | 'mute' =
    stage === 'Ready to Publish' ? 'brass' :
    stage === 'Human Review'     ? 'warn'  :
    stage === 'AI Draft'         ? 'soft'  : 'mute';
  return { ...statusPill(tone), display: 'inline-block', alignSelf: 'flex-start', marginTop: 4 };
}

// ─── Styles ───────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  clusterCard: {
    background: 'var(--surf-1, #0f0d0a)',
    border: '1px solid var(--border-1, #1f1c15)',
    borderLeft: '3px solid var(--brass, #a8854a)',
    borderRadius: 6,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  clusterHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  clusterName: {
    fontFamily: "'Fraunces', Georgia, serif",
    fontStyle: 'italic',
    fontSize: 'var(--t-lg)',
    fontWeight: 500,
    color: 'var(--text-0, #e9e1ce)',
  },
  clusterKeyword: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--text-mute, #9b907a)',
  },
  clusterStatRow: { display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 4 },
  clusterPages: { fontSize: 'var(--t-xs)', color: 'var(--text-mute, #9b907a)', borderTop: '1px solid var(--border-1, #1f1c15)', paddingTop: 8 },

  statLabel: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: 'var(--text-place, #5a5448)',
  },
  statValue: { fontSize: 'var(--t-sm)', fontWeight: 600, color: 'var(--text-0, #e9e1ce)', fontVariantNumeric: 'tabular-nums' },

  workflowCell: {
    background: 'var(--surf-1, #0f0d0a)',
    border: '1px solid var(--border-1, #1f1c15)',
    borderRadius: 6,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  workflowStep: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.18em',
    color: 'var(--brass, #a8854a)',
  },
  workflowTitle: { fontSize: 'var(--t-md)', fontWeight: 600, color: 'var(--text-0, #e9e1ce)' },
  workflowDesc: { fontSize: 'var(--t-xs)', lineHeight: 1.5, color: 'var(--text-mute, #9b907a)' },

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

  pipelineRow: {
    background: 'var(--surf-1, #0f0d0a)',
    border: '1px solid var(--border-1, #1f1c15)',
    borderRadius: 6,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  pipelineHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  pipelineTitle: { fontSize: 'var(--t-sm)', color: 'var(--text-0, #e9e1ce)', fontWeight: 500 },
  pipelineMeta: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--text-mute, #9b907a)',
  },

  footerNote: {
    marginTop: 18,
    padding: '10px 12px',
    fontSize: 'var(--t-xs)',
    color: 'var(--text-mute, #9b907a)',
    fontStyle: 'italic',
    borderTop: '1px solid var(--border-1, #1f1c15)',
  },
};
