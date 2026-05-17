// app/marketing/web/page.tsx
//
// PBS 2026-05-16: Website + Booking Engine Conversion Cockpit.
//
// Source spec: ~/Desktop/website_booking_engine_conversion_cockpit_ui.jsx
// (464 lines, shadcn/Tailwind prototype). Adapted to brass design: every
// Card → <Panel>, page selector kept static (no useState — Phase 1).
//
// Surfaces:
//   • Header KPI band: 6 reports (Website CVR, Engine CVR, Mobile share,
//     Revenue leakage, Active tests, Code fixes ready)
//   • Customer Journey: 6-stage funnel (Traffic → Payment) with drop% per
//     stage as horizontal flow
//   • Page + Engine Performance: 4 page cards (Home, Wellness Retreat,
//     Rooms & Villas, Booking Engine) each with score / CVR / fix
//   • CRO Loop: 6-step cycle (Track → Learn)
//   • Agent Fleet: 6 cards (Journey, UX, Engine, Code, A/B, Attribution)
//   • Right rail: Top Fixes (3) · A/B Queue (4) · Code Queue (4) · Guardrails

import type { ReactNode } from 'react';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import { MARKETING_SUBPAGES } from '../_subpages';
import TabStrip, { WEB_TABS } from '@/app/finance/_components/TabStrip';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

// ─── Data ─────────────────────────────────────────────────────────────────

interface Stage { name: string; value: string; drop: string; issue: string }
const JOURNEY: Stage[] = [
  { name: 'Traffic Source',      value: '128k',  drop: '—',         issue: 'Pinterest + SEO growing'      },
  { name: 'Landing Page',        value: '74k',   drop: '−42%',      issue: 'Mobile hero weak'             },
  { name: 'Room / Offer View',   value: '31k',   drop: '−58%',      issue: 'Offer unclear'                },
  { name: 'Booking Engine Open', value: '12.4k', drop: '−60%',      issue: 'Date friction'                },
  { name: 'Room Selected',       value: '4.9k',  drop: '−61%',      issue: 'Rate-plan confusion'          },
  { name: 'Payment / Confirm',   value: '1.1k',  drop: '−78%',      issue: 'Trust + currency'             },
];

interface Pg { name: string; url: string; traffic: string; conversion: string; issue: string; score: number; status: 'Needs test' | 'Scaling' | 'UX fix' | 'Critical' }
const PAGES: Pg[] = [
  { name: 'Homepage',              url: 'thenamkhan.com',           traffic: '42k',   conversion: '1.8%', issue: 'Hero too generic, weak booking CTA above fold.',          score: 71, status: 'Needs test' },
  { name: 'Wellness Retreat Page', url: '/wellness-retreat-laos',   traffic: '18k',   conversion: '4.9%', issue: 'Strong intent — scale German variant.',                   score: 91, status: 'Scaling'    },
  { name: 'Rooms & Villas',        url: '/rooms',                   traffic: '26k',   conversion: '2.4%', issue: 'Room comparison unclear on mobile.',                      score: 76, status: 'UX fix'     },
  { name: 'Booking Engine',        url: 'Cloudbeds / booking widget', traffic: '12.4k', conversion: '8.8%', issue: 'Rate-plan naming + currency trust friction.',           score: 68, status: 'Critical'   },
];

interface Fix { title: string; area: string; type: string; impact: string; effort: 'Low' | 'Medium' | 'High'; risk: 'Low' | 'Medium' | 'High'; recommendation: string }
const FIXES: Fix[] = [
  { title: 'Mobile hero CTA test',      area: 'Homepage',      type: 'A/B test',           impact: '+18–26% engine opens',     effort: 'Low',    risk: 'Low',    recommendation: 'Replace generic hero CTA with intent-specific booking CTA and secondary retreat CTA.' },
  { title: 'Rate-plan simplification',  area: 'Booking Engine', type: 'Copy + config',     impact: '+9–14% room selection',    effort: 'Medium', risk: 'Medium', recommendation: 'Reduce rate-plan naming confusion. Highlight breakfast, flexibility and member rate clearly.' },
  { title: 'Trust block before payment', area: 'Payment step',  type: 'Code / widget',     impact: '+6–11% checkout completion', effort: 'Medium', risk: 'Low',    recommendation: 'Add reassurance layer: secure payment, cancellation clarity, currency note, direct-booking benefit.' },
];

interface WebAgent { name: string; desc: string; signal: string; cta: string }
const AGENTS: WebAgent[] = [
  { name: 'Journey Analytics',     desc: 'Maps traffic source to website behavior, booking events and revenue outcome.',           signal: '6 leaks',       cta: 'Analyze'   },
  { name: 'UX Diagnosis',          desc: 'Finds friction in mobile, copy, CTA hierarchy, room flow and trust gaps.',                signal: '14 issues',     cta: 'Diagnose'  },
  { name: 'Booking Engine',        desc: 'Analyzes rate plans, date picker, room cards, promo codes, currency, checkout friction.', signal: '5 fixes',       cta: 'Audit'     },
  { name: 'Code Optimization',     desc: 'Writes safe front-end changes, GTM scripts, widgets and A/B test variants for approval.', signal: '8 snippets',    cta: 'Generate'  },
  { name: 'A/B Testing',           desc: 'Creates test hypothesis, variants, sample rules, success metrics and rollback plan.',     signal: '3 tests',       cta: 'Create'    },
  { name: 'Revenue Attribution',   desc: 'Connects traffic, pages, engine events and revenue to see what really converts.',         signal: '$109k assist',  cta: 'Attribute' },
];

const CRO_STEPS: { step: string; title: string; desc: string }[] = [
  { step: '01', title: 'Track',    desc: 'GA4, GTM, heatmaps, booking events, revenue attribution.' },
  { step: '02', title: 'Diagnose', desc: 'AI finds friction, drop-offs, bad copy and weak CTAs.'    },
  { step: '03', title: 'Code',     desc: 'AI generates safe snippets, components or config changes.' },
  { step: '04', title: 'Test',     desc: 'A/B tests with hypothesis, metric and rollback.'           },
  { step: '05', title: 'Deploy',   desc: 'Ship approved changes through controlled release.'        },
  { step: '06', title: 'Learn',    desc: 'Winning tests become standards. Losers killed.'           },
];

interface TestItem { name: string; page: string; status: 'Running' | 'Ready' | 'Approval' | 'Draft'; lift: string }
const TEST_QUEUE: TestItem[] = [
  { name: 'Hero CTA — "Book Your Retreat" vs "Check Availability"', page: 'Homepage',       status: 'Running',  lift: '+12% clicks'      },
  { name: 'Room card — benefits above fold',                        page: 'Rooms',          status: 'Ready',    lift: 'Projected +9%'    },
  { name: 'Member-rate explanation widget',                         page: 'Booking Engine', status: 'Approval', lift: 'Projected +14%'   },
  { name: 'Currency reassurance near checkout',                     page: 'Payment',        status: 'Draft',    lift: 'Projected +7%'    },
];

interface CodeItem { title: string; type: string; risk: 'Low' | 'Medium' | 'High'; status: 'Ready' | 'Review' | 'Draft' }
const CODE_QUEUE: CodeItem[] = [
  { title: 'Sticky mobile booking CTA',     type: 'JS / CSS',        risk: 'Low',    status: 'Ready'  },
  { title: 'Booking-engine trust widget',   type: 'GTM injection',   risk: 'Medium', status: 'Review' },
  { title: 'Room comparison helper',        type: 'React component', risk: 'Low',    status: 'Draft'  },
  { title: 'Promo unlock event tracking',   type: 'GTM / GA4',       risk: 'Low',    status: 'Ready'  },
];

// ─── Page ─────────────────────────────────────────────────────────────────

export default function MarketingWebPage() {
  return (
    <Page
      eyebrow="Marketing · Web"
      title={<>Website + <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>booking engine</em> · conversion cockpit</>}
      subPages={MARKETING_SUBPAGES}
    >
      <TabStrip tabs={WEB_TABS} activeKey="web" />

      {/* ─── Headline KPI band ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        <KpiBox value={2.7}     unit="pct"   label="Website Conversion" delta={{ value: 0.4, unit: 'pp', period: 'MTD' }} tooltip="GA4 sessions → confirmed booking, last 30d" />
        <KpiBox value={8.8}     unit="pct"   label="Engine CVR"         delta={{ value: -1.2, unit: 'pp', period: 'MTD' }} tooltip="Booking engine open → confirm — critical drop-off" />
        <KpiBox value={71}      unit="pct"   label="Mobile Share"       tooltip="Mobile-first fixes prioritized" />
        <KpiBox value={64_000}  unit="usd"   label="Revenue Leakage"    tooltip="Estimated MTD lost revenue from funnel drops" />
        <KpiBox value={3}       unit="count" label="Active Tests"       tooltip="2 winning · 1 inconclusive" />
        <KpiBox value={8}       unit="count" label="Code Fixes Ready"   state="data-needed" needs="Approval queue" />
      </div>

      {/* ─── Customer journey funnel ─── */}
      <Panel title="Where the money leaks" eyebrow="full customer journey · session-weighted">
        <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          {JOURNEY.map((s, i) => {
            const dropNum = Math.abs(parseFloat(s.drop.replace(/[^\d.]/g, ''))) || 0;
            const tone: 'brass' | 'soft' | 'warn' =
              s.drop === '—' ? 'brass' :
              dropNum >= 70   ? 'warn'  :
              dropNum >= 55   ? 'warn'  : 'soft';
            return (
              <div key={s.name} style={S.stageCard}>
                <div style={S.stageHead}>
                  <span style={S.stageIdx}>{String(i + 1).padStart(2, '0')}</span>
                  <span style={statusPill(tone)}>{s.drop}</span>
                </div>
                <div style={S.stageName}>{s.name}</div>
                <div style={S.stageValue}>{s.value}</div>
                <div style={S.stageIssue}>{s.issue}</div>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* ─── Page + Engine performance ─── */}
      <div style={{ marginTop: 14 }}>
        <Panel title="Page + engine performance" eyebrow="conversion score · friction diagnosis">
          <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {PAGES.map((p) => <PageCard key={p.name} page={p} />)}
          </div>
        </Panel>
      </div>

      {/* ─── CRO Loop ─── */}
      <div style={{ marginTop: 14 }}>
        <Panel title="CRO loop" eyebrow="track → learn">
          <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            {CRO_STEPS.map((s) => (
              <div key={s.step} style={S.workflowCell}>
                <div style={S.workflowStep}>{s.step}</div>
                <div style={S.workflowTitle}>{s.title}</div>
                <div style={S.workflowDesc}>{s.desc}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* ─── Two-column: agents (left) + right rail ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 340px)', gap: 14, marginTop: 14, alignItems: 'start' }}>
        {/* LEFT — agent fleet */}
        <Panel title="Agent fleet" eyebrow="6 CRO specialists · queue-only">
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

        {/* RIGHT — fixes + tests + code + guardrails */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Panel title="Top fixes" eyebrow={`${FIXES.length} ready · approval`}>
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {FIXES.map((f) => (
                <div key={f.title} style={S.fixRow}>
                  <div style={S.fixHead}>
                    <span style={S.fixTitle}>{f.title}</span>
                    <span style={statusPill(f.risk === 'Low' ? 'brass' : f.risk === 'Medium' ? 'warn' : 'mute')}>{f.risk} risk</span>
                  </div>
                  <div style={S.fixMeta}>{f.area} · {f.type}</div>
                  <div style={S.fixRec}>{f.recommendation}</div>
                  <div style={S.fixImpact}>Impact: <strong style={{ color: 'var(--brass, #a8854a)' }}>{f.impact}</strong></div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="A/B test queue" eyebrow={`${TEST_QUEUE.length} in flight`}>
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {TEST_QUEUE.map((t) => (
                <div key={t.name} style={S.queueRow}>
                  <div style={S.queueHead}>
                    <span style={S.queueTitle}>{t.name}</span>
                    <span style={statusPill(t.status === 'Running' ? 'brass' : t.status === 'Approval' ? 'warn' : 'mute')}>{t.status}</span>
                  </div>
                  <div style={S.queueMeta}>{t.page} · {t.lift}</div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Code queue" eyebrow={`${CODE_QUEUE.length} pending`}>
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {CODE_QUEUE.map((c) => (
                <div key={c.title} style={S.queueRow}>
                  <div style={S.queueHead}>
                    <span style={S.queueTitle}>{c.title}</span>
                    <span style={statusPill(c.risk === 'Low' ? 'brass' : 'warn')}>{c.risk} risk</span>
                  </div>
                  <div style={S.queueMeta}>{c.type} · {c.status}</div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Guardrails" eyebrow="non-negotiable">
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Callout tone="brass">No blind redesign. Every change needs hypothesis, metric and rollback.</Callout>
              <Callout tone="warn">Booking-engine code changes require QA on mobile, desktop, currency, promo and payment flow.</Callout>
              <Callout tone="soft">AI can generate code — deployment needs human approval + tracked release notes.</Callout>
              <Callout tone="soft">Revenue attribution separates website-assisted, engine-open and confirmed-booking events.</Callout>
            </div>
          </Panel>
        </div>
      </div>

      <div style={S.footerNote}>
        Phase 1 cockpit · static spec. Phase 2 wires GA4 + Search Console + Cloudbeds booking events into <code>web.funnel_daily</code> and lights up the 6 agents via <code>cap_skills</code>.
      </div>
    </Page>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────

function PageCard({ page }: { page: Pg }) {
  const scoreTone: 'brass' | 'soft' | 'warn' = page.score >= 85 ? 'brass' : page.score >= 72 ? 'soft' : 'warn';
  const statusTone: 'brass' | 'soft' | 'warn' | 'mute' =
    page.status === 'Scaling'    ? 'brass' :
    page.status === 'Critical'   ? 'warn'  :
    page.status === 'UX fix'     ? 'warn'  :
    page.status === 'Needs test' ? 'soft'  : 'mute';
  return (
    <div style={S.pageCard}>
      <div style={S.pageHead}>
        <span style={S.pageName}>{page.name}</span>
        <span style={statusPill(statusTone)}>{page.status}</span>
      </div>
      <div style={S.pageUrl}>{page.url}</div>
      <div style={S.pageStatRow}>
        <Stat label="Score"   value={`${page.score}/100`} />
        <Stat label="CVR"     value={page.conversion} />
        <Stat label="Traffic" value={page.traffic} />
        <span style={statusPill(scoreTone)}>{page.score}</span>
      </div>
      <div style={S.pageIssue}>{page.issue}</div>
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

// ─── Styles ───────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  // Journey funnel cells
  stageCard: {
    background: 'var(--surf-1, #0f0d0a)',
    border: '1px solid var(--border-1, #1f1c15)',
    borderRadius: 6,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  stageHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  stageIdx: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.18em',
    color: 'var(--text-place, #5a5448)',
  },
  stageName: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--text-mute, #9b907a)',
  },
  stageValue: {
    fontFamily: "'Fraunces', Georgia, serif",
    fontStyle: 'italic',
    fontSize: 'var(--t-xl)',
    fontWeight: 400,
    color: 'var(--text-0, #e9e1ce)',
  },
  stageIssue: { fontSize: 'var(--t-xs)', color: 'var(--text-mute, #9b907a)', lineHeight: 1.4 },

  // Page cards
  pageCard: {
    background: 'var(--surf-1, #0f0d0a)',
    border: '1px solid var(--border-1, #1f1c15)',
    borderLeft: '3px solid var(--brass, #a8854a)',
    borderRadius: 6,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  pageHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  pageName: {
    fontFamily: "'Fraunces', Georgia, serif",
    fontStyle: 'italic',
    fontSize: 'var(--t-lg)',
    fontWeight: 500,
    color: 'var(--text-0, #e9e1ce)',
  },
  pageUrl: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.14em',
    color: 'var(--text-mute, #9b907a)',
  },
  pageStatRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    borderTop: '1px solid var(--border-1, #1f1c15)',
    paddingTop: 8,
  },
  pageIssue: { fontSize: 'var(--t-sm)', color: 'var(--text-1, #d8cca8)', lineHeight: 1.5 },

  // Stats inside cards
  statLabel: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: 'var(--text-place, #5a5448)',
  },
  statValue: { fontSize: 'var(--t-sm)', fontWeight: 600, color: 'var(--text-0, #e9e1ce)', fontVariantNumeric: 'tabular-nums' },

  // CRO workflow cells (shared shape with SEO)
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

  // Fix rows
  fixRow: {
    background: 'var(--surf-1, #0f0d0a)',
    border: '1px solid var(--border-1, #1f1c15)',
    borderRadius: 6,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  fixHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  fixTitle: { fontSize: 'var(--t-sm)', fontWeight: 600, color: 'var(--text-0, #e9e1ce)' },
  fixMeta: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--text-mute, #9b907a)',
  },
  fixRec: { fontSize: 'var(--t-xs)', lineHeight: 1.5, color: 'var(--text-1, #d8cca8)' },
  fixImpact: { fontSize: 'var(--t-xs)', color: 'var(--text-mute, #9b907a)', borderTop: '1px solid var(--border-1, #1f1c15)', paddingTop: 6 },

  // Queue rows (A/B + Code share)
  queueRow: {
    background: 'var(--surf-1, #0f0d0a)',
    border: '1px solid var(--border-1, #1f1c15)',
    borderRadius: 6,
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  queueHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  queueTitle: { fontSize: 'var(--t-sm)', color: 'var(--text-0, #e9e1ce)' },
  queueMeta: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.14em',
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
