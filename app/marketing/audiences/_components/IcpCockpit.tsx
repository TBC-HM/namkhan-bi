// app/marketing/audiences/_components/IcpCockpit.tsx
//
// PBS 2026-05-16: ICP Cockpit overlay on /marketing/audiences. Replaces
// the old "guest list" framing with an ICP-first operator surface.
//
// Sections (?view=):
//   roster     · all defined ICPs as cards (default)
//   analytics  · per-ICP performance: bookings, ADR, LOS, channels, repeat
//   discovery  · AI Discovery — clusters in guest data, untapped segments
//   create     · ICP Creator wizard (name → markets → traits → save)
//   contacts   · live guest profile list (existing data, kept below)
//
// Phase 2 wires marketing.icps + marketing.icp_performance + the 8 agents
// (Cluster Miner · Reality Check · ICP Architect · Performance Tracker ·
// Discovery Radar · Expansion Strategist · Channel Mapper · Brief Generator).

import type { ReactNode } from 'react';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';

type View = 'roster' | 'analytics' | 'discovery' | 'create' | 'contacts';

interface Props {
  view: View;
  liveCounts: { totalProfiles: number; withCountry: number; withEmail: number; topCountry?: string; topSource?: string };
}

// ─── ICP definitions ──────────────────────────────────────────────────────

type IcpClass = 'B2C' | 'B2B' | 'B2B2C';
interface IcpDef {
  id: string;
  name: string;
  emoji: string;
  cls: IcpClass;
  markets: string;
  ageBand: string;
  size: number;            // % of total guest base
  guestCount: number;      // estimated absolute
  pillars: string[];
  channels: string[];
  motivations: string[];
  pricePosition: 'Luxury' | 'Premium' | 'Mid';
  trend: '+' | '+' | '+' | '·' | '−';   // direction last 90d
  trendPp: string;
  status: 'Scaling' | 'Stable' | 'Emerging' | 'At Risk';
}

const ICPS: IcpDef[] = [
  { id: 'icp_eu_wellness',     name: 'EU Wellness Women',      emoji: '✦', cls: 'B2C',   markets: 'DACH · UK · NL',     ageBand: '35-50',   size: 32, guestCount: 1324, pillars: ['Morning Rituals', 'Spa Reset', 'Farm Wellness', 'Full Moon Calm'], channels: ['IG', 'Pinterest', 'YouTube'],         motivations: ['Reset', 'Self-care', 'Sleep'],            pricePosition: 'Premium', trend: '+', trendPp: '+3.4pp QoQ', status: 'Scaling'  },
  { id: 'icp_lux_couples',     name: 'Luxury Couples',         emoji: '◆', cls: 'B2C',   markets: 'EU · US · AU',       ageBand: '32-55',   size: 24, guestCount: 994,  pillars: ['Privacy', 'Romance', 'Candle Dinners', 'River Floats'],            channels: ['IG', 'TikTok', 'Pinterest'],          motivations: ['Reconnect', 'Anniversary', 'Off-grid'],  pricePosition: 'Luxury',  trend: '+', trendPp: '+1.1pp QoQ', status: 'Stable'   },
  { id: 'icp_conscious_food',  name: 'Conscious Food',         emoji: '◉', cls: 'B2C',   markets: 'US · EU · Asia',     ageBand: '28-55',   size: 12, guestCount: 497,  pillars: ['Herb Garden', 'Fermentation', 'Local Chefs', 'Foraging'],          channels: ['IG', 'YouTube', 'TikTok'],            motivations: ['Provenance', 'Story', 'Skill-build'],    pricePosition: 'Premium', trend: '+', trendPp: '+2.0pp QoQ', status: 'Scaling'  },
  { id: 'icp_mystique',        name: 'Mystique Explorers',     emoji: '◐', cls: 'B2C',   markets: 'US · AU · EU',       ageBand: '40-65',   size: 9,  guestCount: 373,  pillars: ['Temples', 'Monastic Rituals', 'River Stories', 'Lao Heritage'],    channels: ['IG', 'TikTok', 'YouTube'],            motivations: ['Cultural depth', 'Photography'],         pricePosition: 'Premium', trend: '·', trendPp: '−0.4pp QoQ', status: 'Stable'   },
  { id: 'icp_digital_detox',   name: 'Digital Detox EU',       emoji: '◇', cls: 'B2C',   markets: 'DACH · UK',          ageBand: '32-48',   size: 7,  guestCount: 290,  pillars: ['Quiet', 'River Silence', 'Tech-free', 'Sound Bath'],               channels: ['Pinterest', 'IG', 'TikTok'],          motivations: ['Burnout reset', 'Sleep', 'Solo time'],   pricePosition: 'Premium', trend: '+', trendPp: '+1.8pp QoQ', status: 'Scaling'  },
  { id: 'icp_asia_source',     name: 'Asia Source Markets',    emoji: '✺', cls: 'B2C',   markets: 'TH · CN · JP · KR · SG', ageBand: '30-55', size: 4,  guestCount: 166,  pillars: ['Wellness', 'Cultural Heritage', 'Lao Cuisine'],                    channels: ['IG', 'WeChat', 'Line', 'YouTube'],    motivations: ['Regional escape', 'Wellness'],            pricePosition: 'Premium', trend: '+', trendPp: '+0.9pp QoQ', status: 'Emerging' },
  { id: 'icp_yoga_b2b',        name: 'Yoga Teachers · B2B',    emoji: '✿', cls: 'B2B',   markets: 'EU · US',            ageBand: 'Teacher pop.', size: 3, guestCount: 124,  pillars: ['Host your retreat', 'Group rates', 'Schedule logistics'],          channels: ['LinkedIn', 'IG', 'Email seq.'],       motivations: ['Capacity', 'Pricing', 'Schedule fit'],   pricePosition: 'Mid',     trend: '+', trendPp: '+0.6pp QoQ', status: 'Emerging' },
  { id: 'icp_returning',       name: 'Returning Guests',       emoji: '↻', cls: 'B2C',   markets: 'Mixed',              ageBand: '—',       size: 9,  guestCount: 373,  pillars: ['Loyalty', 'Anniversary stays', 'Friends-bring'],                  channels: ['Email', 'WhatsApp', 'IG DMs'],        motivations: ['Reconnect', 'Bring partner', 'Gift'],    pricePosition: 'Premium', trend: '·', trendPp: '+0.2pp QoQ', status: 'Stable'   },
];

// ─── Per-ICP analytics (Phase 2 sources mv_kpi_daily + guest.mv_guest_profile) ──

interface IcpPerf {
  icpId: string;
  bookingsMtd: number;
  adrUsd: number;
  losNights: number;
  repeatRate: string;
  directShare: string;
  topSource: string;
  reviewScore: number;
  leadTime: string;
  offSeasonShare: string;
}

const PERF: Record<string, IcpPerf> = {
  icp_eu_wellness:    { icpId: 'icp_eu_wellness',    bookingsMtd: 38, adrUsd: 480, losNights: 6.2, repeatRate: '18%', directShare: '54%', topSource: 'Booking.com', reviewScore: 9.4, leadTime: '64d', offSeasonShare: '21%' },
  icp_lux_couples:    { icpId: 'icp_lux_couples',    bookingsMtd: 24, adrUsd: 720, losNights: 4.8, repeatRate: '12%', directShare: '47%', topSource: 'SLH',          reviewScore: 9.6, leadTime: '52d', offSeasonShare: '14%' },
  icp_conscious_food: { icpId: 'icp_conscious_food', bookingsMtd: 14, adrUsd: 510, losNights: 5.4, repeatRate: '9%',  directShare: '61%', topSource: 'Direct',       reviewScore: 9.5, leadTime: '48d', offSeasonShare: '28%' },
  icp_mystique:       { icpId: 'icp_mystique',       bookingsMtd: 11, adrUsd: 560, losNights: 4.1, repeatRate: '7%',  directShare: '38%', topSource: 'Expedia',      reviewScore: 9.3, leadTime: '38d', offSeasonShare: '12%' },
  icp_digital_detox:  { icpId: 'icp_digital_detox',  bookingsMtd: 9,  adrUsd: 590, losNights: 7.1, repeatRate: '4%',  directShare: '72%', topSource: 'Direct',       reviewScore: 9.7, leadTime: '74d', offSeasonShare: '34%' },
  icp_asia_source:    { icpId: 'icp_asia_source',    bookingsMtd: 5,  adrUsd: 430, losNights: 3.2, repeatRate: '6%',  directShare: '28%', topSource: 'Booking.com', reviewScore: 9.2, leadTime: '22d', offSeasonShare: '18%' },
  icp_yoga_b2b:       { icpId: 'icp_yoga_b2b',       bookingsMtd: 2,  adrUsd: 380, losNights: 7.0, repeatRate: '24%', directShare: '92%', topSource: 'Direct',       reviewScore: 9.5, leadTime: '120d', offSeasonShare: '40%' },
  icp_returning:      { icpId: 'icp_returning',      bookingsMtd: 12, adrUsd: 540, losNights: 5.0, repeatRate: '100%', directShare: '88%', topSource: 'Direct',     reviewScore: 9.8, leadTime: '110d', offSeasonShare: '36%' },
};

// ─── AI Discovery — clusters detected in guest data ──────────────────────

type DiscoveryKind = 'Untapped Segment' | 'Expansion Opportunity' | 'Retention Risk' | 'New ICP Candidate';
interface Discovery {
  id: string;
  title: string;
  kind: DiscoveryKind;
  size: string;
  signal: string;
  recommendation: string;
  confidence: number;
}

const DISCOVERIES: Discovery[] = [
  { id: 'd1', title: 'Solo female wellness · DACH · 35-45 · short stays',   kind: 'Untapped Segment',      size: '47 guests',       signal: 'Distinct cluster in guest data · short LOS (3-4n) · high spa-spend · no German-language hero · last 12 months',          recommendation: 'Define new ICP "Solo Wellness EU" · DE-language funnel · 3-night offer with daily spa',                                            confidence: 88 },
  { id: 'd2', title: 'Returning guests bringing partner / friend',          kind: 'Expansion Opportunity', size: '31 of 373',       signal: 'Returning guests increasingly bring +1 within 18 months · ADR jumps when they do',                                          recommendation: 'Add "bring-a-friend" lead magnet · email sequence · 10% partner discount',                                                          confidence: 84 },
  { id: 'd3', title: 'Mystique Explorers dropping 0.4pp QoQ',               kind: 'Retention Risk',         size: '373 guests',       signal: 'Slowest-growing ICP · ADR strong · repeat low (7%) · cluster ages 55+ skewing higher',                                       recommendation: 'Refresh pillars · launch "Lao Heritage Walk" anchor experience · partner with cultural editors',                                    confidence: 71 },
  { id: 'd4', title: 'Japan-language travelers from Tokyo · 30-45',          kind: 'New ICP Candidate',     size: '12 guests',       signal: 'Small but high-quality cluster · 4.8/5 review · 0 JP-language assets · all sourced through Booking.com',                    recommendation: 'New ICP "JP Wellness Travelers" · Japanese-language pillar pages + ElevenLabs voiceover for reels',                                  confidence: 76 },
  { id: 'd5', title: 'Conscious Food guests with photography overlap',       kind: 'Expansion Opportunity', size: '78 of 497',       signal: 'Cluster intersects food + Mystique Explorers · high IG engagement on food + temple combo posts',                            recommendation: 'Add "Food + Heritage" hybrid offer · cross-promote in food + mystique reels',                                                       confidence: 79 },
  { id: 'd6', title: 'High-LTV silent dropouts · last 18 months',            kind: 'Retention Risk',         size: '23 guests',       signal: 'Top 5% LTV · stopped responding to email · last stay 12-18 months ago',                                                    recommendation: 'Manual outreach from CEO · personalized "we miss you" gesture · skip automated sequence',                                            confidence: 92 },
];

// ─── Agents ───────────────────────────────────────────────────────────────

interface IcpAgent { name: string; desc: string; signal: string }
const AGENTS: IcpAgent[] = [
  { name: 'Cluster Miner',         desc: 'Runs unsupervised clustering on guest.mv_guest_profile to surface natural segments.',          signal: '7 clusters' },
  { name: 'ICP Architect',         desc: 'Turns a cluster + sample guests into a structured ICP definition with pillars and channels.',  signal: '8 ICPs'     },
  { name: 'Performance Tracker',   desc: 'Per-ICP ADR · LOS · repeat · direct share · NPS. Detects drift week-over-week.',                signal: '17 dashes'  },
  { name: 'Discovery Radar',       desc: 'Surfaces untapped segments + expansion opportunities + retention risks.',                       signal: '6 signals'  },
  { name: 'Expansion Strategist',  desc: 'Models what would unlock the next ICP (language pages, pricing, campaigns).',                   signal: '4 plays'    },
  { name: 'Channel Mapper',        desc: 'Per-ICP, picks the right channels + ad formats + content pillars.',                             signal: '8 maps'     },
  { name: 'Brief Generator',       desc: 'Turns an ICP into briefs across Library · Funnels · Social · Influencers · Web cockpits.',     signal: '21 briefs'  },
  { name: 'Reality Check',         desc: 'Prevents ICPs from drifting into fiction. Ensures every ICP has real guests behind it.',        signal: '0 fictions' },
];

// ─── Component ────────────────────────────────────────────────────────────

const VIEW_LABEL: Record<View, string> = {
  roster:    '✦ ICP Roster',
  analytics: '◆ Analytics',
  discovery: '◉ AI Discovery',
  create:    '+ Create / Edit ICP',
  contacts:  '◐ Guest contacts',
};
const VIEWS: View[] = ['roster', 'analytics', 'discovery', 'create', 'contacts'];

export default function IcpCockpit({ view, liveCounts }: Props) {
  const totalIcps = ICPS.length;
  const scalingIcps = ICPS.filter((i) => i.status === 'Scaling').length;
  const emergingIcps = ICPS.filter((i) => i.status === 'Emerging').length;
  const atRiskIcps = ICPS.filter((i) => i.status === 'At Risk').length;
  const totalGuests = ICPS.reduce((s, i) => s + i.guestCount, 0);

  return (
    <>
      {/* KPI band */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        <KpiBox value={totalIcps}              unit="count" label="Active ICPs"          tooltip="Defined ICPs · roster" />
        <KpiBox value={scalingIcps}            unit="count" label="Scaling"              tooltip="ICPs growing QoQ" />
        <KpiBox value={emergingIcps}           unit="count" label="Emerging"             tooltip="ICPs being established" />
        <KpiBox value={liveCounts.totalProfiles} unit="count" label="Guest profiles · live" tooltip="guest.mv_guest_profile total" />
        <KpiBox value={totalGuests}            unit="count" label="ICP-mapped guests"    tooltip="Guests assigned to one of the defined ICPs" />
        <KpiBox value={DISCOVERIES.length}     unit="count" label="Discovery signals"    tooltip="AI Discovery candidates awaiting review" />
        <KpiBox value={atRiskIcps}             unit="count" label="At-risk ICPs"         state={atRiskIcps > 0 ? 'data-needed' : 'live'} needs={atRiskIcps > 0 ? 'action required' : undefined} />
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

      {view === 'roster'    && <RosterSection />}
      {view === 'analytics' && <AnalyticsSection />}
      {view === 'discovery' && <DiscoverySection />}
      {view === 'create'    && <CreateSection />}
      {/* contacts view renders below this component — handled in the page */}

      {/* Agents (always shown) */}
      {view !== 'contacts' && (
        <div style={{ marginTop: 14 }}>
          <Panel title="Agent fleet" eyebrow={`${AGENTS.length} ICP specialists`}>
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
      )}
    </>
  );
}

// ─── ROSTER ───────────────────────────────────────────────────────────────

function RosterSection() {
  return (
    <Panel
      title="ICP roster"
      eyebrow={`${ICPS.length} defined · pillars · channels · trend`}
      actions={<a href="?view=create" style={S.btnPrimary}>+ New ICP</a>}
    >
      <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
        {ICPS.map((icp) => (
          <div key={icp.id} style={S.icpCard}>
            <div style={S.icpHead}>
              <div>
                <span style={S.icpEmoji}>{icp.emoji}</span>
                <span style={S.icpName}>{icp.name}</span>
              </div>
              <span style={statusPill(icp.status)}>{icp.status}</span>
            </div>
            <div style={S.icpMeta}>{icp.cls} · {icp.markets} · age {icp.ageBand}</div>
            <div style={S.icpSizeRow}>
              <Stat label="Size" value={`${icp.size}%`} />
              <Stat label="Guests" value={icp.guestCount.toLocaleString('en-US')} />
              <Stat label="Trend" value={icp.trendPp} />
              <Stat label="Price" value={icp.pricePosition} />
            </div>
            <div style={S.icpPillars}>
              <span style={S.icpFieldLabel}>Pillars</span>
              <div style={S.icpTagRow}>
                {icp.pillars.map((p) => <span key={p} style={S.tagChip}>{p}</span>)}
              </div>
            </div>
            <div style={S.icpPillars}>
              <span style={S.icpFieldLabel}>Channels</span>
              <div style={S.icpTagRow}>
                {icp.channels.map((c) => <span key={c} style={S.tagChipBrass}>{c}</span>)}
              </div>
            </div>
            <div style={S.icpPillars}>
              <span style={S.icpFieldLabel}>Motivations</span>
              <div style={S.icpTagRow}>
                {icp.motivations.map((m) => <span key={m} style={S.tagChipMute}>{m}</span>)}
              </div>
            </div>
            <div style={S.icpActions}>
              <a href={`?view=analytics&icp=${icp.id}`} style={S.btnInlineSecondary}>📊 Analytics</a>
              <a href={`?view=create&icp=${icp.id}`} style={S.btnInlineSecondary}>✎ Edit</a>
              <a href={`?view=create&icp=${icp.id}&clone=1`} style={S.btnInlineSecondary}>⎘ Clone</a>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ─── ANALYTICS ────────────────────────────────────────────────────────────

function AnalyticsSection() {
  return (
    <Panel title="Per-ICP analytics" eyebrow="bookings · ADR · LOS · channels · repeat · NPS">
      <div style={{ padding: 14, overflowX: 'auto' }}>
        <table style={S.analyticsTable}>
          <thead>
            <tr>
              <th style={S.th}>ICP</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Bookings MTD</th>
              <th style={{ ...S.th, textAlign: 'right' }}>ADR</th>
              <th style={{ ...S.th, textAlign: 'right' }}>LOS</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Repeat</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Direct</th>
              <th style={S.th}>Top source</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Lead time</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Off-season</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Review</th>
            </tr>
          </thead>
          <tbody>
            {ICPS.map((icp) => {
              const p = PERF[icp.id];
              if (!p) return null;
              return (
                <tr key={icp.id} style={S.analyticsRow}>
                  <td style={S.tdIcp}><span style={S.icpEmojiInline}>{icp.emoji}</span>{icp.name}</td>
                  <td style={{ ...S.tdNum, fontWeight: 600 }}>{p.bookingsMtd}</td>
                  <td style={S.tdNum}>${p.adrUsd}</td>
                  <td style={S.tdNum}>{p.losNights}n</td>
                  <td style={S.tdNum}>{p.repeatRate}</td>
                  <td style={S.tdNum}>{p.directShare}</td>
                  <td style={S.tdMute}>{p.topSource}</td>
                  <td style={S.tdNum}>{p.leadTime}</td>
                  <td style={S.tdNum}>{p.offSeasonShare}</td>
                  <td style={{ ...S.tdNum, color: 'var(--st-good, #82ad8c)', fontWeight: 600 }}>{p.reviewScore}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ─── DISCOVERY ────────────────────────────────────────────────────────────

function DiscoverySection() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Panel title="AI Discovery · candidate signals" eyebrow={`${DISCOVERIES.length} signals · clusters · expansions · risks`}>
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {DISCOVERIES.map((d) => (
            <div key={d.id} style={S.discRow}>
              <div style={S.discHead}>
                <span style={S.discTitle}>{d.title}</span>
                <span style={discKindPill(d.kind)}>{d.kind}</span>
              </div>
              <div style={S.discMeta}>{d.size} · confidence <strong style={{ color: d.confidence >= 80 ? 'var(--st-good, #82ad8c)' : 'var(--st-warn, #C28F2C)' }}>{d.confidence}%</strong></div>
              <div style={S.discSignal}><span style={S.discLabel}>Signal</span>{d.signal}</div>
              <div style={S.discSignal}><span style={S.discLabel}>Recommendation</span>{d.recommendation}</div>
              <div style={S.discActions}>
                <button type="button" style={S.btnInlinePrimary}>✓ Promote to ICP</button>
                <button type="button" style={S.btnInlineSecondary}>✦ Generate brief</button>
                <button type="button" style={S.btnInlineSecondary}>📊 Drill into cluster</button>
                <button type="button" style={S.btnInlineSecondary}>⟶ Defer</button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ─── CREATE / EDIT ────────────────────────────────────────────────────────

function CreateSection() {
  return (
    <Panel title="ICP Creator" eyebrow="define · save · broadcast to library / funnels / social / influencers">
      <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 320px)', gap: 14, alignItems: 'start' }}>
        <form style={S.formWrap}>
          {/* Identity */}
          <Field label="Name">
            <input type="text" placeholder="e.g. Solo Wellness EU" style={S.input} />
          </Field>
          <Field label="Emoji + Class">
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="text" placeholder="✦" maxLength={2} style={{ ...S.input, width: 60 }} />
              <select style={{ ...S.select, flex: 1 }}>
                <option>B2C</option>
                <option>B2B</option>
                <option>B2B2C</option>
              </select>
            </div>
          </Field>

          <Field label="Markets · multi-select">
            <input type="text" placeholder="DACH · UK · NL · US · ..." style={S.input} />
          </Field>

          <Field label="Age band">
            <input type="text" placeholder="35-50" style={S.input} />
          </Field>

          <Field label="Price position">
            <select style={S.select}>
              <option>Luxury</option>
              <option>Premium</option>
              <option>Mid</option>
            </select>
          </Field>

          <Field label="Pillars · comma-separated">
            <textarea rows={2} placeholder="Morning Rituals, Spa Reset, Sleep, Quiet" style={S.textarea} />
          </Field>

          <Field label="Channels · comma-separated">
            <textarea rows={2} placeholder="IG, Pinterest, YouTube, Email" style={S.textarea} />
          </Field>

          <Field label="Motivations · what drives the booking">
            <textarea rows={2} placeholder="Reset, sleep, solo time, burnout recovery" style={S.textarea} />
          </Field>

          <Field label="Expected behaviors">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <input type="text" placeholder="ADR $" style={S.input} />
              <input type="text" placeholder="LOS nights" style={S.input} />
              <input type="text" placeholder="Repeat %" style={S.input} />
            </div>
          </Field>

          <Field label="Lead magnet · what they download first">
            <input type="text" placeholder="e.g. 5-Day Reset PDF · Luxury Anniversary Planner" style={S.input} />
          </Field>

          <div style={S.formActions}>
            <button type="button" style={S.btnPrimary}>✓ Save ICP</button>
            <button type="button" style={S.btnSecondary}>👁 Preview cards</button>
            <button type="button" style={S.btnSecondary}>✦ Broadcast to cockpits</button>
            <button type="button" style={S.btnSecondary}>⟶ Save draft</button>
          </div>
        </form>

        {/* Right rail — wizard help */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Panel title="What a good ICP looks like" eyebrow="checklist">
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Callout tone="brass"><strong>Specific.</strong> "Wellness travelers" is too vague. "EU Wellness Women · 35-50 · DACH · short stays · seeking reset" is usable.</Callout>
              <Callout tone="soft"><strong>Backed by data.</strong> Should have at least 50 real guests from the cluster — Reality Agent will flag empty ICPs.</Callout>
              <Callout tone="soft"><strong>Distinct.</strong> Should not overlap &gt;40% with another ICP. Use Discovery to verify cluster boundaries.</Callout>
              <Callout tone="warn"><strong>Actionable.</strong> Each ICP must map to specific channels + pillars + a lead magnet. Otherwise it's an audience, not an ICP.</Callout>
            </div>
          </Panel>

          <Panel title="On save · broadcast" eyebrow="cockpits that pick it up">
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <BroadcastRow label="Library"     desc="Coverage gap radar adds the new ICP row" />
              <BroadcastRow label="Funnels"     desc="Funnel proposals can target the ICP" />
              <BroadcastRow label="Social"      desc="Posts gain ICP option in the cockpit" />
              <BroadcastRow label="Influencers" desc="Ambassador-ICP mapping option" />
              <BroadcastRow label="Web"         desc="Funnel page generator can write for it" />
              <BroadcastRow label="Leads"       desc="Campaign can target ICP-fit B2B/B2C contacts" />
            </div>
          </Panel>
        </div>
      </div>
    </Panel>
  );
}

// ─── Atoms ────────────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={S.statLabel}>{label}</span>
      <span style={S.statValue}>{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={S.field}>
      <label style={S.fieldLabel}>{label}</label>
      {children}
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

function BroadcastRow({ label, desc }: { label: string; desc: string }) {
  return (
    <div style={S.broadcastRow}>
      <span style={S.broadcastDot} />
      <strong style={S.broadcastLabel}>{label}</strong>
      <span style={S.broadcastDesc}>{desc}</span>
    </div>
  );
}

// ─── Pills ────────────────────────────────────────────────────────────────

function statusPill(status: IcpDef['status']): React.CSSProperties {
  const c = status === 'Scaling'   ? 'var(--brass, #a8854a)' :
            status === 'Emerging'  ? 'var(--st-warn, #C28F2C)' :
            status === 'At Risk'   ? '#c97b6a' :
                                     'var(--text-mute, #9b907a)';
  return basePill(c);
}

function discKindPill(k: DiscoveryKind): React.CSSProperties {
  const c = k === 'Untapped Segment'      ? 'var(--brass, #a8854a)' :
            k === 'Expansion Opportunity' ? 'var(--text-2, #d8cca8)' :
            k === 'New ICP Candidate'     ? 'var(--st-warn, #C28F2C)' :
                                            '#c97b6a';
  return basePill(c);
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
  // Sub-strip
  subStrip: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid var(--border-1, #1f1c15)' },
  subStripLink: { padding: '6px 12px', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-mute, #9b907a)', border: '1px solid var(--border-1, #1f1c15)', borderRadius: 3, textDecoration: 'none', background: 'var(--surf-1, #0f0d0a)' },
  subStripLinkActive: { color: 'var(--surf-0, #0a0a0a)', background: 'var(--brass, #a8854a)', borderColor: 'var(--brass, #a8854a)', fontWeight: 700 },

  // ICP card
  icpCard: { background: 'var(--surf-1, #0f0d0a)', border: '1px solid var(--border-1, #1f1c15)', borderLeft: '3px solid var(--brass, #a8854a)', borderRadius: 6, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 },
  icpHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  icpEmoji: { fontSize: 'var(--t-lg)', color: 'var(--brass, #a8854a)', marginRight: 8 },
  icpEmojiInline: { fontSize: 'var(--t-md)', color: 'var(--brass, #a8854a)', marginRight: 6 },
  icpName: { fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: 'var(--t-md)', color: 'var(--text-0, #e9e1ce)', fontWeight: 500 },
  icpMeta: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.12em', color: 'var(--text-mute, #9b907a)' },
  icpSizeRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, borderTop: '1px solid var(--border-1, #1f1c15)', paddingTop: 8 },
  icpPillars: { display: 'flex', flexDirection: 'column', gap: 4 },
  icpFieldLabel: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-place, #5a5448)' },
  icpTagRow: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  icpActions: { display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid var(--border-1, #1f1c15)' },

  // Tag chips
  tagChip: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 9, letterSpacing: '0.10em', padding: '1px 5px', background: 'transparent', color: 'var(--text-1, #d8cca8)', border: '1px solid var(--border-1, #1f1c15)', borderRadius: 2 },
  tagChipBrass: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 9, letterSpacing: '0.10em', padding: '1px 5px', background: 'rgba(168,133,74,0.10)', color: 'var(--brass, #a8854a)', border: '1px solid var(--brass, #a8854a)', borderRadius: 2 },
  tagChipMute: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 9, letterSpacing: '0.10em', padding: '1px 5px', background: 'transparent', color: 'var(--text-mute, #9b907a)', border: '1px dashed var(--border-1, #1f1c15)', borderRadius: 2 },

  // Stats
  statLabel: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-place, #5a5448)' },
  statValue: { fontSize: 'var(--t-sm)', fontWeight: 600, color: 'var(--text-0, #e9e1ce)', fontVariantNumeric: 'tabular-nums' },

  // Analytics
  analyticsTable: { width: '100%', borderCollapse: 'collapse', fontSize: 'var(--t-sm)' },
  th: { padding: '8px 8px', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--brass, #a8854a)', borderBottom: '1px solid var(--border-1, #1f1c15)', whiteSpace: 'nowrap', textAlign: 'left' },
  analyticsRow: { borderBottom: '1px solid var(--border-1, #1f1c15)' },
  tdIcp: { padding: '8px 8px', color: 'var(--text-0, #e9e1ce)', fontWeight: 500 },
  tdNum: { padding: '8px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-1, #d8cca8)' },
  tdMute: { padding: '8px 8px', color: 'var(--text-mute, #9b907a)', fontSize: 'var(--t-xs)' },

  // Discovery
  discRow: { background: 'var(--surf-1, #0f0d0a)', border: '1px solid var(--border-1, #1f1c15)', borderLeft: '3px solid var(--st-warn, #C28F2C)', borderRadius: 6, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 },
  discHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  discTitle: { fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: 'var(--t-md)', color: 'var(--text-0, #e9e1ce)' },
  discMeta: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.12em', color: 'var(--text-mute, #9b907a)' },
  discSignal: { display: 'grid', gridTemplateColumns: '110px 1fr', gap: 8, fontSize: 'var(--t-sm)', lineHeight: 1.5, color: 'var(--text-1, #d8cca8)' },
  discLabel: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-place, #5a5448)' },
  discActions: { display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 4 },

  // Create form
  formWrap: { display: 'flex', flexDirection: 'column', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  fieldLabel: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--brass, #a8854a)' },
  input: { padding: '8px 10px', fontFamily: "'Inter Tight', system-ui, sans-serif", fontSize: 'var(--t-sm)', color: 'var(--text-0, #e9e1ce)', background: 'var(--surf-1, #0f0d0a)', border: '1px solid var(--border-1, #1f1c15)', borderRadius: 4 },
  textarea: { padding: '8px 10px', fontFamily: "'Inter Tight', system-ui, sans-serif", fontSize: 'var(--t-sm)', color: 'var(--text-0, #e9e1ce)', background: 'var(--surf-1, #0f0d0a)', border: '1px solid var(--border-1, #1f1c15)', borderRadius: 4, resize: 'vertical', lineHeight: 1.4 },
  select: { padding: '8px 10px', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-sm)', color: 'var(--text-0, #e9e1ce)', background: 'var(--surf-1, #0f0d0a)', border: '1px solid var(--border-1, #1f1c15)', borderRadius: 4 },
  formActions: { display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid var(--border-1, #1f1c15)' },

  // Broadcast rows
  broadcastRow: { display: 'flex', alignItems: 'baseline', gap: 8 },
  broadcastDot: { width: 6, height: 6, borderRadius: '50%', background: 'var(--brass, #a8854a)' },
  broadcastLabel: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--brass, #a8854a)' },
  broadcastDesc: { fontSize: 'var(--t-xs)', color: 'var(--text-mute, #9b907a)' },

  // Agents
  agentCard: { background: 'var(--surf-1, #0f0d0a)', border: '1px solid var(--border-1, #1f1c15)', borderRadius: 6, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 },
  agentHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  agentName: { fontSize: 'var(--t-sm)', fontWeight: 600, color: 'var(--text-0, #e9e1ce)' },
  agentDesc: { fontSize: 'var(--t-xs)', lineHeight: 1.5, color: 'var(--text-mute, #9b907a)', minHeight: 54 },
  signalPill: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--brass, #a8854a)', border: '1px solid var(--brass, #a8854a)', padding: '1px 5px', borderRadius: 3 },

  // Buttons
  btnPrimary: { background: 'var(--brass, #a8854a)', color: 'var(--surf-0, #0a0a0a)', border: '1px solid var(--brass, #a8854a)', padding: '5px 12px', borderRadius: 3, cursor: 'pointer', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, textDecoration: 'none' },
  btnSecondary: { background: 'transparent', color: 'var(--text-1, #d8cca8)', border: '1px solid var(--border-1, #1f1c15)', padding: '5px 12px', borderRadius: 3, cursor: 'pointer', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.12em', textTransform: 'uppercase' },
  btnInlinePrimary: { background: 'var(--brass, #a8854a)', color: 'var(--surf-0, #0a0a0a)', border: '1px solid var(--brass, #a8854a)', padding: '3px 8px', borderRadius: 3, cursor: 'pointer', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 600, textDecoration: 'none' },
  btnInlineSecondary: { background: 'transparent', color: 'var(--text-1, #d8cca8)', border: '1px solid var(--border-1, #1f1c15)', padding: '3px 8px', borderRadius: 3, cursor: 'pointer', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.10em', textTransform: 'uppercase', textDecoration: 'none' },
};
