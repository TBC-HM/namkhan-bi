// app/marketing/library/_components/LibraryCockpit.tsx
//
// PBS 2026-05-16: AI Creation Cockpit overlay on /marketing/library.
// Replaces the "dead gallery" framing with a creation + curation + gap
// radar surface. Existing AssetGrid + filter rail remain underneath as
// the actual library browser.
//
// Sections (switched via ?view=):
//   studio    · AI Creation Studio — prompt → reel/photo/carousel
//   coverage  · Coverage Gap Radar — ICP × channel × pillar matrix
//   briefs    · Reshoot Brief Queue — what Marketing needs shot
//   pipeline  · Auto-tagger + Reality output (post-upload pipeline)
//
// Phase 2 wires marketing.media_ai_jobs + marketing.shot_briefs + the
// 8 specialist agents through cap_skills.

import type { ReactNode } from 'react';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';

type View = 'studio' | 'coverage' | 'briefs' | 'pipeline';

interface Props {
  view: View;
  liveCounts: { totalReady: number; ota: number; hero: number; social: number; archive: number };
}

// ─── ICPs / channels / pillars ─────────────────────────────────────────────

const ICPS = [
  { name: 'EU Wellness Women',  emoji: '✦' },
  { name: 'Luxury Couples',     emoji: '◆' },
  { name: 'Conscious Food',     emoji: '◉' },
  { name: 'Mystique Explorers', emoji: '◐' },
  { name: 'Digital Detox EU',   emoji: '◇' },
  { name: 'Asia Source Mkt',    emoji: '✺' },
  { name: 'Yoga Teachers B2B',  emoji: '✿' },
] as const;

const CHANNELS = ['OTA', 'Website hero', 'IG Reel', 'IG Photo', 'Pinterest', 'TikTok', 'YouTube'] as const;
type Channel = (typeof CHANNELS)[number];

// Coverage matrix · ratio of available vs target per ICP × channel
// (mock for Phase 1; Phase 2 reads from marketing.coverage_view)
const COVERAGE: Array<{ icp: string; channel: Channel; have: number; target: number }> = [
  { icp: 'EU Wellness Women',  channel: 'OTA',          have: 8,  target: 10 },
  { icp: 'EU Wellness Women',  channel: 'Website hero', have: 5,  target: 5  },
  { icp: 'EU Wellness Women',  channel: 'IG Reel',      have: 7,  target: 12 },
  { icp: 'EU Wellness Women',  channel: 'IG Photo',     have: 24, target: 20 },
  { icp: 'EU Wellness Women',  channel: 'Pinterest',    have: 18, target: 20 },
  { icp: 'EU Wellness Women',  channel: 'TikTok',       have: 4,  target: 10 },
  { icp: 'EU Wellness Women',  channel: 'YouTube',      have: 2,  target: 5  },

  { icp: 'Luxury Couples',     channel: 'OTA',          have: 6,  target: 8  },
  { icp: 'Luxury Couples',     channel: 'Website hero', have: 3,  target: 4  },
  { icp: 'Luxury Couples',     channel: 'IG Reel',      have: 9,  target: 10 },
  { icp: 'Luxury Couples',     channel: 'IG Photo',     have: 21, target: 20 },
  { icp: 'Luxury Couples',     channel: 'Pinterest',    have: 12, target: 15 },
  { icp: 'Luxury Couples',     channel: 'TikTok',       have: 6,  target: 8  },
  { icp: 'Luxury Couples',     channel: 'YouTube',      have: 3,  target: 5  },

  { icp: 'Conscious Food',     channel: 'OTA',          have: 4,  target: 6  },
  { icp: 'Conscious Food',     channel: 'Website hero', have: 2,  target: 3  },
  { icp: 'Conscious Food',     channel: 'IG Reel',      have: 11, target: 10 },
  { icp: 'Conscious Food',     channel: 'IG Photo',     have: 28, target: 20 },
  { icp: 'Conscious Food',     channel: 'Pinterest',    have: 14, target: 15 },
  { icp: 'Conscious Food',     channel: 'TikTok',       have: 5,  target: 8  },
  { icp: 'Conscious Food',     channel: 'YouTube',      have: 4,  target: 5  },

  { icp: 'Mystique Explorers', channel: 'OTA',          have: 3,  target: 6  },
  { icp: 'Mystique Explorers', channel: 'Website hero', have: 2,  target: 4  },
  { icp: 'Mystique Explorers', channel: 'IG Reel',      have: 4,  target: 10 },
  { icp: 'Mystique Explorers', channel: 'IG Photo',     have: 12, target: 18 },
  { icp: 'Mystique Explorers', channel: 'Pinterest',    have: 6,  target: 12 },
  { icp: 'Mystique Explorers', channel: 'TikTok',       have: 2,  target: 8  },
  { icp: 'Mystique Explorers', channel: 'YouTube',      have: 1,  target: 5  },

  { icp: 'Digital Detox EU',   channel: 'OTA',          have: 1,  target: 4  },
  { icp: 'Digital Detox EU',   channel: 'Website hero', have: 1,  target: 3  },
  { icp: 'Digital Detox EU',   channel: 'IG Reel',      have: 3,  target: 8  },
  { icp: 'Digital Detox EU',   channel: 'IG Photo',     have: 7,  target: 15 },
  { icp: 'Digital Detox EU',   channel: 'Pinterest',    have: 4,  target: 10 },
  { icp: 'Digital Detox EU',   channel: 'TikTok',       have: 2,  target: 6  },
  { icp: 'Digital Detox EU',   channel: 'YouTube',      have: 0,  target: 4  },

  { icp: 'Asia Source Mkt',    channel: 'OTA',          have: 0,  target: 6  },
  { icp: 'Asia Source Mkt',    channel: 'Website hero', have: 0,  target: 3  },
  { icp: 'Asia Source Mkt',    channel: 'IG Reel',      have: 2,  target: 8  },
  { icp: 'Asia Source Mkt',    channel: 'IG Photo',     have: 5,  target: 12 },
  { icp: 'Asia Source Mkt',    channel: 'Pinterest',    have: 1,  target: 5  },
  { icp: 'Asia Source Mkt',    channel: 'TikTok',       have: 1,  target: 6  },
  { icp: 'Asia Source Mkt',    channel: 'YouTube',      have: 0,  target: 3  },

  { icp: 'Yoga Teachers B2B',  channel: 'OTA',          have: 0,  target: 2  },
  { icp: 'Yoga Teachers B2B',  channel: 'Website hero', have: 0,  target: 2  },
  { icp: 'Yoga Teachers B2B',  channel: 'IG Reel',      have: 0,  target: 4  },
  { icp: 'Yoga Teachers B2B',  channel: 'IG Photo',     have: 4,  target: 8  },
  { icp: 'Yoga Teachers B2B',  channel: 'Pinterest',    have: 1,  target: 4  },
  { icp: 'Yoga Teachers B2B',  channel: 'TikTok',       have: 0,  target: 3  },
  { icp: 'Yoga Teachers B2B',  channel: 'YouTube',      have: 1,  target: 2  },
];

// ─── AI generation jobs (recent) ──────────────────────────────────────────

type GenStatus = 'Queued' | 'Generating' | 'Reality Check' | 'Awaiting Approval' | 'Approved' | 'Rejected';
type GenFormat = 'Reel · 9:16' | 'IG Photo · 4:5' | 'Carousel · 1:1' | 'Pinterest Pin' | 'Hero · 16:9' | 'YT Short' | 'YT Thumb';

interface GenJob {
  id: string;
  prompt: string;
  format: GenFormat;
  icp: string;
  source: 'AI · Midjourney' | 'AI · Sora' | 'AI · Runway' | 'AI · ElevenLabs' | 'AI · DALL-E' | 'Edit · CapCut';
  status: GenStatus;
  age: string;
  cost: string;
}

const GEN_JOBS: GenJob[] = [
  { id: 'g1', prompt: '5am river silence · monk silhouette · slow zoom · sound design',         format: 'Reel · 9:16',     icp: 'EU Wellness Women',  source: 'AI · Sora',        status: 'Awaiting Approval', age: '8m',  cost: '$1.20' },
  { id: 'g2', prompt: 'Brass coffee service · linen · golden hour · still life',                 format: 'IG Photo · 4:5',  icp: 'Luxury Couples',     source: 'AI · Midjourney',  status: 'Approved',          age: '24m', cost: '$0.20' },
  { id: 'g3', prompt: 'Wild ginger harvest · chef\'s hands · dawn · 6-card carousel',            format: 'Carousel · 1:1',  icp: 'Conscious Food',     source: 'AI · Midjourney',  status: 'Reality Check',     age: '1h',  cost: '$1.20' },
  { id: 'g4', prompt: 'Pinterest pin · A ritual older than Europe · brass + linen',              format: 'Pinterest Pin',   icp: 'EU Wellness Women',  source: 'AI · Midjourney',  status: 'Generating',        age: '2m',  cost: '$0.20' },
  { id: 'g5', prompt: 'Hero banner · jungle pool deck · cinematic wide · 16:9',                  format: 'Hero · 16:9',     icp: 'Luxury Couples',     source: 'AI · Midjourney',  status: 'Awaiting Approval', age: '2h',  cost: '$0.20' },
  { id: 'g6', prompt: 'YT Short · 60s walk Wat Xieng Thong at dawn · existing footage cut',      format: 'YT Short',        icp: 'Mystique Explorers', source: 'Edit · CapCut',    status: 'Approved',          age: '3h',  cost: '$0.00' },
  { id: 'g7', prompt: 'น้ำพร — water blessing · Thai-narrated voiceover · 30s',                  format: 'Reel · 9:16',     icp: 'Asia Source Mkt',    source: 'AI · ElevenLabs',  status: 'Generating',        age: '5m',  cost: '$0.80' },
  { id: 'g8', prompt: 'Hammock + river + silence · 3min no-music ambient · TT loop',             format: 'Reel · 9:16',     icp: 'Digital Detox EU',   source: 'AI · Runway',      status: 'Rejected',          age: '6h',  cost: '$1.50' },
];

// ─── Reshoot brief queue ──────────────────────────────────────────────────

interface ShotBrief {
  id: string;
  title: string;
  icp: string;
  channel: Channel;
  reason: string;
  requestedBy: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'New' | 'Photographer Briefed' | 'Shoot Scheduled' | 'In Edit' | 'Delivered';
}

const SHOT_BRIEFS: ShotBrief[] = [
  { id: 'b1', title: 'Yoga deck overlooking the river · sunrise + 3 poses',                  icp: 'EU Wellness Women',  channel: 'Website hero', reason: 'Hero gap · current shot dated · German-market preference',                              requestedBy: 'Lumen (mkt-hod)',   priority: 'High',   status: 'Shoot Scheduled' },
  { id: 'b2', title: 'Asia Source Markets — Thai-language welcome ritual · 8 photos',         icp: 'Asia Source Mkt',    channel: 'IG Photo',     reason: 'New ICP launch · 0 assets · need full set across 3 timeslots',                          requestedBy: 'Carla (legal-hod)',  priority: 'High',   status: 'New' },
  { id: 'b3', title: 'Couples private river dinner · candle setup, two glasses, no people',   icp: 'Luxury Couples',     channel: 'Pinterest',    reason: 'Pinterest is up 18% MoM but couples-pillar low; need 5 pins for evergreen boost',         requestedBy: 'Boost Strategist',  priority: 'Medium', status: 'Photographer Briefed' },
  { id: 'b4', title: 'Mystique Explorers — temple corridor at 4am · 6 reel-ready shots',     icp: 'Mystique Explorers', channel: 'IG Reel',      reason: 'Editor (Geo Saison) asked for raw frames · also feeds upcoming reel campaign',          requestedBy: 'Sales · press',     priority: 'Medium', status: 'In Edit'         },
  { id: 'b5', title: 'Digital Detox · phone-locked box + hammock + river · 4 shots',          icp: 'Digital Detox EU',   channel: 'Pinterest',    reason: 'Zero Pinterest assets in this ICP. Pinterest is the #1 channel for detox-search.',       requestedBy: 'Trend Scout',       priority: 'Medium', status: 'New' },
  { id: 'b6', title: 'Yoga retreat layout — overhead floorplan + capacity callouts',          icp: 'Yoga Teachers B2B',  channel: 'IG Photo',     reason: 'LinkedIn deck cover · sales asset · need transparent-bg version too',                  requestedBy: 'Lumen (mkt-hod)',   priority: 'Low',    status: 'New' },
];

// ─── Auto-tagger pipeline (recent uploads) ───────────────────────────────

interface PipelineItem {
  id: string;
  filename: string;
  size: string;
  uploaded: string;
  status: 'Uploaded' | 'Tagging' | 'Reality Check' | 'Tagged · Ready' | 'Reality Flag' | 'Variant Set Generated';
  tags?: string[];
  realityScore?: number;
  variants?: string[];
}

const PIPELINE_ITEMS: PipelineItem[] = [
  { id: 'p1', filename: 'IMG_4218.HEIC',        size: '8.2 MB',  uploaded: '4m ago',  status: 'Tagged · Ready',         tags: ['spa', 'morning ritual', 'brass', 'linen'], realityScore: 98, variants: ['IG 4:5', 'Pinterest', 'Hero 16:9'] },
  { id: 'p2', filename: 'DSC_0894.NEF',         size: '24.1 MB', uploaded: '6m ago',  status: 'Tagging',                tags: [], realityScore: undefined },
  { id: 'p3', filename: 'sunset_boat_03.jpg',   size: '4.4 MB',  uploaded: '12m ago', status: 'Variant Set Generated',  tags: ['couples', 'sunset', 'river', 'boat'], realityScore: 96, variants: ['IG 4:5', 'IG Story 9:16', 'Pinterest', 'Hero 16:9', 'TT 9:16'] },
  { id: 'p4', filename: 'IMG_4209.HEIC',        size: '7.8 MB',  uploaded: '18m ago', status: 'Reality Flag',           tags: ['claimed: silent retreat', 'flag: not offered'], realityScore: 42 },
  { id: 'p5', filename: 'monks_dawn_R1.NEF',    size: '19.8 MB', uploaded: '22m ago', status: 'Tagged · Ready',         tags: ['monk', 'temple', 'dawn', 'alms'], realityScore: 99, variants: ['IG 4:5', 'Pinterest'] },
  { id: 'p6', filename: 'jungle_pool_04.jpg',   size: '3.1 MB',  uploaded: '34m ago', status: 'Reality Check',          tags: ['pool', 'jungle', 'hero'], realityScore: undefined },
];

// ─── Agent fleet ──────────────────────────────────────────────────────────

interface LibAgent { name: string; desc: string; signal: string }
const AGENTS: LibAgent[] = [
  { name: 'Auto-tagger',         desc: 'Vision-classifies uploads: subject, room, light, ICP fit, channel suitability.',                signal: '218 tagged' },
  { name: 'Reality & Brand',     desc: 'Checks visuals match real resort. Flags AI artifacts, off-brand colors, fake props.',           signal: '4 flags' },
  { name: 'AI Generator',        desc: 'Routes prompts to Midjourney · Sora · Runway · DALL-E · ElevenLabs. Tracks cost.',               signal: '8 jobs in queue' },
  { name: 'Variant Maker',       desc: 'Per-channel resize/recrop. 4:5 / 9:16 / 16:9 / 1:1 / Pinterest tall / OTA carousel slots.',      signal: '36 variants' },
  { name: 'Coverage Radar',      desc: 'Computes ICP × channel × pillar gaps. Surfaces what to shoot or generate next.',                  signal: '11 gaps' },
  { name: 'Reshoot Brief Writer', desc: 'Turns a gap into a shot brief: angle, light, props, talent, post-prod notes.',                  signal: '6 briefs open' },
  { name: 'Curator',             desc: 'Picks the right 5-10 assets for OTA carousel · website hero · campaign · social pool.',          signal: '14 picks' },
  { name: 'Quality Grader',      desc: 'QC score (sharpness, exposure, composition) + brand-fit score (palette, prop allow-list).',     signal: '98% pass' },
  { name: 'Rights & License',    desc: 'Tracks model releases, photographer license, paid-ad eligibility per asset.',                    signal: '4 missing' },
];

// ─── Component ────────────────────────────────────────────────────────────

const VIEW_LABEL: Record<View, string> = {
  studio:   '✦ AI Creation Studio',
  coverage: '◆ Coverage Gap Radar',
  briefs:   '◉ Reshoot Brief Queue',
  pipeline: '◐ Upload Pipeline',
};
const VIEWS: View[] = ['studio', 'coverage', 'briefs', 'pipeline'];

export default function LibraryCockpit({ view, liveCounts }: Props) {
  const generating = GEN_JOBS.filter((j) => j.status === 'Generating' || j.status === 'Queued').length;
  const awaitingApproval = GEN_JOBS.filter((j) => j.status === 'Awaiting Approval' || j.status === 'Reality Check').length;
  const gaps = COVERAGE.filter((c) => c.have < c.target).length;
  const briefsOpen = SHOT_BRIEFS.filter((b) => b.status !== 'Delivered').length;
  const realityFlags = PIPELINE_ITEMS.filter((p) => p.status === 'Reality Flag').length;
  const monthSpend = GEN_JOBS.reduce((s, j) => s + parseFloat(j.cost.replace('$', '')), 0);

  return (
    <>
      {/* KPI band */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        <KpiBox value={liveCounts.totalReady} unit="count" label="Library ready"        tooltip="All tagged + verified assets · live count" />
        <KpiBox value={generating}            unit="count" label="AI generating"        tooltip="Jobs in queue or generating" />
        <KpiBox value={awaitingApproval}      unit="count" label="Awaiting approval"    tooltip="Generated + Reality-checked, awaiting human sign-off" />
        <KpiBox value={gaps}                  unit="count" label="Coverage gaps"        tooltip="ICP × channel cells under target · click Coverage tab" />
        <KpiBox value={briefsOpen}            unit="count" label="Shot briefs open"     tooltip="Reshoot briefs not yet delivered" />
        <KpiBox value={realityFlags}          unit="count" label="Reality flags"        tooltip="Uploads flagged for fabrication or off-brand · review needed" state={realityFlags > 0 ? 'data-needed' : 'live'} needs={realityFlags > 0 ? 'human review' : undefined} />
        <KpiBox value={monthSpend}            unit="usd"   label="AI gen · spend MTD"   tooltip="Cost across Midjourney · Sora · Runway · DALL-E · ElevenLabs jobs this month" dp={2} />
      </div>

      {/* Section sub-nav */}
      <div style={S.subStrip}>
        {VIEWS.map((v) => (
          <a key={v} href={`?view=${v}`}
             style={{ ...S.subStripLink, ...(v === view ? S.subStripLinkActive : {}) }}>
            {VIEW_LABEL[v]}
          </a>
        ))}
      </div>

      {view === 'studio'   && <StudioSection />}
      {view === 'coverage' && <CoverageSection />}
      {view === 'briefs'   && <BriefsSection />}
      {view === 'pipeline' && <PipelineSection />}

      {/* Agent fleet (always shown below sections) */}
      <div style={{ marginTop: 14 }}>
        <Panel title="Agent fleet" eyebrow={`${AGENTS.length} library specialists`}>
          <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
            {AGENTS.map((a) => (
              <div key={a.name} style={S.agentCard}>
                <div style={S.agentHead}>
                  <span style={S.agentName}>{a.name}</span>
                  <span style={S.signalPill}>{a.signal}</span>
                </div>
                <div style={S.agentDesc}>{a.desc}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}

// ─── STUDIO ───────────────────────────────────────────────────────────────

function StudioSection() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 340px)', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Panel title="AI Creation Studio" eyebrow="prompt → reel · photo · carousel · pin">
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <form style={S.promptForm}>
              <textarea
                placeholder="Describe the asset · e.g. '5am river silence · monk silhouette · slow zoom · sound design'"
                rows={3}
                style={S.promptInput}
                defaultValue=""
              />
              <div style={S.promptControls}>
                <Selector label="ICP">
                  {ICPS.map((i) => <option key={i.name} value={i.name}>{i.emoji} {i.name}</option>)}
                </Selector>
                <Selector label="Format">
                  <option>Reel · 9:16</option>
                  <option>IG Photo · 4:5</option>
                  <option>Carousel · 1:1</option>
                  <option>Pinterest Pin · 2:3</option>
                  <option>Hero · 16:9</option>
                  <option>YT Short</option>
                  <option>YT Thumb · 16:9</option>
                </Selector>
                <Selector label="Engine">
                  <option>AI · Midjourney</option>
                  <option>AI · Sora</option>
                  <option>AI · Runway</option>
                  <option>AI · DALL-E 3</option>
                  <option>AI · ElevenLabs (voiceover)</option>
                  <option>Edit · CapCut (cut from library)</option>
                </Selector>
                <Selector label="Language">
                  <option>EN</option>
                  <option>DE</option>
                  <option>ES</option>
                  <option>LO</option>
                  <option>TH</option>
                  <option>JP</option>
                </Selector>
                <Selector label="Variants">
                  <option>1</option>
                  <option>4</option>
                  <option>8</option>
                  <option>16</option>
                </Selector>
              </div>
              <div style={S.promptActions}>
                <button type="button" style={S.btnPrimary}>✦ Generate</button>
                <button type="button" style={S.btnSecondary}>↻ Iterate from selection</button>
                <button type="button" style={S.btnSecondary}>📋 Save brief</button>
                <span style={S.costHint}>est. cost · $0.20–$1.50 · Reality Check auto-runs</span>
              </div>
            </form>
          </div>
        </Panel>

        <Panel title="Recent generations" eyebrow={`${GEN_JOBS.length} jobs · last 24h`}>
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {GEN_JOBS.map((j) => (
              <div key={j.id} style={S.genRow}>
                <div style={S.genThumb}>{thumbGlyphForFormat(j.format)}</div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={S.genHead}>
                    <span style={S.genPrompt}>{j.prompt}</span>
                    <span style={genStatusPill(j.status)}>{j.status}</span>
                  </div>
                  <div style={S.genMeta}>{j.format} · {j.icp} · {j.source} · {j.cost} · {j.age}</div>
                  <div style={S.genActions}>
                    {(j.status === 'Awaiting Approval' || j.status === 'Reality Check') && (
                      <>
                        <button type="button" style={S.btnInlinePrimary}>✓ Approve</button>
                        <button type="button" style={S.btnInlineSecondary}>↻ Iterate</button>
                        <button type="button" style={S.btnInlineSecondary}>✕ Reject</button>
                      </>
                    )}
                    {j.status === 'Approved' && <button type="button" style={S.btnInlineSecondary}>→ Send to Variant Maker</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Right rail */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Panel title="Generation budget · MTD" eyebrow="cost per channel">
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <BudgetRow label="Midjourney"   spend="$24.80" jobs="124" />
            <BudgetRow label="Sora"         spend="$48.00" jobs="20"  />
            <BudgetRow label="Runway"       spend="$15.00" jobs="10"  />
            <BudgetRow label="DALL-E 3"     spend="$8.40"  jobs="42"  />
            <BudgetRow label="ElevenLabs"   spend="$6.40"  jobs="32"  />
            <BudgetRow label="CapCut · edit" spend="$0.00" jobs="18"  />
            <div style={S.budgetTotal}>
              <span>Total MTD</span>
              <strong>$102.60</strong>
            </div>
          </div>
        </Panel>

        <Panel title="Engine selector cheat sheet" eyebrow="when to use what">
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Cheat tone="brass" engine="Midjourney"  use="High-end stills · brand-fit · OTA + hero + pin" />
            <Cheat tone="brass" engine="Sora"        use="Short video / reel · slow cinematic" />
            <Cheat tone="soft"  engine="Runway"      use="Motion variations · animate stills · BG removal" />
            <Cheat tone="soft"  engine="DALL-E 3"    use="Quick concept · fast iteration · cheap" />
            <Cheat tone="warn"  engine="ElevenLabs"  use="Voiceover · multilingual narration" />
            <Cheat tone="soft"  engine="CapCut"      use="Edit existing footage · no AI · brand-safest" />
          </div>
        </Panel>

        <Panel title="Guardrails" eyebrow="non-negotiable">
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Callout tone="brass">Reality Agent runs on <strong>every</strong> generation. AI artifacts + off-brand props are rejected automatically.</Callout>
            <Callout tone="warn">No fabricated claims. If an asset implies a service we don't offer, the Reality Agent flags + blocks.</Callout>
            <Callout tone="soft">Brand palette enforced (brass · linen · jungle green · paper). Off-palette generations get auto-iterated once.</Callout>
            <Callout tone="soft">Every approved asset enters the library with ICP + pillar + channel tags. No untagged orphans.</Callout>
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ─── COVERAGE GAP RADAR ───────────────────────────────────────────────────

function CoverageSection() {
  const byIcp = new Map<string, Array<typeof COVERAGE[number]>>();
  for (const c of COVERAGE) (byIcp.get(c.icp) ?? byIcp.set(c.icp, []).get(c.icp)!).push(c);

  return (
    <Panel title="Coverage gap radar" eyebrow="ICP × channel · target vs library">
      <div style={{ padding: 14, overflowX: 'auto' }}>
        <table style={S.coverageTable}>
          <thead>
            <tr>
              <th style={S.covTh}>ICP</th>
              {CHANNELS.map((ch) => <th key={ch} style={S.covTh}>{ch}</th>)}
              <th style={S.covTh}>Gap total</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(byIcp.entries()).map(([icp, cells]) => {
              const gapTotal = cells.reduce((s, c) => s + Math.max(0, c.target - c.have), 0);
              return (
                <tr key={icp}>
                  <td style={S.covIcp}>{icp}</td>
                  {CHANNELS.map((ch) => {
                    const cell = cells.find((c) => c.channel === ch);
                    if (!cell) return <td key={ch} style={S.covCell}>—</td>;
                    const pct = Math.min(100, Math.round((cell.have / cell.target) * 100));
                    const tone: 'good' | 'warn' | 'bad' = pct >= 100 ? 'good' : pct >= 50 ? 'warn' : 'bad';
                    return (
                      <td key={ch} style={S.covCell}>
                        <div style={{ ...S.covPill, ...covToneStyle(tone) }}>
                          <strong>{cell.have}/{cell.target}</strong>
                          <span style={S.covPct}>{pct}%</span>
                        </div>
                      </td>
                    );
                  })}
                  <td style={S.covGapTotal}>{gapTotal > 0 ? `${gapTotal} short` : '✓'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={S.legendRow}>
          <LegendChip color="var(--st-good, #82ad8c)" label="≥100% (target met)" />
          <LegendChip color="var(--st-warn, #C28F2C)" label="50-99% (in build)" />
          <LegendChip color="#c97b6a" label="<50% (gap · action needed)" />
        </div>
      </div>
    </Panel>
  );
}

// ─── RESHOOT BRIEFS ───────────────────────────────────────────────────────

function BriefsSection() {
  return (
    <Panel
      title="Reshoot brief queue"
      eyebrow={`${SHOT_BRIEFS.length} briefs · ${SHOT_BRIEFS.filter((b) => b.status !== 'Delivered').length} open`}
      actions={<a href="?view=briefs&new=1" style={S.btnPrimary}>+ New brief</a>}
    >
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {SHOT_BRIEFS.map((b) => (
          <div key={b.id} style={S.briefCard}>
            <div style={S.briefHead}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={S.briefTitle}>{b.title}</span>
                <span style={S.briefMeta}>{b.icp} · {b.channel} · requested by {b.requestedBy}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={priorityPill(b.priority)}>{b.priority}</span>
                <span style={briefStatusPill(b.status)}>{b.status}</span>
              </div>
            </div>
            <div style={S.briefReason}>{b.reason}</div>
            <div style={S.briefActions}>
              <button type="button" style={S.btnInlineSecondary}>✎ Edit brief</button>
              <button type="button" style={S.btnInlineSecondary}>📷 Assign photographer</button>
              <button type="button" style={S.btnInlineSecondary}>✦ Generate with AI instead</button>
              <button type="button" style={S.btnInlineSecondary}>✓ Mark delivered</button>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ─── UPLOAD PIPELINE ──────────────────────────────────────────────────────

function PipelineSection() {
  return (
    <Panel title="Upload pipeline · last 60 min" eyebrow="upload → tag → reality → variant set">
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {PIPELINE_ITEMS.map((p) => (
          <div key={p.id} style={S.pipeRow}>
            <div style={S.pipeHead}>
              <span style={S.pipeFile}>{p.filename}</span>
              <span style={S.pipeMeta}>{p.size} · {p.uploaded}</span>
              <span style={pipelineStatusPill(p.status)}>{p.status}</span>
            </div>
            {p.tags && p.tags.length > 0 && (
              <div style={S.pipeTags}>
                {p.tags.map((t) => <span key={t} style={S.tagChip}>{t}</span>)}
              </div>
            )}
            {p.realityScore != null && (
              <div style={S.pipeReality}>
                Reality score: <strong style={{ color: p.realityScore >= 80 ? 'var(--st-good, #82ad8c)' : p.realityScore >= 50 ? 'var(--st-warn, #C28F2C)' : '#c97b6a' }}>{p.realityScore}/100</strong>
                {p.realityScore < 80 && <span style={{ color: '#c97b6a', marginLeft: 8 }}>· human review required</span>}
              </div>
            )}
            {p.variants && p.variants.length > 0 && (
              <div style={S.pipeVariants}>
                <span style={S.pipeVarLabel}>Variants ready:</span>
                {p.variants.map((v) => <span key={v} style={S.variantChip}>{v}</span>)}
              </div>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ─── Atoms ────────────────────────────────────────────────────────────────

function Selector({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={S.selectorWrap}>
      <span style={S.selectorLabel}>{label}</span>
      <select style={S.selectorSelect}>{children}</select>
    </label>
  );
}

function BudgetRow({ label, spend, jobs }: { label: string; spend: string; jobs: string }) {
  return (
    <div style={S.budgetRow}>
      <span style={S.budgetLabel}>{label}</span>
      <span style={S.budgetJobs}>{jobs} jobs</span>
      <strong style={S.budgetSpend}>{spend}</strong>
    </div>
  );
}

function Cheat({ tone, engine, use }: { tone: 'brass' | 'soft' | 'warn'; engine: string; use: string }) {
  const color = tone === 'brass' ? 'var(--brass, #a8854a)' : tone === 'warn' ? 'var(--st-warn, #C28F2C)' : 'var(--text-2, #d8cca8)';
  return (
    <div style={{ padding: '6px 8px', background: 'var(--surf-1, #0f0d0a)', borderLeft: `2px solid ${color}`, borderRadius: 3, fontSize: 'var(--t-xs)', lineHeight: 1.4 }}>
      <strong style={{ color }}>{engine}</strong> <span style={{ color: 'var(--text-mute, #9b907a)' }}>· {use}</span>
    </div>
  );
}

function Callout({ tone, children }: { tone: 'brass' | 'soft' | 'warn'; children: ReactNode }) {
  const border = tone === 'brass' ? 'var(--brass, #a8854a)' : tone === 'warn' ? 'var(--st-warn, #C28F2C)' : 'var(--border-1, #1f1c15)';
  return (
    <div style={{ padding: '8px 10px', borderLeft: `2px solid ${border}`, background: 'var(--surf-1, #0f0d0a)', fontSize: 'var(--t-sm)', lineHeight: 1.5, color: 'var(--text-1, #d8cca8)' }}>
      {children}
    </div>
  );
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 10, height: 10, borderRadius: 2, background: color, border: '1px solid var(--border-1, #1f1c15)' }} />
      <span style={S.legendLabel}>{label}</span>
    </span>
  );
}

function thumbGlyphForFormat(f: GenFormat): string {
  if (f.startsWith('Reel'))         return '▶';
  if (f.startsWith('YT Short'))     return '▶';
  if (f.startsWith('YT Thumb'))     return '▣';
  if (f.startsWith('Carousel'))     return '▦';
  if (f.startsWith('Pinterest'))    return '◐';
  if (f.startsWith('Hero'))         return '▥';
  return '▣';
}

// ─── Pill helpers ─────────────────────────────────────────────────────────

function genStatusPill(s: GenStatus): React.CSSProperties {
  const c = s === 'Approved' ? 'var(--st-good, #82ad8c)' :
            s === 'Awaiting Approval' ? 'var(--st-warn, #C28F2C)' :
            s === 'Reality Check' ? '#c97b6a' :
            s === 'Generating' || s === 'Queued' ? 'var(--brass, #a8854a)' :
            s === 'Rejected' ? 'var(--text-place, #5a5448)' :
            'var(--text-mute, #9b907a)';
  return basePill(c);
}

function briefStatusPill(s: ShotBrief['status']): React.CSSProperties {
  const c = s === 'Delivered' ? 'var(--st-good, #82ad8c)' :
            s === 'In Edit' ? 'var(--brass, #a8854a)' :
            s === 'Shoot Scheduled' ? 'var(--text-2, #d8cca8)' :
            s === 'Photographer Briefed' ? 'var(--text-2, #d8cca8)' :
            'var(--st-warn, #C28F2C)';
  return basePill(c);
}

function priorityPill(p: ShotBrief['priority']): React.CSSProperties {
  const c = p === 'High' ? '#c97b6a' : p === 'Medium' ? 'var(--st-warn, #C28F2C)' : 'var(--text-mute, #9b907a)';
  return basePill(c);
}

function pipelineStatusPill(s: PipelineItem['status']): React.CSSProperties {
  const c = s === 'Tagged · Ready' || s === 'Variant Set Generated' ? 'var(--st-good, #82ad8c)' :
            s === 'Reality Flag' ? '#c97b6a' :
            s === 'Tagging' || s === 'Reality Check' ? 'var(--brass, #a8854a)' :
            'var(--text-mute, #9b907a)';
  return basePill(c);
}

function covToneStyle(tone: 'good' | 'warn' | 'bad'): React.CSSProperties {
  const c = tone === 'good' ? 'var(--st-good, #82ad8c)' : tone === 'warn' ? 'var(--st-warn, #C28F2C)' : '#c97b6a';
  return { background: tone === 'bad' ? 'rgba(201,123,106,0.10)' : 'transparent', borderColor: c, color: c };
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

const S: Record<string, React.CSSProperties> = {
  subStrip: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 14,
    paddingBottom: 8,
    borderBottom: '1px solid var(--border-1, #1f1c15)',
  },
  subStripLink: {
    padding: '6px 12px',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--text-mute, #9b907a)',
    border: '1px solid var(--border-1, #1f1c15)',
    borderRadius: 3,
    textDecoration: 'none',
    background: 'var(--surf-1, #0f0d0a)',
  },
  subStripLinkActive: {
    color: 'var(--surf-0, #0a0a0a)',
    background: 'var(--brass, #a8854a)',
    borderColor: 'var(--brass, #a8854a)',
    fontWeight: 700,
  },

  // Studio
  promptForm: { display: 'flex', flexDirection: 'column', gap: 10 },
  promptInput: {
    width: '100%',
    padding: '10px 12px',
    fontFamily: "'Inter Tight', system-ui, sans-serif",
    fontSize: 'var(--t-md)',
    color: 'var(--text-0, #e9e1ce)',
    background: 'var(--surf-1, #0f0d0a)',
    border: '1px solid var(--border-1, #1f1c15)',
    borderRadius: 4,
    resize: 'vertical',
    lineHeight: 1.4,
  },
  promptControls: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  promptActions: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  costHint: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.10em',
    color: 'var(--text-mute, #9b907a)',
    marginLeft: 'auto',
  },

  selectorWrap: { display: 'flex', flexDirection: 'column', gap: 3 },
  selectorLabel: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: 'var(--text-place, #5a5448)',
  },
  selectorSelect: {
    background: 'var(--surf-1, #0f0d0a)',
    border: '1px solid var(--border-1, #1f1c15)',
    color: 'var(--text-0, #e9e1ce)',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    padding: '4px 6px',
    borderRadius: 3,
  },

  // Gen rows
  genRow: {
    background: 'var(--surf-1, #0f0d0a)',
    border: '1px solid var(--border-1, #1f1c15)',
    borderRadius: 6,
    padding: '8px 10px',
    display: 'grid',
    gridTemplateColumns: '40px 1fr',
    gap: 10,
    alignItems: 'flex-start',
  },
  genThumb: {
    width: 40, height: 40,
    background: 'var(--surf-0, #0a0a0a)',
    border: '1px solid var(--brass, #a8854a)',
    color: 'var(--brass, #a8854a)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18,
    borderRadius: 3,
  },
  genHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  genPrompt: { fontSize: 'var(--t-sm)', color: 'var(--text-0, #e9e1ce)', fontStyle: 'italic', lineHeight: 1.4 },
  genMeta: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.10em',
    color: 'var(--text-mute, #9b907a)',
  },
  genActions: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 },

  // Right rail
  budgetRow: { display: 'grid', gridTemplateColumns: '1fr 70px 60px', gap: 6, alignItems: 'baseline' },
  budgetLabel: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.14em', color: 'var(--text-1, #d8cca8)' },
  budgetJobs: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', color: 'var(--text-mute, #9b907a)', textAlign: 'right' },
  budgetSpend: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-sm)', color: 'var(--brass, #a8854a)', textAlign: 'right' },
  budgetTotal: {
    display: 'flex', justifyContent: 'space-between',
    paddingTop: 6, borderTop: '1px solid var(--border-1, #1f1c15)',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-sm)', letterSpacing: '0.14em', textTransform: 'uppercase',
    color: 'var(--text-0, #e9e1ce)',
  },

  // Coverage matrix
  coverageTable: { width: '100%', borderCollapse: 'collapse' },
  covTh: {
    textAlign: 'left',
    padding: '8px 8px',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: 'var(--brass, #a8854a)',
    borderBottom: '1px solid var(--border-1, #1f1c15)',
    whiteSpace: 'nowrap',
  },
  covIcp: {
    padding: '8px 8px',
    fontSize: 'var(--t-sm)',
    color: 'var(--text-0, #e9e1ce)',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--border-1, #1f1c15)',
  },
  covCell: { padding: '6px 8px', borderBottom: '1px solid var(--border-1, #1f1c15)' },
  covPill: {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '3px 8px',
    border: '1px solid',
    borderRadius: 3,
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    fontVariantNumeric: 'tabular-nums',
    minWidth: 56,
  },
  covPct: { fontSize: 9, opacity: 0.7, letterSpacing: '0.1em' },
  covGapTotal: {
    padding: '8px 8px',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--st-warn, #C28F2C)',
    borderBottom: '1px solid var(--border-1, #1f1c15)',
    whiteSpace: 'nowrap',
    textAlign: 'right',
  },
  legendRow: { display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 14 },
  legendLabel: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--text-mute, #9b907a)',
  },

  // Briefs
  briefCard: {
    background: 'var(--surf-1, #0f0d0a)',
    border: '1px solid var(--border-1, #1f1c15)',
    borderLeft: '3px solid var(--brass, #a8854a)',
    borderRadius: 6,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  briefHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  briefTitle: { fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: 'var(--t-md)', color: 'var(--text-0, #e9e1ce)' },
  briefMeta: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.12em', color: 'var(--text-mute, #9b907a)' },
  briefReason: { fontSize: 'var(--t-sm)', lineHeight: 1.5, color: 'var(--text-1, #d8cca8)' },
  briefActions: { display: 'flex', gap: 6, flexWrap: 'wrap' },

  // Pipeline rows
  pipeRow: {
    background: 'var(--surf-1, #0f0d0a)',
    border: '1px solid var(--border-1, #1f1c15)',
    borderRadius: 6,
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  pipeHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  pipeFile: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-sm)', color: 'var(--text-0, #e9e1ce)' },
  pipeMeta: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', color: 'var(--text-mute, #9b907a)', marginLeft: 'auto', marginRight: 10 },
  pipeTags: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  tagChip: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 9,
    letterSpacing: '0.10em',
    padding: '1px 5px',
    background: 'rgba(168,133,74,0.10)',
    color: 'var(--brass, #a8854a)',
    border: '1px solid var(--brass, #a8854a)',
    borderRadius: 2,
  },
  pipeReality: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', color: 'var(--text-1, #d8cca8)' },
  pipeVariants: { display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'baseline' },
  pipeVarLabel: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--st-good, #82ad8c)' },
  variantChip: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 9,
    letterSpacing: '0.10em',
    padding: '1px 5px',
    background: 'rgba(130,173,140,0.10)',
    color: 'var(--st-good, #82ad8c)',
    border: '1px solid var(--st-good, #82ad8c)',
    borderRadius: 2,
  },

  // Agent fleet
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
  signalPill: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--brass, #a8854a)',
    border: '1px solid var(--brass, #a8854a)',
    padding: '1px 5px',
    borderRadius: 3,
  },

  // Buttons
  btnPrimary: {
    background: 'var(--brass, #a8854a)',
    color: 'var(--surf-0, #0a0a0a)',
    border: '1px solid var(--brass, #a8854a)',
    padding: '5px 12px',
    borderRadius: 3,
    cursor: 'pointer',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    fontWeight: 600,
    textDecoration: 'none',
  },
  btnSecondary: {
    background: 'transparent',
    color: 'var(--text-1, #d8cca8)',
    border: '1px solid var(--border-1, #1f1c15)',
    padding: '5px 12px',
    borderRadius: 3,
    cursor: 'pointer',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  btnInlinePrimary: {
    background: 'var(--brass, #a8854a)',
    color: 'var(--surf-0, #0a0a0a)',
    border: '1px solid var(--brass, #a8854a)',
    padding: '3px 8px',
    borderRadius: 3,
    cursor: 'pointer',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
    fontWeight: 600,
  },
  btnInlineSecondary: {
    background: 'transparent',
    color: 'var(--text-1, #d8cca8)',
    border: '1px solid var(--border-1, #1f1c15)',
    padding: '3px 8px',
    borderRadius: 3,
    cursor: 'pointer',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
  },
};
