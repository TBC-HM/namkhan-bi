// app/marketing/web/page.tsx
// PBS 2026-07-05: Migrated to new paper-white design (DashboardPage + KpiTile
// + MARKETING_SUBPAGES tabs). All content is HARDCODED Phase 1 static spec —
// Phase 2 wires GA4 + Search Console + Cloudbeds booking events into
// web.funnel_daily.

import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_M = '#5A5A5A';
const INK_S = '#3A3A3A';
const FOREST = '#084838';
const RED    = '#B03826';
const CREAM  = '#F5F0E1';
const AMBER  = '#C28F2C';

// ─── HARDCODED data ────────────────────────────────────────────────────────

interface Stage { name: string; value: string; drop: string; issue: string }
const JOURNEY: Stage[] = [
  { name: 'Traffic Source',      value: '128k',  drop: '—',    issue: 'Pinterest + SEO growing' },
  { name: 'Landing Page',        value: '74k',   drop: '−42%', issue: 'Mobile hero weak' },
  { name: 'Room / Offer View',   value: '31k',   drop: '−58%', issue: 'Offer unclear' },
  { name: 'Booking Engine Open', value: '12.4k', drop: '−60%', issue: 'Date friction' },
  { name: 'Room Selected',       value: '4.9k',  drop: '−61%', issue: 'Rate-plan confusion' },
  { name: 'Payment / Confirm',   value: '1.1k',  drop: '−78%', issue: 'Trust + currency' },
];

interface Pg { name: string; url: string; traffic: string; conversion: string; issue: string; score: number; status: 'Needs test' | 'Scaling' | 'UX fix' | 'Critical' }
const PAGES: Pg[] = [
  { name: 'Homepage',              url: 'thenamkhan.com',              traffic: '42k',   conversion: '1.8%', issue: 'Hero too generic, weak booking CTA above fold.',                score: 71, status: 'Needs test' },
  { name: 'Wellness Retreat Page', url: '/wellness-retreat-laos',      traffic: '18k',   conversion: '4.9%', issue: 'Strong intent — scale German variant.',                         score: 91, status: 'Scaling'    },
  { name: 'Rooms & Villas',        url: '/rooms',                      traffic: '26k',   conversion: '2.4%', issue: 'Room comparison unclear on mobile.',                            score: 76, status: 'UX fix'     },
  { name: 'Booking Engine',        url: 'Cloudbeds / booking widget',  traffic: '12.4k', conversion: '8.8%', issue: 'Rate-plan naming + currency trust friction.',                    score: 68, status: 'Critical'   },
];

interface Fix { title: string; area: string; type: string; impact: string; effort: 'Low' | 'Medium' | 'High'; risk: 'Low' | 'Medium' | 'High'; recommendation: string }
const FIXES: Fix[] = [
  { title: 'Mobile hero CTA test',       area: 'Homepage',       type: 'A/B test',       impact: '+18–26% engine opens',       effort: 'Low',    risk: 'Low',    recommendation: 'Replace generic hero CTA with intent-specific booking CTA and secondary retreat CTA.' },
  { title: 'Rate-plan simplification',   area: 'Booking Engine', type: 'Copy + config',  impact: '+9–14% room selection',      effort: 'Medium', risk: 'Medium', recommendation: 'Reduce rate-plan naming confusion. Highlight breakfast, flexibility and member rate clearly.' },
  { title: 'Trust block before payment', area: 'Payment step',   type: 'Code / widget',  impact: '+6–11% checkout completion', effort: 'Medium', risk: 'Low',    recommendation: 'Add reassurance layer: secure payment, cancellation clarity, currency note, direct-booking benefit.' },
];

interface WebAgent { name: string; desc: string; signal: string }
const AGENTS: WebAgent[] = [
  { name: 'Journey Analytics',   desc: 'Maps traffic source to website behavior, booking events and revenue outcome.',           signal: '6 leaks' },
  { name: 'UX Diagnosis',        desc: 'Finds friction in mobile, copy, CTA hierarchy, room flow and trust gaps.',                signal: '14 issues' },
  { name: 'Booking Engine',      desc: 'Analyzes rate plans, date picker, room cards, promo codes, currency, checkout friction.', signal: '5 fixes' },
  { name: 'Code Optimization',   desc: 'Writes safe front-end changes, GTM scripts, widgets and A/B test variants for approval.', signal: '8 snippets' },
  { name: 'A/B Testing',         desc: 'Creates test hypothesis, variants, sample rules, success metrics and rollback plan.',     signal: '3 tests' },
  { name: 'Revenue Attribution', desc: 'Connects traffic, pages, engine events and revenue to see what really converts.',         signal: '$109k assist' },
];

const CRO_STEPS: { step: string; title: string; desc: string }[] = [
  { step: '01', title: 'Track',    desc: 'GA4, GTM, heatmaps, booking events, revenue attribution.' },
  { step: '02', title: 'Diagnose', desc: 'AI finds friction, drop-offs, bad copy and weak CTAs.' },
  { step: '03', title: 'Code',     desc: 'AI generates safe snippets, components or config changes.' },
  { step: '04', title: 'Test',     desc: 'A/B tests with hypothesis, metric and rollback.' },
  { step: '05', title: 'Deploy',   desc: 'Ship approved changes through controlled release.' },
  { step: '06', title: 'Learn',    desc: 'Winning tests become standards. Losers killed.' },
];

interface TestItem { name: string; page: string; status: 'Running' | 'Ready' | 'Approval' | 'Draft'; lift: string }
const TEST_QUEUE: TestItem[] = [
  { name: 'Hero CTA — "Book Your Retreat" vs "Check Availability"', page: 'Homepage',       status: 'Running',  lift: '+12% clicks' },
  { name: 'Room card — benefits above fold',                        page: 'Rooms',          status: 'Ready',    lift: 'Projected +9%' },
  { name: 'Member-rate explanation widget',                         page: 'Booking Engine', status: 'Approval', lift: 'Projected +14%' },
  { name: 'Currency reassurance near checkout',                     page: 'Payment',        status: 'Draft',    lift: 'Projected +7%' },
];

interface CodeItem { title: string; type: string; risk: 'Low' | 'Medium' | 'High'; status: 'Ready' | 'Review' | 'Draft' }
const CODE_QUEUE: CodeItem[] = [
  { title: 'Sticky mobile booking CTA',   type: 'JS / CSS',        risk: 'Low',    status: 'Ready' },
  { title: 'Booking-engine trust widget', type: 'GTM injection',   risk: 'Medium', status: 'Review' },
  { title: 'Room comparison helper',      type: 'React component', risk: 'Low',    status: 'Draft' },
  { title: 'Promo unlock event tracking', type: 'GTM / GA4',       risk: 'Low',    status: 'Ready' },
];

// ─── Page ──────────────────────────────────────────────────────────────────

export default function MarketingWebPage() {
  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map((s: any) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/marketing/web',
  }));

  const tiles: KpiTileProps[] = [
    { label: 'Website CVR',       value: '2.7%',    size: 'sm', footnote: 'GA4 · sessions → confirmed' },
    { label: 'Engine CVR',        value: '8.8%',    size: 'sm', footnote: 'engine open → confirm' },
    { label: 'Mobile share',      value: '71%',     size: 'sm', footnote: 'mobile-first priority' },
    { label: 'Revenue leakage',   value: '$64k',    size: 'sm', footnote: 'estimated MTD lost' },
    { label: 'Active tests',      value: 3,         size: 'sm', footnote: '2 winning · 1 inconclusive' },
    { label: 'Code fixes ready',  value: 8,         size: 'sm', footnote: 'in approval queue' },
  ];

  return (
    <div style={{ background: WHITE, minHeight: '100vh' }}>
      <DashboardPage
        title="Marketing · Web"
        subtitle="Website + booking engine · conversion cockpit"
        tabs={tabs}
      >
        {/* HARDCODED banner */}
        <Banner text="HARDCODED DATA — Phase 1 static spec. All numbers are illustrative until GA4 + Search Console + Cloudbeds events wire into web.funnel_daily." />

        {/* KPI band */}
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>

        {/* Customer journey funnel */}
        <Section title="Where the money leaks" note="full customer journey · session-weighted">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            {JOURNEY.map((s, i) => {
              const dropNum = Math.abs(parseFloat(s.drop.replace(/[^\d.]/g, ''))) || 0;
              const dropColor = s.drop === '—' ? FOREST : dropNum >= 70 ? RED : dropNum >= 55 ? AMBER : INK_M;
              return (
                <div key={s.name} style={stageCardSt}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={stageIdxSt}>{String(i + 1).padStart(2, '0')}</span>
                    <span style={pillSt(dropColor)}>{s.drop}</span>
                  </div>
                  <div style={stageNameSt}>{s.name}</div>
                  <div style={stageValueSt}>{s.value}</div>
                  <div style={stageIssueSt}>{s.issue}</div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* Page + engine performance */}
        <Section title="Page + engine performance" note="conversion score · friction diagnosis">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
            {PAGES.map((p) => <PageCard key={p.name} page={p} />)}
          </div>
        </Section>

        {/* CRO loop */}
        <Section title="CRO loop" note="track → learn">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            {CRO_STEPS.map((s) => (
              <div key={s.step} style={workflowCellSt}>
                <div style={workflowStepSt}>{s.step}</div>
                <div style={workflowTitleSt}>{s.title}</div>
                <div style={workflowDescSt}>{s.desc}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Two-column: agents + right rail */}
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 340px)', gap: 12, alignItems: 'start' }}>
          <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
            <div style={sectionHeadSt}>
              <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>Agent fleet</div>
              <div style={sectionNoteSt}>6 CRO specialists · queue-only</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, marginTop: 10 }}>
              {AGENTS.map((a) => (
                <div key={a.name} style={agentCardSt}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: INK }}>{a.name}</span>
                    <span style={signalPillSt}>{a.signal}</span>
                  </div>
                  <div style={{ fontSize: 11, color: INK_M, lineHeight: 1.5, marginTop: 4 }}>{a.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
              <div style={sectionHeadSt}>
                <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>Top fixes</div>
                <div style={sectionNoteSt}>{FIXES.length} ready · approval</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                {FIXES.map((f) => (
                  <div key={f.title} style={{ padding: '8px 10px', border: `1px solid ${HAIR}`, borderRadius: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: INK }}>{f.title}</span>
                      <span style={pillSt(f.risk === 'Low' ? FOREST : f.risk === 'Medium' ? AMBER : RED)}>{f.risk} risk</span>
                    </div>
                    <div style={{ fontSize: 10, color: INK_M, marginTop: 3 }}>{f.area} · {f.type}</div>
                    <div style={{ fontSize: 11, color: INK_S, marginTop: 4, lineHeight: 1.5 }}>{f.recommendation}</div>
                    <div style={{ fontSize: 11, color: INK_M, marginTop: 4 }}>Impact: <strong style={{ color: FOREST }}>{f.impact}</strong></div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
              <div style={sectionHeadSt}>
                <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>A/B test queue</div>
                <div style={sectionNoteSt}>{TEST_QUEUE.length} in flight</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                {TEST_QUEUE.map((t) => (
                  <div key={t.name} style={{ padding: '6px 8px', border: `1px solid ${HAIR}`, borderRadius: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: INK }}>{t.name}</span>
                      <span style={pillSt(t.status === 'Running' ? FOREST : t.status === 'Approval' ? AMBER : INK_M)}>{t.status}</span>
                    </div>
                    <div style={{ fontSize: 10, color: INK_M, marginTop: 2 }}>{t.page} · {t.lift}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
              <div style={sectionHeadSt}>
                <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>Code queue</div>
                <div style={sectionNoteSt}>{CODE_QUEUE.length} pending</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                {CODE_QUEUE.map((c) => (
                  <div key={c.title} style={{ padding: '6px 8px', border: `1px solid ${HAIR}`, borderRadius: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: INK }}>{c.title}</span>
                      <span style={pillSt(c.risk === 'Low' ? FOREST : AMBER)}>{c.risk} risk</span>
                    </div>
                    <div style={{ fontSize: 10, color: INK_M, marginTop: 2 }}>{c.type} · {c.status}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
              <div style={sectionHeadSt}>
                <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>Guardrails</div>
                <div style={sectionNoteSt}>non-negotiable</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                <Callout tone="brass">No blind redesign. Every change needs hypothesis, metric and rollback.</Callout>
                <Callout tone="warn">Booking-engine code changes require QA on mobile, desktop, currency, promo and payment flow.</Callout>
                <Callout tone="soft">AI can generate code — deployment needs human approval + tracked release notes.</Callout>
                <Callout tone="soft">Revenue attribution separates website-assisted, engine-open and confirmed-booking events.</Callout>
              </div>
            </div>
          </div>
        </div>

        <div style={{ gridColumn: '1 / -1', padding: '10px 12px', fontSize: 11, color: INK_M, fontStyle: 'italic', borderTop: `1px solid ${HAIR}` }}>
          Phase 1 cockpit · static spec. Phase 2 wires GA4 + Search Console + Cloudbeds booking events into <code>web.funnel_daily</code> and lights up the 6 agents via <code>cap_skills</code>.
        </div>
      </DashboardPage>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function Banner({ text }: { text: string }) {
  return (
    <div style={{
      gridColumn: '1 / -1',
      padding: '8px 12px',
      background: '#FFF4D6',
      border: `1px solid ${AMBER}`,
      borderRadius: 4,
      fontSize: 12,
      fontWeight: 600,
      color: INK,
    }}>
      {text}
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div style={{ gridColumn: '1 / -1', background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
      <div style={sectionHeadSt}>
        <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{title}</div>
        {note && <div style={sectionNoteSt}>{note}</div>}
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}

function PageCard({ page }: { page: Pg }) {
  const scoreColor = page.score >= 85 ? FOREST : page.score >= 72 ? INK_M : RED;
  const statusColor =
    page.status === 'Scaling'    ? FOREST :
    page.status === 'Critical'   ? RED  :
    page.status === 'UX fix'     ? AMBER  :
                                    INK_M;
  return (
    <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: INK }}>{page.name}</span>
        <span style={pillSt(statusColor)}>{page.status}</span>
      </div>
      <div style={{ fontSize: 10, color: INK_M }}>{page.url}</div>
      <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
        <Stat label="Score" value={`${page.score}/100`} />
        <Stat label="CVR" value={page.conversion} />
        <Stat label="Traffic" value={page.traffic} />
        <span style={{ marginLeft: 'auto', ...pillSt(scoreColor) }}>{page.score}</span>
      </div>
      <div style={{ fontSize: 11, color: INK_S, lineHeight: 1.5, marginTop: 2 }}>{page.issue}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontSize: 9, color: INK_M, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: 11, color: INK, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function Callout({ tone, children }: { tone: 'brass' | 'soft' | 'warn'; children: React.ReactNode }) {
  const border = tone === 'brass' ? FOREST : tone === 'warn' ? AMBER : HAIR;
  return (
    <div style={{ padding: '6px 8px', borderLeft: `2px solid ${border}`, background: CREAM, fontSize: 11, lineHeight: 1.5, color: INK_S }}>
      {children}
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const sectionHeadSt: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' };
const sectionNoteSt: React.CSSProperties = { fontSize: 10, color: INK_M, letterSpacing: '0.06em', textTransform: 'uppercase' };
const stageCardSt: React.CSSProperties = { background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 };
const stageIdxSt: React.CSSProperties = { fontSize: 10, color: INK_M, letterSpacing: '0.10em' };
const stageNameSt: React.CSSProperties = { fontSize: 10, color: INK_M, letterSpacing: '0.06em', textTransform: 'uppercase' };
const stageValueSt: React.CSSProperties = { fontSize: 20, color: INK, fontWeight: 700, marginTop: 2 };
const stageIssueSt: React.CSSProperties = { fontSize: 11, color: INK_S, lineHeight: 1.4 };
const workflowCellSt: React.CSSProperties = { background: CREAM, border: `1px solid ${HAIR}`, borderRadius: 4, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 };
const workflowStepSt: React.CSSProperties = { fontSize: 10, color: FOREST, fontWeight: 700, letterSpacing: '0.10em' };
const workflowTitleSt: React.CSSProperties = { fontSize: 12, color: INK, fontWeight: 600 };
const workflowDescSt: React.CSSProperties = { fontSize: 10, color: INK_M, lineHeight: 1.4 };
const agentCardSt: React.CSSProperties = { background: CREAM, border: `1px solid ${HAIR}`, borderRadius: 4, padding: '8px 10px' };
const signalPillSt: React.CSSProperties = { fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: FOREST, border: `1px solid ${FOREST}`, padding: '1px 5px', borderRadius: 2 };

function pillSt(color: string): React.CSSProperties {
  return {
    fontSize: 9,
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
    color,
    border: `1px solid ${color}`,
    padding: '1px 5px',
    borderRadius: 2,
    whiteSpace: 'nowrap',
    fontWeight: 600,
  };
}
