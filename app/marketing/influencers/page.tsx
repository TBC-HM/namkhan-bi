// app/marketing/influencers/page.tsx
// PBS 2026-07-05: migrated to paper-white DashboardPage. All data preserved:
// 5 ambassadors · 10 ICP portfolio · 16 agents · 15-step wizard · Hot inbox +
// Asset pool + Reality control · Reporting hub · Operational log.
import type { CSSProperties } from 'react';
import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { getInfluencers } from '@/lib/marketing';
import { MARKETING_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A'; const INK_F='#8A8A8A';
const GREEN='#084838'; const MOSS='#2D6A4F'; const CREAM='#F7F0E1'; const AMBER='#C28F2C'; const RED='#B03826';

interface Ambassador { name: string; role: string; icp: string; market: string; language: string; channels: string[]; story: string; pillars: string[]; performance: number; trend: string; status: 'Winner'|'Rising'|'Volatile'|'Needs Work'; nextPost: string; reality: number; }

const AMBASSADORS: Ambassador[] = [
  { name: 'Maya',        role: 'Jungle Wellness Guide',   icp: 'EU Wellness Women',       market: 'DACH · UK · NL',        language: 'DE · EN',       channels: ['Instagram','Pinterest','YouTube'],       story: 'Calm jungle wellness guide. Morning rituals, river silence, herbal teas, spa reset. Speaks to women 35-50 reset-seeking in low season.', pillars: ['Morning Rituals','Spa Reset','Farm Wellness','Full Moon Calm','Soft Luxury','Laos Atmosphere'], performance: 81, trend: '+18% saves · steady reach · low DMs',                                  status: 'Winner',     nextPost: '2026-05-18 · IG Reel · "5am River Silence"',        reality: 96 },
  { name: 'Elias & Noa', role: 'Slow River Couple',       icp: 'Luxury Couples',          market: 'EU · US · Australia',    language: 'EN · DE · FR',  channels: ['Instagram','TikTok','Pinterest'],         story: 'Pair travelling slow. Privacy, reconnection, candle-lit suppers, river floats. Speaks to couples seeking quiet luxury and unplugged time.', pillars: ['Privacy','Romance','Candle Dinners','River Floats','Suite Mornings','Sunset Rituals'], performance: 67, trend: '+11% reach · saves climbing · 0 DMs',                                   status: 'Rising',     nextPost: '2026-05-19 · TikTok · "Found the only restaurant on the river"', reality: 92 },
  { name: 'Sofia',       role: 'Eco Culinary Explorer',   icp: 'Conscious Food Travelers',market: 'US · EU · Asia',         language: 'EN · ES · DE',  channels: ['Instagram','YouTube','TikTok'],           story: 'Farm-to-table storyteller. Herbs, eco kitchen, fermentation, local chefs. Pulls food-driven travellers and retreat planners.',              pillars: ['Herb Garden','Fermentation','Local Chefs','Foraging','Eco Kitchen','Lao Spice Trail'], performance: 78, trend: '+24% shares · strong YouTube watch-time · weak clicks',                status: 'Winner',     nextPost: '2026-05-17 · YouTube short · "Galangal harvest at dawn"',        reality: 94 },
  { name: 'Kai',         role: 'Mystique Travel Narrator',icp: 'Mystique Laos Explorers', market: 'US · Australia · Europe',language: 'EN',            channels: ['Instagram','TikTok','YouTube'],           story: 'First-person travel narrator. Temples, river, monks, slow walks. Voiceover-driven story posts. Cultural depth without cliché.',            pillars: ['Temples','Monastic Rituals','River Stories','Slow Walks','Lao Heritage','Quiet Wonder'], performance: 52, trend: 'High reach · low save · 0 clicks · fatigue rising',                     status: 'Volatile',   nextPost: '2026-05-20 · Reel · "Why monks sweep at 4am"',                     reality: 88 },
  { name: 'Lina',        role: 'Refined Nature Host',     icp: 'Premium Asian Travelers', market: 'Thailand · Singapore · China', language: 'TH · ZH · EN', channels: ['Instagram','Pinterest','Xiaohongshu'], story: 'Refined nature host. Tea ceremony, jungle suite mornings, lifestyle imagery for premium APAC travellers seeking trust + visual proof.',  pillars: ['Tea Ceremony','Suite Mornings','Visual Proof','Lifestyle Detail','Asian Hospitality','Quiet Nature'], performance: 38, trend: 'Stuck · low engagement · needs language repositioning',              status: 'Needs Work', nextPost: '— · paused for ICP rework',                                         reality: 91 },
];

const ICP_PORTFOLIO: { icp: string; market: string; lang: string; trigger: string }[] = [
  { icp: 'EU Wellness Women',        market: 'DACH/UK/NL',  lang: 'DE·EN',     trigger: 'reset · quiet luxury'         },
  { icp: 'Luxury Couples',           market: 'EU/US/AU',    lang: 'EN·DE·FR',  trigger: 'privacy · reconnection'       },
  { icp: 'Conscious Food Travelers', market: 'US/EU/Asia',  lang: 'EN·ES·DE',  trigger: 'eco kitchen · herbs'          },
  { icp: 'Mystique Laos Explorers',  market: 'US/AU/EU',    lang: 'EN',        trigger: 'culture · spirituality'       },
  { icp: 'Premium Asian Travelers',  market: 'TH/SG/CN',    lang: 'TH·ZH·EN',  trigger: 'nature luxury · trust'        },
  { icp: 'LGBTQ Luxury Couples',     market: 'EU/US/AU',    lang: 'EN·DE·ES',  trigger: 'safety · refined romance'     },
  { icp: 'Active Nature Travelers',  market: 'AU/EU/US',    lang: 'EN·DE',     trigger: 'soft adventure · waterfalls'  },
  { icp: 'Slow Luxury 50+',          market: 'EU/US',       lang: 'EN·DE·FR',  trigger: 'calm · service · authenticity'},
  { icp: 'Creative Remote Worker',   market: 'EU/US/Asia',  lang: 'EN',        trigger: 'focus · inspiration'          },
  { icp: 'Retreat Organizers',       market: 'Global',      lang: 'EN',        trigger: 'group · wellness infra'       },
];

const AGENT_FLEET: { name: string; job: string }[] = [
  { name: 'ICP Research',              job: 'Defines + updates target audiences from past guest data' },
  { name: 'Persona Architect',         job: 'Creates ambassador concepts, voice, allowed/forbidden topics' },
  { name: 'Brand Reality',             job: 'Rejects fake features, visuals, cultural claims' },
  { name: 'Asset Librarian',           job: 'Finds real resort assets · flags missing visuals' },
  { name: 'Nanobanana Image Director', job: 'Generates brand-safe visuals · realism score' },
  { name: 'Campaign Strategy',         job: 'Proposes monthly campaign concepts per ICP' },
  { name: 'Content Calendar',          job: 'Builds 30-day posting plan · balances channels' },
  { name: 'Hashtag & Keyword',         job: 'Researches keywords + hashtags per platform' },
  { name: 'Caption',                   job: 'Writes captions by ICP, language, platform' },
  { name: 'Translation',               job: 'Localises captions and scripts' },
  { name: 'Platform Adaptation',       job: 'Adapts one idea across IG/TikTok/YT/Pin/FB' },
  { name: 'Publishing',                job: 'Schedules and publishes approved content' },
  { name: 'Engagement',                job: 'Suggests follows, comments, DMs — never auto-sends' },
  { name: 'Hot Lead Triage',           job: 'Scores conversation heat · routes to human' },
  { name: 'Performance Analyst',       job: 'Weekly/monthly winners + losers + fatigue' },
  { name: 'Optimization',              job: 'Builds next-month improvement plan' },
];

const WIZARD: [string, string, string][] = [
  ['1',  'Start creation',                'Hotel + ICP + market + language + channel + persona type + purpose'],
  ['2',  'ICP validation',                'ICP Research Agent scores strength + audience motivation'],
  ['3',  'Persona concepts × 3-5',        'Persona Architect Agent proposes named candidates'],
  ['4',  'Profile setup',                 'Bio · story · pillars · allowed/forbidden topics · CTA rules'],
  ['5',  'Visual identity',               'Nanobanana proposes portraits + mood from real resort refs'],
  ['6',  'Account setup',                 'Brand-internal series OR separate @persona handle + email alias'],
  ['7',  'Content pillars',               '5-7 pillars · ritual themes · seasonal cadence'],
  ['8',  '30-day calendar',               'Content Calendar Agent · post every 2-3 days · platform-balanced'],
  ['9',  'Asset matching',                'Real resort photos · missing list · AI-generation tasks'],
  ['10', 'Hashtag + keyword research',    'Per platform · per language · no spam tags'],
  ['11', 'Multi-platform adapt',          'One idea → Reel + TikTok + Pin + FB + Short'],
  ['12', 'Human approval',                'Monthly package · approve all / per campaign / per post'],
  ['13', 'Publishing',                    'Scheduled by Publishing Agent after approval'],
  ['14', 'Engagement + DMs',              'Engagement Agent monitors · heat-score · hot → human'],
  ['15', 'Reporting + optimisation',      'Performance Analyst → next-month plan'],
];

function statusAccent(s: Ambassador['status']): string {
  return s === 'Winner' ? MOSS : s === 'Rising' ? GREEN : s === 'Volatile' ? AMBER : RED;
}

export default async function InfluencerCockpitPage() {
  const log = await getInfluencers({ limit: 50 }).catch(() => []);

  const active = AMBASSADORS.length;
  const winners = AMBASSADORS.filter(a => a.status === 'Winner').length;
  const needsWork = AMBASSADORS.filter(a => a.status === 'Needs Work').length;
  const avgPerformance = Math.round(AMBASSADORS.reduce((s, a) => s + a.performance, 0) / active);
  const avgReality = Math.round(AMBASSADORS.reduce((s, a) => s + a.reality, 0) / active);

  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map(s => ({ key: s.href, label: s.label, href: s.href, active: s.href === '/marketing/influencers' }));
  const tiles: KpiTileProps[] = [
    { label: 'Active ambassadors', value: active, size: 'sm' },
    { label: 'Winners', value: winners, size: 'sm', status: winners > 0 ? 'green' : undefined },
    { label: 'Needs work', value: needsWork, size: 'sm', status: needsWork > 0 ? 'red' : undefined },
    { label: 'Avg persona score', value: avgPerformance, size: 'sm' },
    { label: 'Avg reality score', value: avgReality, size: 'sm', footnote: 'brand-reality agent' },
  ];

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage title="Marketing · Influencer cockpit" subtitle="Ambassador portfolio — ICP-grounded personas, not a social scheduler" tabs={tabs}>
        <div style={{ gridColumn:'1 / -1', padding:'12px 16px', background:CREAM, border:'1px solid '+HAIR, borderLeft:'3px solid '+GREEN, borderRadius:6, fontSize:12, color:INK, lineHeight:1.6 }}>
          <strong style={{ color:GREEN }}>The hotel is the hero. The ambassador is only the lens.</strong>{' '}
          Each persona is ICP-grounded with a story, market, language, content pillar set and brand-reality guardrails. AI proposes; humans approve monthly; hot conversations escalate.
        </div>

        <div style={{ gridColumn:'1 / -1', padding:'10px 14px', background:'#FFF4D6', border:'1px solid '+AMBER, borderRadius:4, fontSize:12, color:INK }}>
          <strong>HARDCODED DATA · Phase 1 cockpit.</strong> Wizard + publishing + engagement require <code>social_ai.*</code> schema + 16-agent fleet. Spec locked in <code>dms.documents</code>.
        </div>

        <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(170px, 1fr))', gap:8 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>

        {/* Ambassador portfolio */}
        <div style={{ gridColumn:'1 / -1' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8 }}>
            <div style={{ fontSize:13, fontWeight:600, color:INK }}>Ambassador portfolio · {active} personas · sorted by status</div>
            <a href="#create-influencer" style={{ padding:'5px 12px', background:GREEN, color:'#FFFFFF', fontSize:11, fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase', textDecoration:'none', borderRadius:4 }}>+ Create new influencer</a>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(340px, 1fr))', gap:12 }}>
            {AMBASSADORS.map(a => (
              <div key={a.name} style={{ padding:14, background:'#FFFFFF', border:'1px solid '+HAIR, borderLeft:`3px solid ${statusAccent(a.status)}`, borderRadius:6, display:'grid', gap:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                  <div>
                    <div style={{ fontSize:15, fontWeight:600, color:INK }}>{a.name}</div>
                    <div style={{ fontSize:11, color:INK_M, fontStyle:'italic' }}>{a.role}</div>
                  </div>
                  <span style={{ padding:'3px 9px', borderRadius:12, fontFamily:'ui-monospace, monospace', fontSize:9, letterSpacing:'0.08em', textTransform:'uppercase', fontWeight:700, color:'#FFFFFF', background: statusAccent(a.status) }}>{a.status}</span>
                </div>
                <div style={{ fontSize:12, color:INK, lineHeight:1.5 }}>{a.story}</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, fontSize:11 }}>
                  <Mini label="ICP" value={a.icp} />
                  <Mini label="Market" value={a.market} />
                  <Mini label="Language" value={a.language} />
                  <Mini label="Channels" value={a.channels.join(' · ')} />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:6 }}>
                  <Stat label="Persona score" value={String(a.performance)} accent={statusAccent(a.status)} />
                  <Stat label="Reality"       value={String(a.reality)}     accent={GREEN} />
                  <Stat label="Channels"      value={String(a.channels.length)} accent={INK_M} />
                </div>
                <div style={{ fontSize:11, color:INK_M, fontStyle:'italic' }}>{a.trend}</div>
                <div style={{ padding:'6px 10px', background:CREAM, border:'1px solid '+HAIR, borderRadius:4, fontSize:11, color:INK }}>
                  <strong style={{ color:GREEN }}>Next post:</strong> {a.nextPost}
                </div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {['Calendar','Analytics','Messages','Assets'].map(cta => (
                    <span key={cta} style={{ padding:'3px 8px', fontFamily:'ui-monospace, monospace', fontSize:9, letterSpacing:'0.08em', textTransform:'uppercase', color:INK_M, border:'1px solid '+HAIR, borderRadius:12 }}>{cta}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ICP portfolio + agent fleet */}
        <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(380px, 1fr))', gap:12 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:INK, marginBottom:6 }}>ICP portfolio · {ICP_PORTFOLIO.length} segments</div>
            <div style={{ display:'grid', gap:6 }}>
              {ICP_PORTFOLIO.map((icp, i) => (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'1.6fr 1fr 0.8fr 1.4fr', gap:10, padding:'6px 10px', background: i % 2 === 0 ? '#FFFFFF' : '#FAFAF7', border:'1px solid '+HAIR, borderRadius:4, fontSize:11 }}>
                  <span style={{ fontWeight:600, color:INK }}>{icp.icp}</span>
                  <span style={{ color:INK_M }}>{icp.market}</span>
                  <span style={{ fontFamily:'ui-monospace, monospace', color:INK_F }}>{icp.lang}</span>
                  <span style={{ color:INK_M, fontStyle:'italic' }}>{icp.trigger}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:INK, marginBottom:6 }}>Agent fleet · {AGENT_FLEET.length} micro-agents</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              {AGENT_FLEET.map(a => (
                <div key={a.name} style={{ padding:'6px 10px', background:'#FFFFFF', border:'1px solid '+HAIR, borderLeft:'2px solid '+GREEN, borderRadius:4, fontSize:11 }}>
                  <div style={{ fontWeight:600, color:INK }}>{a.name}</div>
                  <div style={{ marginTop:2, color:INK_M, fontStyle:'italic', fontSize:10 }}>{a.job}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Hot inbox + asset pool + reality control */}
        <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(340px, 1fr))', gap:12 }}>
          <ComingSoonPanel title="Hot inbox" hint="When Engagement + Hot Lead Triage agents are live, every DM/comment/reply lands here scored Cold/Warm/Hot/Critical. Hot + Critical require human review. AI drafts replies but never auto-sends." />
          <ComingSoonPanel title="Asset pool" hint="Brand Reality + Asset Librarian + Nanobanana Image Director work together here. Real resort photos at top. AI-generated assets only after realism score ≥ 80. No fake pools/villas/ceremonies." />
          <div style={{ border:'1px solid '+HAIR, borderRadius:6, padding:14 }}>
            <div style={{ fontSize:13, fontWeight:600, color:INK, marginBottom:8 }}>Reality control · monthly approval</div>
            <ul style={{ margin:'0 0 10px', paddingLeft:20, fontSize:11, color:INK_M }}>
              <li>No fake pools / villas / ceremonies</li>
              <li>No fake Lao cultural claims</li>
              <li>No oversexualised visuals</li>
              <li>No AI fantasy resort scenes</li>
              <li>Monthly human approval mandatory</li>
              <li>Hot conversations always escalate</li>
            </ul>
            <div style={{ display:'inline-block', padding:'4px 10px', fontFamily:'ui-monospace, monospace', fontSize:10, letterSpacing:'0.10em', textTransform:'uppercase', color:MOSS, background:'#E7F0EA', border:'1px solid '+MOSS, borderRadius:4, fontWeight:700 }}>
              Reality {avgReality}/100 · clean
            </div>
          </div>
        </div>

        {/* Reporting hub */}
        <div style={{ gridColumn:'1 / -1' }}>
          <div style={{ fontSize:13, fontWeight:600, color:INK, marginBottom:8 }}>Reporting hub · last 7d · last month · YTD · per-persona drilldown</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:8, marginBottom:8 }}>
            {['Engagement','Save rate','Share rate','Website clicks','DM quality','Booking influence'].map(k => (
              <div key={k} style={{ padding:'8px 10px', background:CREAM, border:'1px solid '+HAIR, borderLeft:'2px solid '+GREEN, borderRadius:4 }}>
                <div style={{ fontFamily:'ui-monospace, monospace', fontSize:10, letterSpacing:'0.10em', textTransform:'uppercase', color:INK_M }}>{k}</div>
                <div style={{ marginTop:4, fontSize:13, fontWeight:600, color:INK_M }}>—</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize:11, color:INK_M, fontStyle:'italic' }}>
            Performance Analyst Agent will surface winners, losers, content fatigue and next-month adjustments once <code>social_ai.performance_metrics</code> is wired (Phase 3).
          </div>
        </div>

        {/* 15-step wizard */}
        <div style={{ gridColumn:'1 / -1' }} id="create-influencer">
          <div style={{ fontSize:13, fontWeight:600, color:INK, marginBottom:8 }}>Create new influencer · 15-step workflow</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:8, fontSize:11 }}>
            {WIZARD.map(([n, t, hint]) => (
              <div key={n} style={{ padding:'8px 10px', background:'#FFFFFF', border:'1px solid '+HAIR, borderRadius:4 }}>
                <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                  <span style={{ fontFamily:'ui-monospace, monospace', fontSize:10, letterSpacing:'0.14em', color:GREEN, fontWeight:700 }}>{n}</span>
                  <span style={{ fontWeight:600, color:INK }}>{t}</span>
                </div>
                <div style={{ marginTop:3, color:INK_M, fontStyle:'italic', fontSize:10 }}>{hint}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:10 }}>
            <span style={{ display:'inline-block', padding:'4px 12px', fontFamily:'ui-monospace, monospace', fontSize:10, letterSpacing:'0.10em', textTransform:'uppercase', color:AMBER, background:'#FFF4D6', border:'1px solid '+AMBER, borderRadius:4, fontWeight:700 }}>Wizard · coming soon</span>
            <span style={{ marginLeft:12, fontSize:11, color:INK_M, fontStyle:'italic' }}>
              Wires when <code>social_ai.*</code> schema lands. Spec in <code>dms.documents</code> under doc_subtype <code>marketing_influencer_cockpit_spec</code>.
            </span>
          </div>
        </div>

        {/* Operational log */}
        <div style={{ gridColumn:'1 / -1' }}>
          <div style={{ fontSize:13, fontWeight:600, color:INK, marginBottom:8 }}>Operational log · {log.length} engagements · marketing.influencers</div>
          {log.length === 0 ? (
            <div style={{ padding:18, color:INK_M, fontStyle:'italic', fontSize:12, border:'1px solid '+HAIR, borderRadius:6, background:'#FFFFFF' }}>
              No paid/comp influencer engagements logged yet. Add via Supabase → <code>marketing.influencers</code>.
            </div>
          ) : (
            <div style={{ border:'1px solid '+HAIR, borderRadius:6, background:'#FFFFFF', overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:'#FAFAF7', borderBottom:'1px solid '+HAIR }}>
                    <th style={th}>Name</th>
                    <th style={th}>Handle</th>
                    <th style={th}>Platform</th>
                    <th style={{ ...th, textAlign:'right' }}>Reach</th>
                    <th style={th}>Stay</th>
                    <th style={{ ...th, textAlign:'right' }}>Comp</th>
                    <th style={{ ...th, textAlign:'right' }}>Paid</th>
                    <th style={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(log as Array<Record<string, unknown>>).map((i, idx) => (
                    <tr key={idx} style={{ borderTop:'1px solid '+HAIR }}>
                      <td style={tdL}><strong>{String(i.name ?? '—')}</strong></td>
                      <td style={{ ...tdL, color:INK_M }}>{String(i.handle ?? '—')}</td>
                      <td style={{ ...tdL, color:INK_M }}>{String(i.primary_platform ?? '—')}</td>
                      <td style={tdR}>{Number(i.reach ?? 0).toLocaleString('en-US')}</td>
                      <td style={{ ...tdL, color:INK_M }}>{String(i.stay_from ?? '—')}</td>
                      <td style={tdR}>${Math.round(Number(i.comp_value_usd ?? 0)).toLocaleString('en-US')}</td>
                      <td style={tdR}>${Math.round(Number(i.paid_fee_usd ?? 0)).toLocaleString('en-US')}</td>
                      <td style={tdL}>
                        <span style={{ padding:'2px 8px', fontSize:10, fontWeight:600, background: i.delivered ? '#E7F0EA' : '#FFF4D6', color: i.delivered ? MOSS : AMBER, border:'1px solid '+(i.delivered ? MOSS : AMBER), borderRadius:3 }}>
                          {i.delivered ? 'Delivered' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ gridColumn:'1 / -1', marginTop:14, padding:'10px 14px', fontSize:11, color:INK_M, fontStyle:'italic', borderTop:'1px solid '+HAIR }}>
          Source spec: <code>ai_influencer_persona_cockpit_full_md_package</code> (locked 2026-05-16) · Phase 1 cockpit only · Phases 2–5 require <code>social_ai.*</code> schema + 16-agent fleet.
        </div>
      </DashboardPage>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding:'4px 8px', background:CREAM, border:'1px solid '+HAIR, borderRadius:4 }}>
      <div style={{ fontFamily:'ui-monospace, monospace', fontSize:9, letterSpacing:'0.10em', textTransform:'uppercase', color:INK_M }}>{label}</div>
      <div style={{ marginTop:2, fontWeight:600, color:INK, fontSize:11 }}>{value}</div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ padding:'4px 8px', textAlign:'center', background:CREAM, border:'1px solid '+HAIR, borderRadius:4 }}>
      <div style={{ fontFamily:'ui-monospace, monospace', fontSize:9, letterSpacing:'0.10em', textTransform:'uppercase', color:INK_M }}>{label}</div>
      <div style={{ marginTop:2, fontWeight:700, fontSize:13, color:accent, fontVariantNumeric:'tabular-nums' }}>{value}</div>
    </div>
  );
}

function ComingSoonPanel({ title, hint }: { title: string; hint: string }) {
  return (
    <div style={{ border:'1px solid '+HAIR, borderRadius:6, padding:14 }}>
      <div style={{ fontSize:13, fontWeight:600, color:INK, marginBottom:8 }}>{title}</div>
      <div style={{ fontSize:12, color:INK_M, lineHeight:1.5, marginBottom:12 }}>{hint}</div>
      <div style={{ display:'inline-block', padding:'4px 10px', fontFamily:'ui-monospace, monospace', fontSize:10, letterSpacing:'0.10em', textTransform:'uppercase', color:AMBER, background:'#FFF4D6', border:'1px solid '+AMBER, borderRadius:4, fontWeight:700 }}>Coming soon</div>
    </div>
  );
}

const th: CSSProperties = { padding:'8px 10px', fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:INK, textAlign:'left' };
const tdL: CSSProperties = { padding:'8px 10px', fontSize:12, color:INK };
const tdR: CSSProperties = { padding:'8px 10px', fontSize:12, color:INK, textAlign:'right', fontVariantNumeric:'tabular-nums' };
