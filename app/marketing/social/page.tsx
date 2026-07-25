// app/marketing/social/page.tsx
// PBS 2026-07-23: YouTube owns /marketing/digital; GBP is a first-class LIVE
//   channel with its own landing at /marketing/social/google-business.
// PBS 2026-07-25 (spec-social-media-module · A1, run 1): Channels view DB-backed —
//   marketing.social_accounts + social_channel_rules + social_programs.
// PBS 2026-07-25 (run 2 · A3/A6): Calendar, flow and inbox are now DB-backed.
//   Calendar = marketing.social_calendar slots generated from the weekly
//   programs (rule-based v1, /api/marketing/social/generate-plan), accept →
//   draft post in marketing.social_posts (newsletter-director pattern).
//   Flow = live slot→post pipeline. Inbox = one box per active channel
//   (broadcast analog, research §0.R R5). KPI band reads real slots + posts.
//   Still hardcoded: boost view (Phase-1 sample data — needs channel
//   analytics APIs) and the descriptive loop/ICP/agent panels.
//
// Five inner sections switched via ?view=: calendar · flow · channels · boost · inbox

import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import {
  getSocialAccountsForProperty, getSocialChannelRules, getSocialPrograms,
} from '@/lib/marketing';
import { getSocialCalendarSlots, getSocialPostsForProperty } from '@/lib/marketing-social';
import ChannelsManager from './_components/ChannelsManager';
import SocialCalendar from './_components/SocialCalendar';
import SocialFlow from './_components/SocialFlow';
import SocialInbox from './_components/SocialInbox';
import { MARKETING_SUBPAGES } from '../_subpages';

// Namkhan-only iteration (brief §7). /marketing/* legacy routes are
// Namkhan-scoped by contract (claude_md §0.7).
const NAMKHAN_PID = 260955;

export const dynamic = 'force-dynamic';
export const revalidate = 30;

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_M = '#5A5A5A';
const INK_S = '#3A3A3A';
const FOREST = '#084838';
const CREAM  = '#F5F0E1';
const AMBER  = '#C28F2C';

// ─── ICPs (descriptive targeting panel — not data claims) ─────────────────

interface Icp { name: string; market: string; emoji: string; pillars: string[] }
const ICPS: Icp[] = [
  { name: 'EU Wellness Women',    market: 'DACH · UK · NL',    emoji: '✦', pillars: ['Morning Rituals', 'Spa Reset', 'Full Moon'] },
  { name: 'Luxury Couples',       market: 'EU · US · AU',      emoji: '◆', pillars: ['Privacy', 'Romance', 'Candle Dinners'] },
  { name: 'Conscious Food',       market: 'US · EU · Asia',    emoji: '◉', pillars: ['Herb Garden', 'Local Chefs', 'Foraging'] },
  { name: 'Mystique Explorers',   market: 'US · AU · EU',      emoji: '◐', pillars: ['Temples', 'Monastic Rituals', 'River'] },
  { name: 'Digital Detox EU',     market: 'DACH · UK',         emoji: '◇', pillars: ['Quiet', 'River Silence', 'Tech-free'] },
  { name: 'Asia Source Markets',  market: 'TH · CN · JP · KR', emoji: '✺', pillars: ['Wellness', 'Cultural Heritage', 'Lao Cuisine'] },
  { name: 'Yoga Teachers · B2B',  market: 'EU · US',           emoji: '✿', pillars: ['Host your retreat', 'Group rates'] },
];

// ─── Boost candidates (Phase-1 sample — needs channel analytics APIs) ─────

interface BoostCandidate {
  hook: string;
  platform: string;
  organicReach: number;
  organicEngagement: string;
  signal: string;
  proposedBudget: string;
  projectedReach: string;
  projectedCpe: string;
  icp: string;
  verdict: 'Strong Boost' | 'Moderate Boost' | 'Test First' | 'Skip';
}

const BOOST_CANDIDATES: BoostCandidate[] = [
  { hook: 'Found the only river restaurant', platform: 'TikTok',    organicReach: 91_300, organicEngagement: '11.2%', signal: 'Top 1% organic · viral coefficient 1.4 · 312 shares', proposedBudget: '$240 · 7 days',  projectedReach: '480k–720k',  projectedCpe: '$0.04', icp: 'Luxury Couples',    verdict: 'Strong Boost' },
  { hook: 'Where dinner walks before dawn',  platform: 'Instagram', organicReach: 42_100, organicEngagement: '12.4%', signal: 'Top 5% carousel · long retention (74%) · saves up', proposedBudget: '$180 · Boost',    projectedReach: '95k–140k',   projectedCpe: '$0.18', icp: 'Conscious Food',    verdict: 'Strong Boost' },
  { hook: 'Why monks sweep at 4am',          platform: 'Instagram', organicReach: 38_200, organicEngagement: '8.4%',  signal: 'Saves climbing · DM intent · 4 booking clicks',     proposedBudget: '$120 · 5 days',   projectedReach: '180k–260k',  projectedCpe: '$0.07', icp: 'EU Wellness Women', verdict: 'Strong Boost' },
  { hook: 'Galangal harvest at dawn',        platform: 'Instagram', organicReach: 28_900, organicEngagement: '9.7%',  signal: 'Strong saves · weak DMs · needs CTA tweak',         proposedBudget: '$80 · A/B test',  projectedReach: '90k–130k',   projectedCpe: '$0.09', icp: 'Conscious Food',    verdict: 'Moderate Boost' },
  { hook: 'A ritual older than Europe',      platform: 'Pinterest', organicReach: 22_400, organicEngagement: '6.1%',  signal: 'Steady saves · evergreen — boost as Idea Pin',      proposedBudget: '$60 · evergreen', projectedReach: '120k–180k',  projectedCpe: '$0.05', icp: 'EU Wellness Women', verdict: 'Moderate Boost' },
];

// ─── Loop + Agents (descriptive) ──────────────────────────────────────────

const LOOP: { step: string; title: string; desc: string }[] = [
  { step: '01', title: 'Program',       desc: 'Weekly content programs per channel (Channels tab) drive the plan.' },
  { step: '02', title: 'Generate plan', desc: 'Rule-based expansion of programs into proposed calendar slots.' },
  { step: '03', title: 'Review',        desc: 'Accept → draft post in the channel inbox · reject to skip.' },
  { step: '04', title: 'Draft',         desc: 'Caption + hashtags + media per channel guardrails.' },
  { step: '05', title: 'Approve',       desc: 'Human sign-off in the inbox. Draft → ready.' },
  { step: '06', title: 'Export',        desc: 'Per-post / weekly zip download, formatted per channel spec (next run).' },
  { step: '07', title: 'Publish',       desc: 'Manual upload today · channel APIs later (GBP first — OAuth live).' },
  { step: '08', title: 'Analyze',       desc: 'Reach · saves · clicks → refines the next plan (needs channel APIs).' },
];

interface SocialAgent { name: string; desc: string; signal: string }
const AGENTS: SocialAgent[] = [
  { name: 'Content Strategist', desc: 'Designs pillar + hook + CTA + format · turns programs into briefs.',        signal: 'planned' },
  { name: 'Caption Writer',     desc: 'Multilingual captions + hashtags + alt-text (EN · DE · ES · LO · TH · JP).', signal: 'planned' },
  { name: 'Visual Director',    desc: 'Briefs visuals · selects from Library or commissions new shoot/render.',     signal: 'planned' },
  { name: 'Reality & Brand',    desc: 'Fact-check claims · visual reality · SLH/considerate brand-fit gate.',       signal: 'planned' },
  { name: 'Boost Strategist',   desc: 'Picks organic winners and proposes paid budget · projected reach · CPE.',    signal: 'planned' },
  { name: 'Analytics',          desc: 'Reach · saves · DMs · clicks · bookings · refines next brief.',              signal: 'planned' },
];

// ─── View params ──────────────────────────────────────────────────────────

type View = 'calendar' | 'flow' | 'channels' | 'boost' | 'inbox';
const VIEWS: View[] = ['calendar', 'flow', 'channels', 'boost', 'inbox'];
const VIEW_LABEL: Record<View, string> = {
  calendar: 'Calendar', flow: 'Content flow', channels: 'Channels', boost: 'Boost', inbox: 'Channel inbox',
};

function parseView(v: string | string[] | undefined): View {
  const s = typeof v === 'string' ? v : 'calendar';
  return (VIEWS as string[]).includes(s) ? (s as View) : 'calendar';
}
type Win = 14 | 28 | 60;
function parseWindow(v: string | string[] | undefined): Win {
  const n = Number(typeof v === 'string' ? v : 28);
  return (n === 14 || n === 60) ? n : 28;
}

function addDaysIso(baseIso: string, days: number): string {
  const d = new Date(baseIso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── Page ─────────────────────────────────────────────────────────────────

interface Props { searchParams?: { view?: string; ch?: string; w?: string } }

export default async function SocialPage({ searchParams }: Props) {
  const view = parseView(searchParams?.view);
  const windowDays: Win = parseWindow(searchParams?.w);
  const todayIso = new Date().toISOString().slice(0, 10);

  const [accounts, rules, programs, slots, posts] = await Promise.all([
    getSocialAccountsForProperty(NAMKHAN_PID),
    getSocialChannelRules(NAMKHAN_PID),
    getSocialPrograms(NAMKHAN_PID),
    getSocialCalendarSlots(NAMKHAN_PID, todayIso, addDaysIso(todayIso, windowDays)),
    getSocialPostsForProperty(NAMKHAN_PID),
  ]);

  const activePlatforms = rules.filter((r) => r.active).map((r) => r.platform);
  const chRaw = typeof searchParams?.ch === 'string' ? searchParams.ch : 'all';
  const channelFilter = chRaw === 'all' || activePlatforms.includes(chRaw) ? chRaw : 'all';

  // KPI band — live slots + posts (no fake numbers).
  const proposedSlots = slots.filter((s) => s.status === 'proposed').length;
  const draftPosts    = posts.filter((p) => p.status === 'draft').length;
  const readyPosts    = posts.filter((p) => p.status === 'ready').length;
  const scheduledPosts = posts.filter((p) => p.status === 'scheduled').length;
  const now = Date.now();
  const pushed30d = posts.filter((p) => p.status === 'pushed' && p.pushed_at && (now - new Date(p.pushed_at).getTime()) < 30 * 86400000).length;
  const failedPosts = posts.filter((p) => p.status === 'failed').length;

  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map((s: any) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/marketing/social',
  }));

  const tiles: KpiTileProps[] = [
    { label: 'Proposed slots',     value: proposedSlots,  size: 'sm', footnote: `${windowDays}d window · review in calendar` },
    { label: 'Drafts in inbox',    value: draftPosts,     size: 'sm', footnote: 'awaiting approval' },
    { label: 'Ready',              value: readyPosts,     size: 'sm', footnote: 'approved · awaiting export' },
    { label: 'Scheduled',          value: scheduledPosts, size: 'sm' },
    { label: 'Published · 30d',    value: pushed30d,      size: 'sm' },
    { label: 'Failed',             value: failedPosts,    size: 'sm', footnote: failedPosts > 0 ? 'action needed' : 'clear' },
  ];

  return (
    <div style={{ background: WHITE, minHeight: '100vh' }}>
      <DashboardPage
        title="Marketing · Social"
        subtitle="AI social cockpit — calendar · flow · channels · boost · inbox"
        tabs={tabs}
      >
        <Banner text="CALENDAR · FLOW · CHANNELS · INBOX are DB-backed (marketing.social_calendar → social_posts, programs drive the plan, guardrails in Property Settings). BOOST is still Phase-1 sample data — needs channel analytics APIs. Export (A5) + per-channel landings ship next." />

        {/* KPI band */}
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>

        {/* Sub-strip */}
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 8, borderBottom: `1px solid ${HAIR}` }}>
          {VIEWS.map((v) => (
            <a key={v} href={`?view=${v}`}
               style={{ ...subLinkSt, ...(v === view ? subLinkActiveSt : {}) }}>
              {VIEW_LABEL[v]}
            </a>
          ))}
        </div>

        {view === 'calendar' && (
          <SocialCalendar
            propertyId={NAMKHAN_PID} slots={slots} programs={programs}
            todayIso={todayIso} windowDays={windowDays}
            channelFilter={channelFilter} platforms={activePlatforms}
          />
        )}
        {view === 'flow' && <SocialFlow slots={slots} posts={posts} />}
        {view === 'channels' && (
          <ChannelsManager propertyId={NAMKHAN_PID} accounts={accounts} rules={rules} programs={programs} />
        )}
        {view === 'boost' && <BoostView />}
        {view === 'inbox' && <SocialInbox posts={posts} rules={rules} />}

        {/* Two-col: loop + ICP list + guardrails */}
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 340px)', gap: 12, alignItems: 'start' }}>
          <Section title="Production loop" note="program → analyze">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
              {LOOP.map((s) => (
                <div key={s.step} style={workflowCellSt}>
                  <div style={workflowStepSt}>{s.step}</div>
                  <div style={workflowTitleSt}>{s.title}</div>
                  <div style={workflowDescSt}>{s.desc}</div>
                </div>
              ))}
            </div>
          </Section>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Section title="ICPs being targeted" note={`${ICPS.length} segments`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ICPS.map((icp) => (
                  <div key={icp.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px' }}>
                    <span style={{ fontSize: 16, color: FOREST }}>{icp.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: INK, fontWeight: 600 }}>{icp.name}</div>
                      <div style={{ fontSize: 10, color: INK_M }}>{icp.market} · {icp.pillars.join(' · ')}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Guardrails" note="non-negotiable">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Callout tone="brass">Per-channel caption/hashtag/format limits live in Property Settings → Social rules.</Callout>
                <Callout tone="warn">Nothing publishes without human sign-off in the inbox. <strong>Never skip</strong>.</Callout>
                <Callout tone="soft">Every post comes from a program slot: category + channel + weekday. No random brand noise.</Callout>
              </div>
            </Section>
          </div>
        </div>

        {/* Agent fleet */}
        <Section title="Agent fleet" note={`${AGENTS.length} planned social specialists · queue-only`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
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
        </Section>

        <div style={{ gridColumn: '1 / -1', padding: '10px 12px', fontSize: 11, color: INK_M, fontStyle: 'italic', borderTop: `1px solid ${HAIR}` }}>
          Loop: programs → generate plan → accept → inbox sign-off → export/publish.
          Data: <code>marketing.social_calendar · social_posts · social_programs · social_channel_rules</code>.
        </div>
      </DashboardPage>
    </div>
  );
}

// ─── Section wrappers ──────────────────────────────────────────────────────

function Banner({ text }: { text: string }) {
  return (
    <div style={{
      gridColumn: '1 / -1',
      padding: '8px 12px', background: '#FFF4D6', border: `1px solid ${AMBER}`, borderRadius: 4,
      fontSize: 12, fontWeight: 600, color: INK,
    }}>
      {text}
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{title}</div>
        {note && <div style={{ fontSize: 10, color: INK_M, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{note}</div>}
      </div>
      {children}
    </div>
  );
}

// ─── Boost view (Phase-1 sample data) ─────────────────────────────────────

function BoostView() {
  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <Section title="Boost & promote candidates" note="SAMPLE DATA — needs channel analytics APIs">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {BOOST_CANDIDATES.map((b, i) => (
            <div key={i} style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 13, color: INK, fontWeight: 600, fontStyle: 'italic' }}>&quot;{b.hook}&quot;</span>
                  <span style={{ fontSize: 10, color: INK_M }}>{b.platform} · {b.icp}</span>
                </div>
                <span style={verdictPillSt(b.verdict)}>{b.verdict}</span>
              </div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 6 }}>
                <Stat label="Organic reach" value={b.organicReach.toLocaleString('en-US')} />
                <Stat label="Organic eng" value={b.organicEngagement} />
                <Stat label="Budget" value={b.proposedBudget} />
                <Stat label="Proj reach" value={b.projectedReach} />
                <Stat label="Proj CPE" value={b.projectedCpe} />
              </div>
              <div style={{ fontSize: 11, color: INK_S, marginBottom: 6 }}>
                <span style={{ fontSize: 9, color: INK_M, letterSpacing: '0.08em', textTransform: 'uppercase', marginRight: 6 }}>Signal</span>
                <span>{b.signal}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ─── Atoms ─────────────────────────────────────────────────────────────────

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

function verdictPillSt(v: BoostCandidate['verdict']): React.CSSProperties {
  const color = v === 'Strong Boost' ? FOREST : v === 'Moderate Boost' ? '#3E8DBE' : v === 'Test First' ? AMBER : INK_M;
  return {
    fontSize: 9, letterSpacing: '0.10em', textTransform: 'uppercase',
    color, border: `1px solid ${color}`, padding: '1px 5px', borderRadius: 2, whiteSpace: 'nowrap', fontWeight: 600,
  };
}

// ─── Styles ────────────────────────────────────────────────────────────────

const subLinkSt: React.CSSProperties = {
  padding: '6px 12px', fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase',
  color: INK_M, border: `1px solid ${HAIR}`, borderRadius: 3, textDecoration: 'none', background: WHITE, fontWeight: 600,
};
const subLinkActiveSt: React.CSSProperties = { color: WHITE, background: FOREST, borderColor: FOREST };
const workflowCellSt: React.CSSProperties = { background: CREAM, border: `1px solid ${HAIR}`, borderRadius: 4, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 };
const workflowStepSt: React.CSSProperties = { fontSize: 10, color: FOREST, fontWeight: 700, letterSpacing: '0.10em' };
const workflowTitleSt: React.CSSProperties = { fontSize: 12, color: INK, fontWeight: 600 };
const workflowDescSt: React.CSSProperties = { fontSize: 10, color: INK_M, lineHeight: 1.4 };
const agentCardSt: React.CSSProperties = { background: CREAM, border: `1px solid ${HAIR}`, borderRadius: 4, padding: '8px 10px' };
const signalPillSt: React.CSSProperties = { fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: FOREST, border: `1px solid ${FOREST}`, padding: '1px 5px', borderRadius: 2 };
