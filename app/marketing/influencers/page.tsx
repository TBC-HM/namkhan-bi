// app/marketing/influencers/page.tsx
//
// PBS 2026-05-16: AI Influencer / Persona Growth Cockpit. Not a social-media
// scheduler — a portfolio manager for ICP-grounded ambassadors. Phase 1
// (static cockpit + manual data); Phase 2-5 (wizard, calendar, publishing,
// engagement, autopilot) marked "Coming soon" until the social_ai.* schema +
// agent fleet is wired.
//
// Spec source: /Users/paulbauer/Desktop/ai_influencer_persona_cockpit_full_md_package.md.
// Brand language: hotel = hero. Ambassador = lens for one ICP. Reality first,
// AI second. Monthly approval. Hot leads → human.

import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import { getInfluencers } from '@/lib/marketing';
import { MARKETING_SUBPAGES } from '../_subpages';
import TabStrip, { SOCIAL_TABS } from '@/app/finance/_components/TabStrip';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

interface Ambassador {
  name: string;
  role: string;
  icp: string;
  market: string;
  language: string;
  channels: string[];
  story: string;
  pillars: string[];
  performance: number;
  trend: string;
  status: 'Winner' | 'Rising' | 'Volatile' | 'Needs Work';
  nextPost: string;
  reality: number;
}

const AMBASSADORS: Ambassador[] = [
  {
    name: 'Maya',
    role: 'Jungle Wellness Guide',
    icp: 'EU Wellness Women',
    market: 'DACH · UK · NL',
    language: 'DE · EN',
    channels: ['Instagram', 'Pinterest', 'YouTube'],
    story: 'Calm jungle wellness guide. Morning rituals, river silence, herbal teas, spa reset. Speaks to women 35-50 reset-seeking in low season.',
    pillars: ['Morning Rituals', 'Spa Reset', 'Farm Wellness', 'Full Moon Calm', 'Soft Luxury', 'Laos Atmosphere'],
    performance: 81,
    trend: '+18% saves · steady reach · low DMs',
    status: 'Winner',
    nextPost: '2026-05-18 · IG Reel · "5am River Silence"',
    reality: 96,
  },
  {
    name: 'Elias & Noa',
    role: 'Slow River Couple',
    icp: 'Luxury Couples',
    market: 'EU · US · Australia',
    language: 'EN · DE · FR',
    channels: ['Instagram', 'TikTok', 'Pinterest'],
    story: 'Pair travelling slow. Privacy, reconnection, candle-lit suppers, river floats. Speaks to couples seeking quiet luxury and unplugged time.',
    pillars: ['Privacy', 'Romance', 'Candle Dinners', 'River Floats', 'Suite Mornings', 'Sunset Rituals'],
    performance: 67,
    trend: '+11% reach · saves climbing · 0 DMs',
    status: 'Rising',
    nextPost: '2026-05-19 · TikTok · "Found the only restaurant on the river"',
    reality: 92,
  },
  {
    name: 'Sofia',
    role: 'Eco Culinary Explorer',
    icp: 'Conscious Food Travelers',
    market: 'US · EU · Asia',
    language: 'EN · ES · DE',
    channels: ['Instagram', 'YouTube', 'TikTok'],
    story: 'Farm-to-table storyteller. Herbs, eco kitchen, fermentation, local chefs. Pulls food-driven travellers and retreat planners.',
    pillars: ['Herb Garden', 'Fermentation', 'Local Chefs', 'Foraging', 'Eco Kitchen', 'Lao Spice Trail'],
    performance: 78,
    trend: '+24% shares · strong YouTube watch-time · weak clicks',
    status: 'Winner',
    nextPost: '2026-05-17 · YouTube short · "Galangal harvest at dawn"',
    reality: 94,
  },
  {
    name: 'Kai',
    role: 'Mystique Travel Narrator',
    icp: 'Mystique Laos Explorers',
    market: 'US · Australia · Europe',
    language: 'EN',
    channels: ['Instagram', 'TikTok', 'YouTube'],
    story: 'First-person travel narrator. Temples, river, monks, slow walks. Voiceover-driven story posts. Cultural depth without cliché.',
    pillars: ['Temples', 'Monastic Rituals', 'River Stories', 'Slow Walks', 'Lao Heritage', 'Quiet Wonder'],
    performance: 52,
    trend: 'High reach · low save · 0 clicks · fatigue rising',
    status: 'Volatile',
    nextPost: '2026-05-20 · Reel · "Why monks sweep at 4am"',
    reality: 88,
  },
  {
    name: 'Lina',
    role: 'Refined Nature Host',
    icp: 'Premium Asian Travelers',
    market: 'Thailand · Singapore · China',
    language: 'TH · ZH · EN',
    channels: ['Instagram', 'Pinterest', 'Xiaohongshu'],
    story: 'Refined nature host. Tea ceremony, jungle suite mornings, lifestyle imagery for premium APAC travellers seeking trust + visual proof.',
    pillars: ['Tea Ceremony', 'Suite Mornings', 'Visual Proof', 'Lifestyle Detail', 'Asian Hospitality', 'Quiet Nature'],
    performance: 38,
    trend: 'Stuck · low engagement · needs language repositioning',
    status: 'Needs Work',
    nextPost: '— · paused for ICP rework',
    reality: 91,
  },
];

const ICP_PORTFOLIO: { icp: string; market: string; lang: string; trigger: string }[] = [
  { icp: 'EU Wellness Women', market: 'DACH/UK/NL', lang: 'DE·EN', trigger: 'reset · quiet luxury' },
  { icp: 'Luxury Couples', market: 'EU/US/AU', lang: 'EN·DE·FR', trigger: 'privacy · reconnection' },
  { icp: 'Conscious Food Travelers', market: 'US/EU/Asia', lang: 'EN·ES·DE', trigger: 'eco kitchen · herbs' },
  { icp: 'Mystique Laos Explorers', market: 'US/AU/EU', lang: 'EN', trigger: 'culture · spirituality' },
  { icp: 'Premium Asian Travelers', market: 'TH/SG/CN', lang: 'TH·ZH·EN', trigger: 'nature luxury · trust' },
  { icp: 'LGBTQ Luxury Couples', market: 'EU/US/AU', lang: 'EN·DE·ES', trigger: 'safety · refined romance' },
  { icp: 'Active Nature Travelers', market: 'AU/EU/US', lang: 'EN·DE', trigger: 'soft adventure · waterfalls' },
  { icp: 'Slow Luxury 50+', market: 'EU/US', lang: 'EN·DE·FR', trigger: 'calm · service · authenticity' },
  { icp: 'Creative Remote Worker', market: 'EU/US/Asia', lang: 'EN', trigger: 'focus · inspiration' },
  { icp: 'Retreat Organizers', market: 'Global', lang: 'EN', trigger: 'group · wellness infra' },
];

const AGENT_FLEET: { name: string; job: string }[] = [
  { name: 'ICP Research', job: 'Defines + updates target audiences from past guest data' },
  { name: 'Persona Architect', job: 'Creates ambassador concepts, voice, allowed/forbidden topics' },
  { name: 'Brand Reality', job: 'Rejects fake features, visuals, cultural claims' },
  { name: 'Asset Librarian', job: 'Finds real resort assets · flags missing visuals' },
  { name: 'Nanobanana Image Director', job: 'Generates brand-safe visuals · realism score' },
  { name: 'Campaign Strategy', job: 'Proposes monthly campaign concepts per ICP' },
  { name: 'Content Calendar', job: 'Builds 30-day posting plan · balances channels' },
  { name: 'Hashtag & Keyword', job: 'Researches keywords + hashtags per platform' },
  { name: 'Caption', job: 'Writes captions by ICP, language, platform' },
  { name: 'Translation', job: 'Localises captions and scripts' },
  { name: 'Platform Adaptation', job: 'Adapts one idea across IG/TikTok/YT/Pin/FB' },
  { name: 'Publishing', job: 'Schedules and publishes approved content' },
  { name: 'Engagement', job: 'Suggests follows, comments, DMs — never auto-sends' },
  { name: 'Hot Lead Triage', job: 'Scores conversation heat · routes to human' },
  { name: 'Performance Analyst', job: 'Weekly/monthly winners + losers + fatigue' },
  { name: 'Optimization', job: 'Builds next-month improvement plan' },
];

function statusAccent(s: Ambassador['status']): string {
  if (s === 'Winner') return 'var(--moss, #2D6A4F)';
  if (s === 'Rising') return 'var(--brass)';
  if (s === 'Volatile') return 'var(--st-warn, #C28F2C)';
  return 'var(--st-bad, #B23B3B)';
}

export default async function InfluencerCockpitPage() {
  // Phase 1: cockpit shows the static portfolio (per spec). Existing
  // marketing.influencers log stays as the "Operational log" panel at the
  // bottom so paid-influencer history is still surfaced.
  const log = await getInfluencers({ limit: 50 }).catch(() => []);

  const active = AMBASSADORS.length;
  const winners = AMBASSADORS.filter((a) => a.status === 'Winner').length;
  const needsWork = AMBASSADORS.filter((a) => a.status === 'Needs Work').length;
  const avgPerformance = Math.round(AMBASSADORS.reduce((s, a) => s + a.performance, 0) / AMBASSADORS.length);
  const avgReality = Math.round(AMBASSADORS.reduce((s, a) => s + a.reality, 0) / AMBASSADORS.length);

  return (
    <Page
      eyebrow="Marketing · Influencer Cockpit"
      title={<>Ambassador <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>portfolio</em>.</>}
      subPages={MARKETING_SUBPAGES}
    >
      <TabStrip tabs={SOCIAL_TABS} activeKey="influencers" />

      {/* Pitch banner — sets the frame so PBS / staff don't read this as a social-media scheduler */}
      <div style={{
        margin: '8px 0 16px', padding: '14px 18px',
        fontSize: 'var(--t-sm)', color: 'var(--ink-soft)',
        background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)',
        borderLeft: '3px solid var(--brass)', borderRadius: 6,
      }}>
        <strong style={{ color: 'var(--brass)' }}>The hotel is the hero. The ambassador is only the lens.</strong>{' '}
        Each persona is an ICP-grounded digital ambassador with a story, a market, a language, a content pillar set
        and brand-reality guardrails. AI proposes; humans approve monthly; hot conversations escalate to humans.
        This screen is your talent-agency desk — winners scale, weak personas get redesigned or killed.
      </div>

      {/* KPI band */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 14 }}>
        <KpiBox value={active}        unit="count" label="Active ambassadors" tooltip="Personas in the live portfolio · winners + rising + volatile + needs-work." />
        <KpiBox value={winners}       unit="count" label="Winners"            tooltip="Ambassadors with strong save-rate, reach AND conversion signal." />
        <KpiBox value={needsWork}     unit="count" label="Needs work"         tooltip="Below-threshold performers · redesign or kill." />
        <KpiBox value={avgPerformance} unit="count" label="Avg persona score" tooltip="Weighted score · 20% engagement · 20% save/share · 20% clicks · 15% DM quality · 15% booking influence · 10% reality." />
        <KpiBox value={avgReality}    unit="count" label="Avg reality score"  tooltip="Brand-Reality Agent rating · do visuals + claims match the actual resort?" />
      </div>

      {/* Ambassador portfolio cards */}
      <Panel
        title="Ambassador portfolio"
        eyebrow={`${active} active personas · sorted by status`}
        actions={
          <a
            href="#create-influencer"
            style={{
              padding: '6px 14px', background: 'var(--brass)', color: '#fff',
              fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
              letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
              fontWeight: 700, textDecoration: 'none', borderRadius: 4,
            }}
          >+ Create new influencer</a>
        }
      >
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 14, padding: 14,
        }}>
          {AMBASSADORS.map((a) => (
            <div key={a.name} style={{
              padding: 14, background: 'var(--paper)',
              border: '1px solid var(--paper-deep)',
              borderLeft: `3px solid ${statusAccent(a.status)}`,
              borderRadius: 6, display: 'grid', gap: 8,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div>
                  <div style={{ fontSize: 'var(--t-lg)', fontWeight: 600, color: 'var(--ink)' }}>{a.name}</div>
                  <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', fontStyle: 'italic' }}>{a.role}</div>
                </div>
                <span style={{
                  padding: '3px 9px', borderRadius: 12,
                  fontFamily: 'var(--mono)', fontSize: 9,
                  letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', fontWeight: 700,
                  color: '#fff', background: statusAccent(a.status),
                }}>
                  {a.status}
                </span>
              </div>

              <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-soft)', lineHeight: 1.5 }}>{a.story}</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 'var(--t-xs)' }}>
                <Mini label="ICP" value={a.icp} />
                <Mini label="Market" value={a.market} />
                <Mini label="Language" value={a.language} />
                <Mini label="Channels" value={a.channels.join(' · ')} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                <Stat label="Persona score" value={`${a.performance}`} accent={statusAccent(a.status)} />
                <Stat label="Reality" value={`${a.reality}`} accent="var(--brass)" />
                <Stat label="Channels" value={a.channels.length.toString()} accent="var(--ink-mute)" />
              </div>

              <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', fontStyle: 'italic' }}>
                {a.trend}
              </div>

              <div style={{
                padding: '6px 10px', background: 'var(--paper-warm)',
                border: '1px solid var(--paper-deep)', borderRadius: 4,
                fontSize: 'var(--t-xs)', color: 'var(--ink-soft)',
              }}>
                <strong style={{ color: 'var(--brass)' }}>Next post:</strong> {a.nextPost}
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['Calendar', 'Analytics', 'Messages', 'Assets'].map((cta) => (
                  <span key={cta} style={{
                    padding: '4px 10px', fontFamily: 'var(--mono)', fontSize: 10,
                    letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                    color: 'var(--ink-mute)', border: '1px solid var(--paper-deep)',
                    borderRadius: 12,
                  }}>
                    {cta}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* ICP portfolio + agent fleet side-by-side */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 14, marginTop: 14 }}>
        <Panel title="ICP portfolio" eyebrow={`${ICP_PORTFOLIO.length} segments active · drive every persona`}>
          <div style={{ padding: 14, display: 'grid', gap: 6 }}>
            {ICP_PORTFOLIO.map((icp, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1.6fr 1fr 0.8fr 1.4fr',
                gap: 10, padding: '6px 10px',
                background: i % 2 === 0 ? 'var(--paper)' : 'var(--paper-warm)',
                border: '1px solid var(--paper-deep)', borderRadius: 4,
                fontSize: 'var(--t-xs)',
              }}>
                <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{icp.icp}</span>
                <span style={{ color: 'var(--ink-soft)' }}>{icp.market}</span>
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink-mute)' }}>{icp.lang}</span>
                <span style={{ color: 'var(--ink-soft)', fontStyle: 'italic' }}>{icp.trigger}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Agent fleet" eyebrow={`${AGENT_FLEET.length} micro-agents · not one giant marketing brain`}>
          <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {AGENT_FLEET.map((a) => (
              <div key={a.name} style={{
                padding: '6px 10px',
                background: 'var(--paper)',
                border: '1px solid var(--paper-deep)',
                borderLeft: '2px solid var(--brass)',
                borderRadius: 4, fontSize: 'var(--t-xs)',
              }}>
                <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{a.name}</div>
                <div style={{ marginTop: 2, color: 'var(--ink-mute)', fontStyle: 'italic', fontSize: 10 }}>{a.job}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Hot Inbox + Asset Pool + Reality Control */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14, marginTop: 14 }}>
        <Panel title="Hot inbox" eyebrow="DMs · comments · partner leads · creator opportunities">
          <ComingSoonBlock
            icon="✉"
            hint="When the Engagement + Hot Lead Triage agents are live, every DM, comment and creator reply lands here scored Cold/Warm/Hot/Critical. Hot + Critical require human review. AI drafts replies but never auto-sends."
          />
        </Panel>
        <Panel title="Asset pool" eyebrow="Real resort assets + AI-generated · realism-scored">
          <ComingSoonBlock
            icon="◇"
            hint="Brand Reality + Asset Librarian + Nanobanana Image Director work together here. Real resort photos at the top. AI-generated assets only after realism score ≥ 80. No fake pools, villas, ceremonies, or AI fantasy resort scenes."
          />
        </Panel>
        <Panel title="Reality control" eyebrow="Brand + realism guardrails · monthly approval">
          <div style={{ padding: 14, fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}>
            <p style={{ marginTop: 0 }}>
              Hard rules (Brand Reality Agent enforces):
            </p>
            <ul style={{ margin: '0 0 10px', paddingLeft: 20, fontSize: 'var(--t-xs)', color: 'var(--ink-soft)' }}>
              <li>No fake pools / villas / ceremonies</li>
              <li>No fake Lao cultural claims</li>
              <li>No oversexualised visuals</li>
              <li>No AI fantasy resort scenes</li>
              <li>Monthly human approval mandatory</li>
              <li>Hot conversations always escalate</li>
            </ul>
            <div style={{
              padding: '6px 10px', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
              letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
              color: 'var(--moss, #2D6A4F)', background: 'rgba(45,106,79,0.08)',
              border: '1px solid rgba(45,106,79,0.25)', borderRadius: 4, fontWeight: 700,
              display: 'inline-block',
            }}>
              Reality {avgReality}/100 · clean
            </div>
          </div>
        </Panel>
      </div>

      {/* Reporting hub */}
      <Panel title="Reporting hub" eyebrow="Last 7d · Last month · YTD · per-persona drilldown">
        <div style={{ padding: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
            {['Engagement', 'Save rate', 'Share rate', 'Website clicks', 'DM quality', 'Booking influence'].map((k) => (
              <div key={k} style={{
                padding: '8px 10px', background: 'var(--paper-warm)',
                border: '1px solid var(--paper-deep)', borderLeft: '2px solid var(--brass)',
                borderRadius: 4,
              }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>{k}</div>
                <div style={{ marginTop: 4, fontSize: 'var(--t-md)', fontWeight: 600, color: 'var(--ink-mute)' }}>—</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', fontStyle: 'italic' }}>
            Performance Analyst Agent will surface winners, losers, content fatigue and next-month adjustments here
            once <code>social_ai.performance_metrics</code> is wired (Phase 3).
          </div>
        </div>
      </Panel>

      {/* Create-New wizard preview */}
      <div id="create-influencer" />
      <Panel
        title="Create new influencer · 15-step workflow"
        eyebrow="Start: hotel · ICP · market · language · channels · purpose · persona type"
      >
        <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, fontSize: 'var(--t-xs)' }}>
          {[
            ['1', 'Start creation', 'Hotel + ICP + market + language + channel + persona type + purpose'],
            ['2', 'ICP validation', 'ICP Research Agent scores strength + audience motivation'],
            ['3', 'Persona concepts × 3-5', 'Persona Architect Agent proposes named candidates'],
            ['4', 'Profile setup', 'Bio · story · pillars · allowed/forbidden topics · CTA rules'],
            ['5', 'Visual identity', 'Nanobanana proposes portraits + mood from real resort refs'],
            ['6', 'Account setup', 'Brand-internal series OR separate @persona handle + email alias'],
            ['7', 'Content pillars', '5-7 pillars · ritual themes · seasonal cadence'],
            ['8', '30-day calendar', 'Content Calendar Agent · post every 2-3 days · platform-balanced'],
            ['9', 'Asset matching', 'Real resort photos · missing list · AI-generation tasks'],
            ['10', 'Hashtag + keyword research', 'Per platform · per language · no spam tags'],
            ['11', 'Multi-platform adapt', 'One idea → Reel + TikTok + Pin + FB + Short'],
            ['12', 'Human approval', 'Monthly package · approve all / per campaign / per post'],
            ['13', 'Publishing', 'Scheduled by Publishing Agent after approval'],
            ['14', 'Engagement + DMs', 'Engagement Agent monitors · heat-score · hot → human'],
            ['15', 'Reporting + optimisation', 'Performance Analyst → next-month plan'],
          ].map(([n, t, hint]) => (
            <div key={n} style={{
              padding: '8px 10px', background: 'var(--paper)',
              border: '1px solid var(--paper-deep)', borderRadius: 4,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 10,
                  letterSpacing: 'var(--ls-extra)', color: 'var(--brass)', fontWeight: 700,
                }}>{n}</span>
                <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{t}</span>
              </div>
              <div style={{ marginTop: 3, color: 'var(--ink-mute)', fontStyle: 'italic', fontSize: 10 }}>{hint}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '0 14px 14px' }}>
          <span style={{
            display: 'inline-block', padding: '4px 12px',
            fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
            letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
            color: 'var(--st-warn, #C28F2C)', background: 'rgba(194,143,44,0.12)',
            border: '1px solid rgba(194,143,44,0.35)', borderRadius: 4, fontWeight: 700,
          }}>
            Wizard · coming soon
          </span>
          <span style={{ marginLeft: 12, fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', fontStyle: 'italic' }}>
            Wires when `social_ai.*` schema lands. Spec in `dms.documents` under doc_subtype `marketing_influencer_cockpit_spec`.
          </span>
        </div>
      </Panel>

      {/* Existing operational influencer log (preserves old page) */}
      <Panel
        title={`Operational log · ${log.length} engagements`}
        eyebrow="marketing.influencers · paid + comp deals on the books"
      >
        {log.length === 0 ? (
          <div style={{ padding: 18, color: 'var(--ink-mute)', fontStyle: 'italic', fontSize: 'var(--t-sm)' }}>
            No paid/comp influencer engagements logged yet. Add via Supabase → <code>marketing.influencers</code>.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl" style={{ width: '100%', fontSize: 'var(--t-sm)' }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Handle</th>
                  <th>Platform</th>
                  <th className="num">Reach</th>
                  <th>Stay</th>
                  <th className="num">Comp</th>
                  <th className="num">Paid</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(log as Array<Record<string, unknown>>).map((i, idx) => (
                  <tr key={idx}>
                    <td className="lbl"><strong>{String(i.name ?? '—')}</strong></td>
                    <td className="lbl text-mute">{String(i.handle ?? '—')}</td>
                    <td className="lbl text-mute">{String(i.primary_platform ?? '—')}</td>
                    <td className="num">{(Number(i.reach ?? 0)).toLocaleString('en-US')}</td>
                    <td className="lbl text-mute">{String(i.stay_from ?? '—')}</td>
                    <td className="num">{`$${Math.round(Number(i.comp_value_usd ?? 0)).toLocaleString('en-US')}`}</td>
                    <td className="num">{`$${Math.round(Number(i.paid_fee_usd ?? 0)).toLocaleString('en-US')}`}</td>
                    <td>
                      <span className={`pill ${i.delivered ? 'good' : 'warn'}`}>
                        {i.delivered ? 'Delivered' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div style={{ marginTop: 18, padding: '12px 14px', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', fontStyle: 'italic', textAlign: 'center' }}>
        Source spec: <code>ai_influencer_persona_cockpit_full_md_package</code> (locked 2026-05-16) · Phase 1 cockpit
        only · Phases 2–5 (wizard / publishing / engagement / autopilot) require <code>social_ai.*</code> schema +
        16-agent fleet to come online.
      </div>
    </Page>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: '4px 8px', background: 'var(--paper-warm)',
      border: '1px solid var(--paper-deep)', borderRadius: 4,
    }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>{label}</div>
      <div style={{ marginTop: 2, fontWeight: 600, color: 'var(--ink)', fontSize: 11 }}>{value}</div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{
      padding: '4px 8px', textAlign: 'center',
      background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)',
      borderRadius: 4,
    }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>{label}</div>
      <div style={{ marginTop: 2, fontWeight: 700, fontSize: 14, color: accent, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

function ComingSoonBlock({ icon, hint }: { icon: string; hint: string }) {
  return (
    <div style={{ padding: 14 }}>
      <div style={{ fontSize: 28, color: 'var(--brass)', opacity: 0.55, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-soft)', lineHeight: 1.5, marginBottom: 12 }}>
        {hint}
      </div>
      <div style={{
        display: 'inline-block', padding: '4px 10px',
        fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
        letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
        color: 'var(--st-warn, #C28F2C)', background: 'rgba(194,143,44,0.12)',
        border: '1px solid rgba(194,143,44,0.35)', borderRadius: 4, fontWeight: 700,
      }}>
        Coming soon
      </div>
    </div>
  );
}
