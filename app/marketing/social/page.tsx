// app/marketing/social/page.tsx
//
// PBS 2026-05-16 (v2): AI Social Cockpit — *agency workflow*. The first
// version was a brochure. This one is the machine. Five inner sections
// switched via ?view=:
//
//   calendar  · the planning room — 30/60/90 toggle + channel dropdown
//   flow      · concept → publish pipeline (Idea → Brief → Generate →
//               Reality → Approve → Schedule → Publish)
//   channels  · per-channel inventory · growth · best post · autonomy
//               phase · guardrails (LIVE marketing.social_accounts data)
//   boost     · AI-proposed paid-boost candidates with budget + projected
//               reach + cost-per-engagement
//   inbox     · approval queue + reality flags
//
// Default = calendar so PBS lands in the planning view.

import type { ReactNode } from 'react';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import { getSocialAccounts } from '@/lib/marketing';
import { MARKETING_SUBPAGES } from '../_subpages';
import TabStrip, { SOCIAL_TABS } from '@/app/finance/_components/TabStrip';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

// ─── Platforms ────────────────────────────────────────────────────────────

const PLATFORMS = ['instagram', 'pinterest', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads', 'x'] as const;
type Platform = (typeof PLATFORMS)[number];

const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: 'Instagram', pinterest: 'Pinterest', tiktok: 'TikTok', youtube: 'YouTube',
  facebook: 'Facebook',   linkedin: 'LinkedIn',   threads: 'Threads', x: 'X / Twitter',
};
const PLATFORM_GLYPH: Record<Platform, string> = {
  instagram: 'IG', pinterest: 'PI', tiktok: 'TT', youtube: 'YT',
  facebook: 'FB', linkedin: 'LI', threads: 'TH', x: 'X',
};

// ─── ICPs ─────────────────────────────────────────────────────────────────

interface Icp { name: string; market: string; emoji: string; pillars: string[]; activePosts: number }
const ICPS: Icp[] = [
  { name: 'EU Wellness Women',    market: 'DACH · UK · NL',    emoji: '✦', pillars: ['Morning Rituals', 'Spa Reset', 'Full Moon'], activePosts: 18 },
  { name: 'Luxury Couples',       market: 'EU · US · AU',      emoji: '◆', pillars: ['Privacy', 'Romance', 'Candle Dinners'],      activePosts: 12 },
  { name: 'Conscious Food',       market: 'US · EU · Asia',    emoji: '◉', pillars: ['Herb Garden', 'Local Chefs', 'Foraging'],    activePosts: 14 },
  { name: 'Mystique Explorers',   market: 'US · AU · EU',      emoji: '◐', pillars: ['Temples', 'Monastic Rituals', 'River'],      activePosts: 9  },
  { name: 'Digital Detox EU',     market: 'DACH · UK',         emoji: '◇', pillars: ['Quiet', 'River Silence', 'Tech-free'],       activePosts: 7  },
  { name: 'Asia Source Markets',  market: 'TH · CN · JP · KR', emoji: '✺', pillars: ['Wellness', 'Cultural Heritage', 'Lao Cuisine'], activePosts: 11 },
  { name: 'Yoga Teachers · B2B',  market: 'EU · US',           emoji: '✿', pillars: ['Host your retreat', 'Group rates'],          activePosts: 5  },
];

// ─── Proposed posts (90 days · realistic spread) ─────────────────────────

type PostStatus = 'Draft' | 'Awaiting Approval' | 'Approved' | 'Scheduled' | 'Reality Flag' | 'Published';
type Format = 'Reel' | 'YT Short' | 'YT Long' | 'Photo' | 'Carousel' | 'Story';

interface ProposedPost {
  iso: string;
  platform: Platform;
  format: Format;
  icp: string;
  brief: string;
  hook: string;
  status: PostStatus;
  reach?: number; // for Published
  saves?: number;
  engagement?: string;
}

function addDaysIso(baseIso: string, days: number): string {
  const d = new Date(baseIso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Compact list — Phase 2 reads from social_ai.posts.
function buildProposedPosts(): ProposedPost[] {
  const todayIso = new Date().toISOString().slice(0, 10);
  // Posts spanning -10 (Published, has metrics) → +85 days. Roughly 2/day spread,
  // tilted toward IG + Pinterest as core channels.
  const seeds: Array<Omit<ProposedPost, 'iso'> & { offset: number }> = [
    // ─ PAST 10 DAYS (Published with metrics)
    { offset: -10, platform: 'instagram', format: 'Reel',     icp: 'EU Wellness Women',   brief: '4am river silence',           hook: 'Why monks sweep at 4am',         status: 'Published', reach: 38_200, saves: 1240, engagement: '8.4%' },
    { offset:  -9, platform: 'pinterest', format: 'Photo',    icp: 'EU Wellness Women',   brief: 'Spa massage · brass + linen', hook: 'A ritual older than Europe',     status: 'Published', reach: 22_400, saves:  890, engagement: '6.1%' },
    { offset:  -7, platform: 'tiktok',    format: 'Reel',     icp: 'Luxury Couples',      brief: 'Candle dinner on the deck',   hook: 'Found the only river restaurant', status: 'Published', reach: 91_300, saves: 2780, engagement: '11.2%' },
    { offset:  -6, platform: 'youtube',   format: 'YT Short', icp: 'Mystique Explorers',  brief: '60s walk through Wat Xieng',  hook: '4am temple sweep',               status: 'Published', reach: 14_800, saves:  340, engagement: '5.2%' },
    { offset:  -4, platform: 'instagram', format: 'Carousel', icp: 'Conscious Food',      brief: '6-card foraging trip',        hook: 'Galangal harvest at dawn',       status: 'Published', reach: 28_900, saves: 1480, engagement: '9.7%' },
    { offset:  -3, platform: 'pinterest', format: 'Photo',    icp: 'Mystique Explorers',  brief: 'Saffron robes · golden hour', hook: 'Quiet wonder',                   status: 'Published', reach: 19_200, saves:  720, engagement: '5.8%' },
    { offset:  -2, platform: 'youtube',   format: 'YT Long',  icp: 'Conscious Food',      brief: '8-min farm-to-table docu',    hook: 'Where dinner walks before dawn', status: 'Published', reach: 42_100, saves: 1850, engagement: '12.4%' },
    { offset:  -1, platform: 'instagram', format: 'Reel',     icp: 'Digital Detox EU',    brief: 'Phone in a drawer 3 days',    hook: 'Your brain on no Wi-Fi',         status: 'Published', reach: 31_700, saves:  990, engagement: '7.9%' },

    // ─ NEXT 30 DAYS (mix of statuses)
    { offset:  1, platform: 'instagram', format: 'Reel',     icp: 'EU Wellness Women',  brief: 'Spa morning prep · BTS',          hook: 'Spa morning prep',                              status: 'Awaiting Approval' },
    { offset:  1, platform: 'pinterest', format: 'Photo',    icp: 'EU Wellness Women',  brief: 'Brass coffee service still',      hook: 'Slow mornings still exist',                     status: 'Scheduled' },
    { offset:  2, platform: 'tiktok',    format: 'Reel',     icp: 'Luxury Couples',     brief: 'Sunset boat ride · slow-mo',      hook: 'One boat, one couple, one river',               status: 'Approved' },
    { offset:  2, platform: 'youtube',   format: 'YT Short', icp: 'Mystique Explorers', brief: 'Almsgiving ceremony 60s',         hook: '4am gold of Luang Prabang',                     status: 'Draft' },
    { offset:  3, platform: 'instagram', format: 'Carousel', icp: 'Conscious Food',     brief: '6-card herb-garden trip',         hook: 'Wild ginger at 6am',                            status: 'Awaiting Approval' },
    { offset:  3, platform: 'pinterest', format: 'Photo',    icp: 'Luxury Couples',     brief: 'Suite balcony · sunset',          hook: "A view that doesn't exist on Booking.com",     status: 'Scheduled' },
    { offset:  4, platform: 'tiktok',    format: 'Reel',     icp: 'Digital Detox EU',   brief: '3-day phone-fast testimonial',    hook: 'I left my phone in Frankfurt',                  status: 'Awaiting Approval' },
    { offset:  4, platform: 'instagram', format: 'Reel',     icp: 'EU Wellness Women',  brief: 'Herbal tea morning ritual',       hook: 'Morning silence is the new luxury',             status: 'Reality Flag' },
    { offset:  5, platform: 'youtube',   format: 'YT Long',  icp: 'Conscious Food',     brief: '12-min foraging documentary',     hook: 'Where the chef walks at dawn',                  status: 'Draft' },
    { offset:  6, platform: 'instagram', format: 'Reel',     icp: 'Asia Source Markets',brief: 'Songkran water blessing · TH VO', hook: 'น้ำพร — water blessing in Laos',               status: 'Awaiting Approval' },
    { offset:  6, platform: 'linkedin',  format: 'Photo',    icp: 'Yoga Teachers · B2B',brief: 'Host-your-retreat deck cover',     hook: 'A 7-room retreat is easier than you think',     status: 'Approved' },
    { offset:  7, platform: 'tiktok',    format: 'Reel',     icp: 'EU Wellness Women',  brief: 'Full moon ceremony montage',       hook: 'The moon over the Namkhan',                     status: 'Scheduled' },
    { offset:  8, platform: 'instagram', format: 'Story',    icp: 'EU Wellness Women',  brief: 'Spa product still-life · brass',   hook: "Ingredients we don't hide",                     status: 'Approved' },
    { offset:  9, platform: 'pinterest', format: 'Photo',    icp: 'Conscious Food',     brief: 'Fermentation jars · clay + brass', hook: 'Slow fermentation, fast taste',                 status: 'Scheduled' },
    { offset: 10, platform: 'tiktok',    format: 'Reel',     icp: 'Digital Detox EU',   brief: 'Hammock + river + silence',        hook: '3 minutes of nothing',                          status: 'Approved' },
    { offset: 11, platform: 'instagram', format: 'Reel',     icp: 'Luxury Couples',     brief: 'Brass coffee service slow-mo',     hook: 'Slow mornings still exist',                     status: 'Scheduled' },
    { offset: 12, platform: 'youtube',   format: 'YT Long',  icp: 'Mystique Explorers', brief: '12-min heritage walk',             hook: 'A living UNESCO museum',                        status: 'Draft' },
    { offset: 14, platform: 'facebook',  format: 'Carousel', icp: 'Asia Source Markets',brief: 'Lao culinary trail · 8 stops',     hook: '8 dishes you only find here',                   status: 'Approved' },
    { offset: 16, platform: 'instagram', format: 'Carousel', icp: 'Luxury Couples',     brief: 'Anniversary package · 8 cards',    hook: "The 10-year anniversary that wasn't Paris",     status: 'Scheduled' },
    { offset: 18, platform: 'youtube',   format: 'YT Short', icp: 'Asia Source Markets',brief: 'JP-narrated welcome ritual',       hook: 'ラオスの朝',                                    status: 'Awaiting Approval' },
    { offset: 19, platform: 'instagram', format: 'Reel',     icp: 'EU Wellness Women',  brief: 'Sound bath under stars',           hook: 'Silence is a sound too',                        status: 'Approved' },
    { offset: 20, platform: 'tiktok',    format: 'Reel',     icp: 'Mystique Explorers', brief: 'Lao alphabet hand-lettering',      hook: 'How Lao writes the river',                      status: 'Scheduled' },
    { offset: 22, platform: 'pinterest', format: 'Photo',    icp: 'EU Wellness Women',  brief: 'Yoga deck overlooking the river',  hook: 'A studio without walls',                        status: 'Scheduled' },
    { offset: 24, platform: 'instagram', format: 'Reel',     icp: 'Digital Detox EU',   brief: '24h off-grid guest log',           hook: 'What I did without a phone',                    status: 'Approved' },
    { offset: 27, platform: 'instagram', format: 'Reel',     icp: 'EU Wellness Women',  brief: 'Spa product · brass + linen',      hook: "Ingredients we don't hide",                     status: 'Awaiting Approval' },

    // ─ DAYS 30-60
    { offset: 32, platform: 'instagram', format: 'Reel',     icp: 'Luxury Couples',     brief: 'Private river dinner',            hook: 'One table, one river, one night',               status: 'Draft' },
    { offset: 35, platform: 'pinterest', format: 'Photo',    icp: 'Conscious Food',     brief: 'Garden harvest still-life',        hook: 'Today\'s dinner walked at sunrise',             status: 'Draft' },
    { offset: 38, platform: 'tiktok',    format: 'Reel',     icp: 'Mystique Explorers', brief: 'Monk almsgiving extended cut',      hook: 'The 4am gold extended',                         status: 'Draft' },
    { offset: 41, platform: 'youtube',   format: 'YT Long',  icp: 'EU Wellness Women',  brief: '15-min retreat-day documentary',    hook: 'A day at the Namkhan',                          status: 'Draft' },
    { offset: 45, platform: 'instagram', format: 'Carousel', icp: 'Asia Source Markets',brief: 'Lao-script hospitality cards · TH', hook: 'Hospitality in Lao',                            status: 'Draft' },
    { offset: 49, platform: 'instagram', format: 'Reel',     icp: 'Digital Detox EU',   brief: 'Sunrise without alarms',           hook: 'The body still knows',                          status: 'Draft' },
    { offset: 52, platform: 'linkedin',  format: 'Photo',    icp: 'Yoga Teachers · B2B',brief: 'Retreat layout · floorplan',        hook: 'How 14 retreats ran here last year',            status: 'Draft' },
    { offset: 56, platform: 'pinterest', format: 'Photo',    icp: 'Luxury Couples',     brief: 'Candle-lit suite at dusk',          hook: 'A room that knows the river',                   status: 'Draft' },

    // ─ DAYS 60-90
    { offset: 62, platform: 'instagram', format: 'Reel',     icp: 'EU Wellness Women',  brief: 'Spa ritual chain · slow',          hook: 'Six rituals in one morning',                    status: 'Draft' },
    { offset: 66, platform: 'youtube',   format: 'YT Short', icp: 'Mystique Explorers', brief: 'Sunset boat on the Nam Khan',       hook: 'Where the river turns gold',                    status: 'Draft' },
    { offset: 70, platform: 'pinterest', format: 'Photo',    icp: 'Conscious Food',     brief: 'Wild-honey breakfast still',        hook: 'Honey from the temple beekeeper',                status: 'Draft' },
    { offset: 75, platform: 'instagram', format: 'Carousel', icp: 'Luxury Couples',     brief: 'Anniversary package · refined',     hook: "An anniversary worth telling",                  status: 'Draft' },
    { offset: 80, platform: 'facebook',  format: 'Carousel', icp: 'Asia Source Markets',brief: 'Wellness in Lao · TH-narrated',     hook: 'การพักผ่อนแบบลาว',                              status: 'Draft' },
  ];
  return seeds.map((s) => ({ iso: addDaysIso(todayIso, s.offset), ...s }));
}

const ALL_POSTS = buildProposedPosts();

// ─── Channel inventory metadata (per-channel growth + best post + autonomy) ──

interface ChannelMeta {
  platform: Platform;
  followers: number;
  growth30d: string;
  engagementRate: string;
  postsMtd: number;
  bestPost: { hook: string; reach: number; engagement: string };
  autonomyPhase: 'A' | 'B' | 'C';
  frequencyCap: string;
  bannedTopics: string[];
}

const CHANNEL_META: Record<Platform, ChannelMeta> = {
  instagram: { platform: 'instagram', followers: 28_400, growth30d: '+4.8%', engagementRate: '7.2%', postsMtd: 14, bestPost: { hook: 'Why monks sweep at 4am', reach: 38_200, engagement: '8.4%' }, autonomyPhase: 'A', frequencyCap: 'max 1/day · min 18h gap', bannedTopics: ['political', 'religious commentary'] },
  pinterest: { platform: 'pinterest', followers:  6_900, growth30d: '+18.4%', engagementRate: '6.1%', postsMtd: 22, bestPost: { hook: 'A ritual older than Europe', reach: 22_400, engagement: '6.1%' }, autonomyPhase: 'B', frequencyCap: 'max 3/day',          bannedTopics: ['none'] },
  tiktok:    { platform: 'tiktok',    followers: 11_200, growth30d: '+12.1%', engagementRate: '11.2%', postsMtd: 8, bestPost: { hook: 'Found the only river restaurant', reach: 91_300, engagement: '11.2%' }, autonomyPhase: 'A', frequencyCap: 'max 1/day',          bannedTopics: ['trend lip-sync · off-brand'] },
  youtube:   { platform: 'youtube',   followers:  4_800, growth30d: '+6.2%',  engagementRate: '5.8%',  postsMtd: 4, bestPost: { hook: 'Where dinner walks before dawn', reach: 42_100, engagement: '12.4%' }, autonomyPhase: 'A', frequencyCap: 'max 2 shorts + 1 long/wk', bannedTopics: ['unscripted talking-head'] },
  facebook:  { platform: 'facebook',  followers: 18_700, growth30d: '+0.4%',  engagementRate: '1.8%',  postsMtd: 6, bestPost: { hook: '8 dishes you only find here', reach: 12_400, engagement: '2.1%' }, autonomyPhase: 'B', frequencyCap: 'max 3/wk',          bannedTopics: ['none'] },
  linkedin:  { platform: 'linkedin',  followers:  1_200, growth30d: '+11.0%', engagementRate: '4.4%',  postsMtd: 5, bestPost: { hook: 'A 7-room retreat is easier than you think', reach: 6_200, engagement: '5.7%' }, autonomyPhase: 'A', frequencyCap: 'max 2/wk',          bannedTopics: ['leisure tone'] },
  threads:   { platform: 'threads',   followers:    480, growth30d: '+62.0%', engagementRate: '9.4%',  postsMtd: 9, bestPost: { hook: 'Slow mornings still exist', reach: 3_400, engagement: '9.4%' }, autonomyPhase: 'C', frequencyCap: 'max 3/day',          bannedTopics: ['none'] },
  x:         { platform: 'x',         followers:    310, growth30d: '+1.2%',  engagementRate: '0.9%',  postsMtd: 0, bestPost: { hook: '—', reach: 0, engagement: '—' }, autonomyPhase: 'A', frequencyCap: 'paused',         bannedTopics: ['all · channel paused'] },
};

// ─── Boost & promote candidates ───────────────────────────────────────────

interface BoostCandidate {
  hook: string;
  platform: Platform;
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
  { hook: 'Found the only river restaurant',       platform: 'tiktok',    organicReach: 91_300, organicEngagement: '11.2%', signal: 'Top 1% organic · viral coefficient 1.4 · 312 shares', proposedBudget: '$240 · 7 days',  projectedReach: '480k–720k',  projectedCpe: '$0.04', icp: 'Luxury Couples',    verdict: 'Strong Boost' },
  { hook: 'Where dinner walks before dawn',        platform: 'youtube',   organicReach: 42_100, organicEngagement: '12.4%', signal: 'Top 5% YT · long retention (74%) · saves up',           proposedBudget: '$180 · TrueView', projectedReach: '95k–140k',   projectedCpe: '$0.18', icp: 'Conscious Food',    verdict: 'Strong Boost' },
  { hook: 'Why monks sweep at 4am',                platform: 'instagram', organicReach: 38_200, organicEngagement: '8.4%',  signal: 'Saves climbing · DM intent · 4 booking clicks',         proposedBudget: '$120 · 5 days',  projectedReach: '180k–260k',  projectedCpe: '$0.07', icp: 'EU Wellness Women', verdict: 'Strong Boost' },
  { hook: 'Galangal harvest at dawn',              platform: 'instagram', organicReach: 28_900, organicEngagement: '9.7%',  signal: 'Strong saves · weak DMs · needs CTA tweak',             proposedBudget: '$80 · A/B test',  projectedReach: '90k–130k',   projectedCpe: '$0.09', icp: 'Conscious Food',    verdict: 'Moderate Boost' },
  { hook: 'Your brain on no Wi-Fi',                platform: 'instagram', organicReach: 31_700, organicEngagement: '7.9%',  signal: 'High reach · low booking-page clicks',                  proposedBudget: '—',               projectedReach: '—',           projectedCpe: '—',     icp: 'Digital Detox EU',  verdict: 'Test First' },
  { hook: 'A ritual older than Europe',            platform: 'pinterest', organicReach: 22_400, organicEngagement: '6.1%',  signal: 'Steady saves · evergreen — boost as Idea Pin',          proposedBudget: '$60 · evergreen', projectedReach: '120k–180k',  projectedCpe: '$0.05', icp: 'EU Wellness Women', verdict: 'Moderate Boost' },
];

// ─── Concept flow pipeline (Kanban-style columns) ─────────────────────────

interface ConceptCard { hook: string; platform: Platform; format: Format; icp: string; column: ConceptColumn }
type ConceptColumn = 'Idea' | 'Briefed' | 'Generated' | 'Reality-checked' | 'Approved' | 'Scheduled';

const CONCEPT_CARDS: ConceptCard[] = [
  { hook: 'Monsoon arrives — green explosion',        platform: 'instagram', format: 'Reel',     icp: 'EU Wellness Women',   column: 'Idea' },
  { hook: 'Bee-keeper monk at sunrise',               platform: 'youtube',   format: 'YT Short', icp: 'Mystique Explorers',  column: 'Idea' },
  { hook: 'Solo female detox — 5 days',               platform: 'tiktok',    format: 'Reel',     icp: 'Digital Detox EU',    column: 'Idea' },
  { hook: 'Why monks sweep at 4am',                   platform: 'instagram', format: 'Reel',     icp: 'EU Wellness Women',   column: 'Briefed' },
  { hook: 'Galangal harvest at dawn',                 platform: 'instagram', format: 'Carousel', icp: 'Conscious Food',      column: 'Briefed' },
  { hook: '5am river silence',                        platform: 'instagram', format: 'Reel',     icp: 'EU Wellness Women',   column: 'Generated' },
  { hook: 'Found the only river restaurant',          platform: 'tiktok',    format: 'Reel',     icp: 'Luxury Couples',      column: 'Generated' },
  { hook: 'Morning silence is the new luxury',        platform: 'instagram', format: 'Reel',     icp: 'EU Wellness Women',   column: 'Reality-checked' },
  { hook: 'น้ำพร — water blessing',                   platform: 'instagram', format: 'Reel',     icp: 'Asia Source Markets', column: 'Reality-checked' },
  { hook: 'A 7-room retreat is easier than you think',platform: 'linkedin',  format: 'Photo',    icp: 'Yoga Teachers · B2B', column: 'Approved' },
  { hook: 'Spa morning prep',                         platform: 'instagram', format: 'Story',    icp: 'EU Wellness Women',   column: 'Approved' },
  { hook: 'Slow mornings still exist',                platform: 'instagram', format: 'Reel',     icp: 'Luxury Couples',      column: 'Scheduled' },
  { hook: '3 minutes of nothing',                     platform: 'tiktok',    format: 'Reel',     icp: 'Digital Detox EU',    column: 'Scheduled' },
];
const CONCEPT_COLUMNS: ConceptColumn[] = ['Idea', 'Briefed', 'Generated', 'Reality-checked', 'Approved', 'Scheduled'];

// ─── Workflow + Agents ────────────────────────────────────────────────────

const LOOP: { step: string; title: string; desc: string }[] = [
  { step: '01', title: 'ICP Signal',    desc: 'Map ICP needs · season · markets. What audience needs what story?' },
  { step: '02', title: 'Trend Watch',   desc: 'Scan Pinterest · IG · TikTok · YT trends + Google Trends + ours.'    },
  { step: '03', title: 'Brief',         desc: 'Pillar + hook + CTA + format + language + posting time + ICP.'       },
  { step: '04', title: 'Generate',      desc: 'Copy + visual + reel + YT short/long · multilingual variants.'       },
  { step: '05', title: 'Reality Check', desc: 'Brand-fit + factual + visual fidelity. Flag for human review.'        },
  { step: '06', title: 'Approve',       desc: 'Human signs off · approve · revise · reject. Autonomy threshold rules.' },
  { step: '07', title: 'Schedule',      desc: 'Calendar + platform · auto-publish at intent-time per ICP timezone.'  },
  { step: '08', title: 'Analyze',       desc: 'Reach · saves · DMs · clicks · bookings → refines next-batch brief.'  },
];

interface SocialAgent { name: string; desc: string; signal: string }
const AGENTS: SocialAgent[] = [
  { name: 'ICP Signal',         desc: 'Maps each ICP to seasonal needs, target keywords and platform fit.',                signal: '7 ICPs' },
  { name: 'Trend Scout',        desc: 'Pinterest · IG · TikTok · YouTube + Google Trends radar. Emerging hooks.',         signal: '23 hooks' },
  { name: 'Content Strategist', desc: 'Designs pillar + hook + CTA + format · turns trend into a brief.',                  signal: '42 briefs' },
  { name: 'Caption Writer',     desc: 'Multilingual captions + hashtags + alt-text (EN · DE · ES · LO · TH · JP).',         signal: '128 drafts' },
  { name: 'Visual Director',    desc: 'Briefs visuals · selects from Library or commissions new shoot/render.',             signal: '36 visuals' },
  { name: 'Reel Generator',     desc: 'Builds short-form reels with voiceover, captions, music + cuts.',                    signal: '12 reels' },
  { name: 'Video Producer',     desc: 'YouTube long-form · 8-15 min documentary cuts · multilingual subtitle pass.',        signal: '4 in edit' },
  { name: 'Photo Curator',      desc: 'Pulls from media library · matches ICP + intent · de-duplicates.',                   signal: '218 stills' },
  { name: 'Hashtag Agent',      desc: 'Per-platform hashtag set · trending + niche + branded · localized.',                 signal: '64 sets' },
  { name: 'Reality & Brand',    desc: 'Fact-check claims · visual reality · SLH/considerate brand-fit gate.',               signal: '8 flags' },
  { name: 'Boost Strategist',   desc: 'Picks organic winners and proposes paid budget · projected reach · CPE.',            signal: '6 candidates' },
  { name: 'Scheduler',          desc: 'Calendar + auto-publish · platform API + retry logic + timezone-aware.',             signal: '84 in queue' },
  { name: 'Analytics',          desc: 'Reach · saves · DMs · clicks · bookings · refines next brief.',                      signal: '17 dashes' },
];

// ─── Section sub-navigation ───────────────────────────────────────────────

type View = 'calendar' | 'flow' | 'channels' | 'boost' | 'inbox';
const VIEW_LABEL: Record<View, string> = {
  calendar: '📅 Calendar',
  flow:     '⚡ Concept Flow',
  channels: '🌐 Channels',
  boost:    '🚀 Boost & Promote',
  inbox:    '✓ Approval Inbox',
};
const VIEWS: View[] = ['calendar', 'flow', 'channels', 'boost', 'inbox'];

function parseView(v: string | string[] | undefined): View {
  const s = typeof v === 'string' ? v : 'calendar';
  return (VIEWS as string[]).includes(s) ? (s as View) : 'calendar';
}

function parseChannelFilter(v: string | string[] | undefined): Platform | 'all' {
  const s = typeof v === 'string' ? v : 'all';
  return (PLATFORMS as readonly string[]).includes(s) ? (s as Platform) : 'all';
}

type Window = 30 | 60 | 90;
function parseWindow(v: string | string[] | undefined): Window {
  const n = Number(typeof v === 'string' ? v : 30);
  return (n === 60 || n === 90) ? n : 30;
}

// ─── Page ─────────────────────────────────────────────────────────────────

interface Props { searchParams?: { view?: string; ch?: string; w?: string } }

export default async function SocialPage({ searchParams }: Props) {
  const view = parseView(searchParams?.view);
  const channelFilter = parseChannelFilter(searchParams?.ch);
  const windowDays: Window = parseWindow(searchParams?.w);

  // Live channel rows from marketing.social_accounts
  const allAccounts = await getSocialAccounts();
  const dbByPlatform = new Map<string, any>();
  for (const a of allAccounts) dbByPlatform.set(String(a.platform).toLowerCase(), a);

  const todayIso = new Date().toISOString().slice(0, 10);

  // KPI math
  const awaiting    = ALL_POSTS.filter((p) => p.status === 'Awaiting Approval').length;
  const scheduled   = ALL_POSTS.filter((p) => p.status === 'Scheduled' || p.status === 'Approved').length;
  const publishedLast30 = ALL_POSTS.filter((p) => p.status === 'Published').length;
  const reach30d    = ALL_POSTS.filter((p) => p.status === 'Published').reduce((s, p) => s + (p.reach ?? 0), 0);
  const engAvg      = 8.3;
  const realityFlags = ALL_POSTS.filter((p) => p.status === 'Reality Flag').length;

  return (
    <Page
      eyebrow="Marketing · Social"
      title={<>AI Social <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>cockpit</em></>}
      subPages={MARKETING_SUBPAGES}
    >
      <TabStrip tabs={SOCIAL_TABS} activeKey="social" />

      {/* ─── KPI band (always visible) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        <KpiBox value={awaiting}          unit="count" label="Awaiting Approval" />
        <KpiBox value={scheduled}         unit="count" label="Scheduled · 90d"    />
        <KpiBox value={publishedLast30}   unit="count" label="Published · 30d"    />
        <KpiBox value={reach30d}          unit="count" label="Reach · 30d"        />
        <KpiBox value={engAvg}            unit="pct"   label="Engagement · avg"   />
        <KpiBox value={realityFlags}      unit="count" label="Reality Flags"  state={realityFlags > 0 ? 'live' : 'live'} />
      </div>

      {/* ─── Inner section nav ─── */}
      <SectionStrip active={view} />

      {/* ─── SECTION: Calendar ─── */}
      {view === 'calendar' && (
        <CalendarView
          posts={ALL_POSTS}
          todayIso={todayIso}
          windowDays={windowDays}
          channelFilter={channelFilter}
        />
      )}

      {/* ─── SECTION: Concept Flow ─── */}
      {view === 'flow' && <ConceptFlowView />}

      {/* ─── SECTION: Channels ─── */}
      {view === 'channels' && <ChannelsView dbByPlatform={dbByPlatform} />}

      {/* ─── SECTION: Boost & Promote ─── */}
      {view === 'boost' && <BoostView />}

      {/* ─── SECTION: Approval Inbox ─── */}
      {view === 'inbox' && <InboxView posts={ALL_POSTS} />}

      {/* ─── Two-column: loop + agents ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 340px)', gap: 14, marginTop: 14, alignItems: 'start' }}>
        <Panel title="AI production loop" eyebrow="ICP signal → analyze">
          <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            {LOOP.map((s) => (
              <div key={s.step} style={S.loopCell}>
                <div style={S.loopStep}>{s.step}</div>
                <div style={S.loopTitle}>{s.title}</div>
                <div style={S.loopDesc}>{s.desc}</div>
              </div>
            ))}
          </div>
        </Panel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Panel title="ICPs being targeted" eyebrow={`${ICPS.length} segments`}>
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ICPS.map((icp) => (
                <div key={icp.name} style={S.icpRow}>
                  <span style={S.icpEmoji}>{icp.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={S.icpName}>{icp.name}</div>
                    <div style={S.icpMarket}>{icp.market}</div>
                  </div>
                  <span style={S.icpCount}>{icp.activePosts}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Guardrails" eyebrow="non-negotiable">
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Callout tone="brass">Reality Agent gates every post. Visuals must match the actual resort.</Callout>
              <Callout tone="warn">Auto-publish only after Reality Check passes. <strong>Never skip</strong>.</Callout>
              <Callout tone="soft">Every post tied to ICP + pillar + CTA. No random brand noise.</Callout>
              <Callout tone="soft">Per-channel frequency caps + banned-topic lists enforced in Channels tab.</Callout>
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="Agent fleet" eyebrow={`${AGENTS.length} social specialists · queue-only`}>
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

      <div style={S.footerNote}>
        Phase 1 cockpit · 5 sections via <code>?view=</code>. Phase 2 wires <code>social_ai.posts · calendar · approvals · assets · boosts</code> + 13 agents via <code>cap_skills</code>. Auto-publish flips per channel after the Approval queue clears below 5 backlog and Reality flags stay below 2% for 14 days.
      </div>
    </Page>
  );
}

// ─── SECTION COMPONENTS ───────────────────────────────────────────────────

function SectionStrip({ active }: { active: View }) {
  return (
    <div style={S.subStrip}>
      {VIEWS.map((v) => {
        const isActive = v === active;
        return (
          <a key={v} href={`?view=${v}`}
             style={{ ...S.subStripLink, ...(isActive ? S.subStripLinkActive : {}) }}>
            {VIEW_LABEL[v]}
          </a>
        );
      })}
    </div>
  );
}

function CalendarView({ posts, todayIso, windowDays, channelFilter }: {
  posts: ProposedPost[]; todayIso: string; windowDays: Window; channelFilter: Platform | 'all';
}) {
  // Filter to window + channel + future (>= today)
  const cutoff = addDaysIso(todayIso, windowDays);
  const filtered = posts.filter((p) => p.iso >= todayIso && p.iso < cutoff && (channelFilter === 'all' || p.platform === channelFilter));
  const postsByDate = new Map<string, ProposedPost[]>();
  for (const p of filtered) {
    const arr = postsByDate.get(p.iso) ?? [];
    arr.push(p);
    postsByDate.set(p.iso, arr);
  }
  const days: string[] = Array.from({ length: windowDays }, (_, i) => addDaysIso(todayIso, i));

  const cw = `?view=calendar&w=${windowDays}`;
  const cwCh = (p: Platform | 'all') => `${cw}&ch=${p}`;
  const cwW = (w: Window) => `?view=calendar&w=${w}&ch=${channelFilter}`;

  return (
    <Panel
      title="Proposed calendar"
      eyebrow={`${filtered.length} posts · ${windowDays}-day window${channelFilter === 'all' ? '' : ` · ${PLATFORM_LABEL[channelFilter]}`}`}
    >
      <div style={{ padding: 14 }}>
        {/* Controls row */}
        <div style={S.controlsRow}>
          <div style={S.controlGroup}>
            <span style={S.controlLabel}>Window</span>
            {([30, 60, 90] as Window[]).map((w) => (
              <a key={w} href={cwW(w)}
                 style={{ ...S.chip, ...(w === windowDays ? S.chipActive : {}) }}>{w}d</a>
            ))}
          </div>
          <div style={S.controlGroup}>
            <span style={S.controlLabel}>Channel</span>
            <a href={cwCh('all')}
               style={{ ...S.chip, ...(channelFilter === 'all' ? S.chipActive : {}) }}>All</a>
            {PLATFORMS.map((p) => (
              <a key={p} href={cwCh(p)}
                 style={{ ...S.chip, ...(channelFilter === p ? S.chipActive : {}) }}>
                {PLATFORM_GLYPH[p]} {PLATFORM_LABEL[p]}
              </a>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div style={S.legendRow}>
          <LegendChip color="var(--brass, #a8854a)"      label="Scheduled" />
          <LegendChip color="var(--st-warn, #C28F2C)"    label="Awaiting Approval" />
          <LegendChip color="var(--text-2, #d8cca8)"     label="Approved" />
          <LegendChip color="var(--text-mute, #9b907a)"  label="Draft" />
          <LegendChip color="#c97b6a"                     label="Reality Flag" />
        </div>

        {/* Calendar grid */}
        <div style={S.calGrid}>
          {days.map((iso) => {
            const p = postsByDate.get(iso) ?? [];
            const d = new Date(iso + 'T00:00:00Z');
            const isToday = iso === todayIso;
            return (
              <div key={iso} style={{ ...S.calCell, ...(isToday ? S.calCellToday : {}) }}>
                <div style={S.calCellHead}>
                  <span style={S.calCellDate}>{d.toLocaleDateString('en-GB', { day: '2-digit' })}</span>
                  <span style={S.calCellMeta}>{d.toLocaleDateString('en-GB', { month: 'short' })} · {d.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                </div>
                {p.length === 0 ? (
                  <div style={S.calCellEmpty}>—</div>
                ) : (
                  <div style={S.calCellPosts}>
                    {p.map((post, i) => (
                      <span key={`${iso}-${i}`}
                            title={`${PLATFORM_LABEL[post.platform]} · ${post.format} · ${post.icp}\n${post.hook}`}
                            style={{ ...S.calPostChip, ...statusChipStyle(post.status) }}>
                        <span style={S.calPostGlyph}>{PLATFORM_GLYPH[post.platform]}</span>
                        <span style={S.calPostFormat}>{post.format}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

function ConceptFlowView() {
  const byCol = new Map<ConceptColumn, ConceptCard[]>();
  for (const c of CONCEPT_CARDS) (byCol.get(c.column) ?? byCol.set(c.column, []).get(c.column)!).push(c);

  return (
    <Panel title="Concept flow · pipeline" eyebrow="idea → scheduled · Kanban">
      <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8 }}>
        {CONCEPT_COLUMNS.map((col) => {
          const cards = byCol.get(col) ?? [];
          return (
            <div key={col} style={S.kanbanCol}>
              <div style={S.kanbanColHead}>
                <span>{col}</span>
                <span style={S.kanbanColCount}>{cards.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {cards.map((c, i) => (
                  <div key={`${col}-${i}`} style={S.kanbanCard}>
                    <div style={S.kanbanCardChan}>
                      {PLATFORM_GLYPH[c.platform]} · {c.format}
                    </div>
                    <div style={S.kanbanCardHook}>{c.hook}</div>
                    <div style={S.kanbanCardIcp}>{c.icp}</div>
                  </div>
                ))}
                {cards.length === 0 && <div style={S.kanbanEmpty}>—</div>}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function ChannelsView({ dbByPlatform }: { dbByPlatform: Map<string, any> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Panel title="Channels · live inventory" eyebrow={`${PLATFORMS.length} platforms · marketing.social_accounts`}>
        <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
          {PLATFORMS.map((p) => {
            const meta = CHANNEL_META[p];
            const dbRow = dbByPlatform.get(p);
            const liveFollowers = dbRow?.followers ?? meta.followers;
            const liveHandle = dbRow?.handle as string | undefined;
            const liveUrl = dbRow?.url as string | undefined;
            return (
              <div key={p} style={S.channelCard}>
                <div style={S.channelHead}>
                  <span style={S.channelName}>{PLATFORM_LABEL[p]}</span>
                  <span style={autonomyPill(meta.autonomyPhase)}>Phase {meta.autonomyPhase}</span>
                </div>
                <div style={S.channelHandle}>
                  {liveUrl ? <a href={liveUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brass)' }}>{liveHandle ?? 'open ↗'} ↗</a>
                  : liveHandle ? <span>{liveHandle}</span>
                  : <span style={{ color: 'var(--text-place, #5a5448)', fontStyle: 'italic' }}>handle not set</span>}
                </div>
                <div style={S.channelStatRow}>
                  <Stat label="Followers"  value={liveFollowers.toLocaleString('en-US')} />
                  <Stat label="Growth 30d" value={meta.growth30d} />
                  <Stat label="Eng. rate"  value={meta.engagementRate} />
                  <Stat label="Posts MTD"  value={String(meta.postsMtd)} />
                </div>
                <div style={S.bestPostBox}>
                  <div style={S.bestPostLabel}>Best post · last 30d</div>
                  <div style={S.bestPostHook}>"{meta.bestPost.hook}"</div>
                  <div style={S.bestPostMeta}>{meta.bestPost.reach.toLocaleString('en-US')} reach · {meta.bestPost.engagement} engagement</div>
                </div>
                <div style={S.guardrailBox}>
                  <div style={S.guardrailLabel}>Guardrails</div>
                  <div style={S.guardrailRow}>Frequency: <strong>{meta.frequencyCap}</strong></div>
                  <div style={S.guardrailRow}>Banned: <span style={{ color: 'var(--text-mute, #9b907a)' }}>{meta.bannedTopics.join(' · ')}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Autonomy ladder · per-channel" eyebrow="trust-threshold model">
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <AutonomyRung phase="A" title="Human approves every post"        desc="Default. Every Reel / Photo / Carousel / Video clears the Approval queue. Reality Agent flags caught before publish." />
          <AutonomyRung phase="B" title="Human approves only Reality-flagged" desc="Pinterest + Facebook running here today. Brand-safe posts auto-publish per schedule; flagged content escalates." />
          <AutonomyRung phase="C" title="Full-auto within guardrails"        desc="Threads only. High-cadence, lower-stakes channel. Reality-flag still escalates. Frequency cap enforced." />
        </div>
      </Panel>
    </div>
  );
}

function BoostView() {
  return (
    <Panel title="Boost & promote candidates" eyebrow={`${BOOST_CANDIDATES.length} organic winners · AI proposes paid spend`}>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {BOOST_CANDIDATES.map((b, i) => (
          <div key={i} style={S.boostCard}>
            <div style={S.boostHead}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={S.boostHook}>"{b.hook}"</span>
                <span style={S.boostMeta}>{PLATFORM_LABEL[b.platform]} · {b.icp}</span>
              </div>
              <span style={verdictPill(b.verdict)}>{b.verdict}</span>
            </div>
            <div style={S.boostStats}>
              <Stat label="Organic Reach"    value={b.organicReach.toLocaleString('en-US')} />
              <Stat label="Organic Eng."     value={b.organicEngagement} />
              <Stat label="Proposed Budget" value={b.proposedBudget} />
              <Stat label="Projected Reach" value={b.projectedReach} />
              <Stat label="Projected CPE"   value={b.projectedCpe} />
            </div>
            <div style={S.boostSignal}>
              <span style={S.boostSignalLabel}>Signal</span>
              <span>{b.signal}</span>
            </div>
            <div style={S.boostActions}>
              <button type="button" style={S.btnPrimary}>✓ Approve &amp; Boost</button>
              <button type="button" style={S.btnSecondary}>✎ Adjust Budget</button>
              <button type="button" style={S.btnSecondary}>⟶ Skip</button>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function InboxView({ posts }: { posts: ProposedPost[] }) {
  const queue = posts.filter((p) => p.status === 'Awaiting Approval' || p.status === 'Reality Flag').sort((a, b) => a.iso.localeCompare(b.iso));
  return (
    <Panel
      title="Approval inbox"
      eyebrow={`${queue.length} posts awaiting human sign-off`}
      actions={<span style={S.approvalBadge}>✦ Action needed</span>}
    >
      <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10 }}>
        {queue.map((p, i) => {
          const d = new Date(p.iso + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
          return (
            <div key={i} style={S.inboxCard}>
              <div style={S.inboxHead}>
                <span style={S.inboxChan}>{PLATFORM_GLYPH[p.platform]} · {PLATFORM_LABEL[p.platform]}</span>
                <span style={statusPill(p.status)}>{p.status}</span>
              </div>
              <div style={S.inboxHook}>"{p.hook}"</div>
              <div style={S.inboxMeta}>{p.format} · {p.icp} · {d}</div>
              <div style={S.inboxBrief}>{p.brief}</div>
              <div style={S.inboxActions}>
                <button type="button" style={S.btnPrimary}>✓ Approve &amp; Schedule</button>
                <button type="button" style={S.btnSecondary}>✎ Edit</button>
                <button type="button" style={S.btnSecondary}>⟶ Defer</button>
                <button type="button" style={S.btnWarn}>★ Mark hot</button>
              </div>
            </div>
          );
        })}
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

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 10, height: 10, borderRadius: 2, background: color, border: '1px solid var(--border-1, #1f1c15)' }} />
      <span style={S.legendLabel}>{label}</span>
    </span>
  );
}

function AutonomyRung({ phase, title, desc }: { phase: 'A' | 'B' | 'C'; title: string; desc: string }) {
  return (
    <div style={S.rung}>
      <span style={autonomyPill(phase)}>Phase {phase}</span>
      <div style={{ flex: 1 }}>
        <div style={S.rungTitle}>{title}</div>
        <div style={S.rungDesc}>{desc}</div>
      </div>
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

function statusPill(status: PostStatus): React.CSSProperties {
  const color =
    status === 'Scheduled'         ? 'var(--brass, #a8854a)' :
    status === 'Awaiting Approval' ? 'var(--st-warn, #C28F2C)' :
    status === 'Approved'          ? 'var(--text-2, #d8cca8)' :
    status === 'Reality Flag'      ? '#c97b6a' :
    status === 'Published'         ? 'var(--st-good, #82ad8c)' :
                                     'var(--text-mute, #9b907a)';
  return basePill(color);
}

function statusChipStyle(status: PostStatus): React.CSSProperties {
  const color =
    status === 'Scheduled'         ? 'var(--brass, #a8854a)' :
    status === 'Awaiting Approval' ? 'var(--st-warn, #C28F2C)' :
    status === 'Approved'          ? 'var(--text-2, #d8cca8)' :
    status === 'Reality Flag'      ? '#c97b6a' :
    status === 'Published'         ? 'var(--st-good, #82ad8c)' :
                                     'var(--text-mute, #9b907a)';
  return { borderColor: color, color };
}

function autonomyPill(phase: 'A' | 'B' | 'C'): React.CSSProperties {
  const color = phase === 'A' ? 'var(--text-mute, #9b907a)' : phase === 'B' ? 'var(--text-2, #d8cca8)' : 'var(--brass, #a8854a)';
  return basePill(color);
}

function verdictPill(verdict: BoostCandidate['verdict']): React.CSSProperties {
  const color =
    verdict === 'Strong Boost'   ? 'var(--brass, #a8854a)' :
    verdict === 'Moderate Boost' ? 'var(--text-2, #d8cca8)' :
    verdict === 'Test First'     ? 'var(--st-warn, #C28F2C)' :
                                   'var(--text-mute, #9b907a)';
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

const S: Record<string, React.CSSProperties> = {
  // Inner sub-strip
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

  // Calendar controls
  controlsRow: { display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 12 },
  controlGroup: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  controlLabel: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: 'var(--brass, #a8854a)',
  },
  chip: {
    padding: '3px 9px',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 11,
    letterSpacing: '0.10em',
    color: 'var(--text-1, #d8cca8)',
    background: 'transparent',
    border: '1px solid var(--border-1, #1f1c15)',
    borderRadius: 999,
    textDecoration: 'none',
  },
  chipActive: {
    color: 'var(--surf-0, #0a0a0a)',
    background: 'var(--brass, #a8854a)',
    borderColor: 'var(--brass, #a8854a)',
    fontWeight: 700,
  },

  // Calendar
  legendRow: { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 },
  legendLabel: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: 'var(--text-mute, #9b907a)',
  },
  calGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 6 },
  calCell: {
    background: 'var(--surf-1, #0f0d0a)',
    border: '1px solid var(--border-1, #1f1c15)',
    borderRadius: 4,
    padding: '8px 8px 6px',
    minHeight: 86,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  calCellToday: { borderColor: 'var(--brass, #a8854a)', borderLeftWidth: 3 },
  calCellHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
  calCellDate: { fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: 'var(--t-md)', color: 'var(--text-0, #e9e1ce)' },
  calCellMeta: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-place, #5a5448)' },
  calCellEmpty: { fontSize: 'var(--t-xs)', color: 'var(--text-place, #5a5448)', fontStyle: 'italic', paddingTop: 8 },
  calCellPosts: { display: 'flex', flexDirection: 'column', gap: 2 },
  calPostChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 9,
    letterSpacing: '0.10em',
    padding: '1px 4px',
    border: '1px solid',
    borderRadius: 2,
    whiteSpace: 'nowrap',
  },
  calPostGlyph: { fontWeight: 700 },
  calPostFormat: { letterSpacing: '0.06em', textTransform: 'uppercase' },

  // Concept Flow (Kanban)
  kanbanCol: {
    background: 'var(--surf-1, #0f0d0a)',
    border: '1px solid var(--border-1, #1f1c15)',
    borderRadius: 6,
    padding: '8px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minHeight: 200,
  },
  kanbanColHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: 'var(--brass, #a8854a)',
    paddingBottom: 6,
    borderBottom: '1px solid var(--border-1, #1f1c15)',
  },
  kanbanColCount: { color: 'var(--text-mute, #9b907a)', fontVariantNumeric: 'tabular-nums' },
  kanbanCard: {
    background: 'var(--surf-0, #0a0a0a)',
    border: '1px solid var(--border-1, #1f1c15)',
    borderLeft: '2px solid var(--brass, #a8854a)',
    borderRadius: 3,
    padding: '8px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  kanbanCardChan: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.12em', color: 'var(--brass, #a8854a)' },
  kanbanCardHook: { fontSize: 'var(--t-sm)', color: 'var(--text-0, #e9e1ce)', lineHeight: 1.3 },
  kanbanCardIcp: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', color: 'var(--text-mute, #9b907a)' },
  kanbanEmpty: { fontSize: 'var(--t-xs)', color: 'var(--text-place, #5a5448)', fontStyle: 'italic', textAlign: 'center' },

  // Channels
  channelCard: {
    background: 'var(--surf-1, #0f0d0a)',
    border: '1px solid var(--border-1, #1f1c15)',
    borderLeft: '3px solid var(--brass, #a8854a)',
    borderRadius: 6,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  channelHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  channelName: { fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: 'var(--t-md)', color: 'var(--text-0, #e9e1ce)', fontWeight: 500 },
  channelHandle: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.12em', color: 'var(--text-mute, #9b907a)' },
  channelStatRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, borderTop: '1px solid var(--border-1, #1f1c15)', paddingTop: 8 },
  bestPostBox: { padding: '6px 8px', background: 'var(--surf-0, #0a0a0a)', border: '1px solid var(--border-1, #1f1c15)', borderRadius: 3, display: 'flex', flexDirection: 'column', gap: 2 },
  bestPostLabel: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--st-good, #82ad8c)' },
  bestPostHook: { fontSize: 'var(--t-sm)', fontStyle: 'italic', color: 'var(--text-0, #e9e1ce)' },
  bestPostMeta: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', color: 'var(--text-mute, #9b907a)' },
  guardrailBox: { padding: '6px 8px', background: 'var(--surf-0, #0a0a0a)', border: '1px dashed var(--st-warn, #C28F2C)', borderRadius: 3, display: 'flex', flexDirection: 'column', gap: 3 },
  guardrailLabel: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--st-warn, #C28F2C)' },
  guardrailRow: { fontSize: 'var(--t-xs)', color: 'var(--text-1, #d8cca8)' },

  // Autonomy rungs
  rung: { padding: '10px 12px', background: 'var(--surf-1, #0f0d0a)', border: '1px solid var(--border-1, #1f1c15)', borderRadius: 4, display: 'flex', alignItems: 'flex-start', gap: 10 },
  rungTitle: { fontSize: 'var(--t-sm)', color: 'var(--text-0, #e9e1ce)', fontWeight: 500 },
  rungDesc: { fontSize: 'var(--t-xs)', lineHeight: 1.5, color: 'var(--text-mute, #9b907a)' },

  // Boost cards
  boostCard: {
    background: 'var(--surf-1, #0f0d0a)',
    border: '1px solid var(--border-1, #1f1c15)',
    borderLeft: '3px solid var(--brass, #a8854a)',
    borderRadius: 6,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  boostHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  boostHook: { fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: 'var(--t-md)', color: 'var(--text-0, #e9e1ce)' },
  boostMeta: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.12em', color: 'var(--text-mute, #9b907a)' },
  boostStats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, borderTop: '1px solid var(--border-1, #1f1c15)', paddingTop: 8 },
  boostSignal: { display: 'grid', gridTemplateColumns: '70px 1fr', gap: 6, fontSize: 'var(--t-xs)' },
  boostSignalLabel: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-place, #5a5448)' },
  boostActions: { display: 'flex', gap: 6, flexWrap: 'wrap' },

  // Inbox cards
  approvalBadge: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--st-warn, #C28F2C)', border: '1px solid var(--st-warn, #C28F2C)', padding: '2px 8px', borderRadius: 3 },
  inboxCard: { background: 'var(--surf-1, #0f0d0a)', border: '1px solid var(--border-1, #1f1c15)', borderLeft: '3px solid var(--st-warn, #C28F2C)', borderRadius: 6, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 },
  inboxHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  inboxChan: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--brass, #a8854a)' },
  inboxHook: { fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: 'var(--t-md)', color: 'var(--text-0, #e9e1ce)' },
  inboxMeta: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.10em', color: 'var(--text-mute, #9b907a)' },
  inboxBrief: { fontSize: 'var(--t-sm)', lineHeight: 1.5, color: 'var(--text-1, #d8cca8)' },
  inboxActions: { display: 'flex', gap: 6, flexWrap: 'wrap' },

  // Buttons
  btnPrimary: { background: 'var(--brass, #a8854a)', color: 'var(--surf-0, #0a0a0a)', border: '1px solid var(--brass, #a8854a)', padding: '4px 10px', borderRadius: 3, cursor: 'pointer', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 },
  btnSecondary: { background: 'transparent', color: 'var(--text-1, #d8cca8)', border: '1px solid var(--border-1, #1f1c15)', padding: '4px 10px', borderRadius: 3, cursor: 'pointer', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.12em', textTransform: 'uppercase' },
  btnWarn: { background: 'transparent', color: 'var(--brass, #a8854a)', border: '1px solid var(--brass, #a8854a)', padding: '4px 10px', borderRadius: 3, cursor: 'pointer', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 },

  // Loop + agents
  loopCell: { background: 'var(--surf-1, #0f0d0a)', border: '1px solid var(--border-1, #1f1c15)', borderRadius: 6, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 },
  loopStep: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.18em', color: 'var(--brass, #a8854a)' },
  loopTitle: { fontSize: 'var(--t-md)', fontWeight: 600, color: 'var(--text-0, #e9e1ce)' },
  loopDesc: { fontSize: 'var(--t-xs)', lineHeight: 1.5, color: 'var(--text-mute, #9b907a)' },

  agentCard: { background: 'var(--surf-1, #0f0d0a)', border: '1px solid var(--border-1, #1f1c15)', borderRadius: 6, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 },
  agentHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  agentName: { fontSize: 'var(--t-sm)', fontWeight: 600, color: 'var(--text-0, #e9e1ce)' },
  agentDesc: { fontSize: 'var(--t-xs)', lineHeight: 1.5, color: 'var(--text-mute, #9b907a)', minHeight: 54 },
  signalPill: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--brass, #a8854a)', border: '1px solid var(--brass, #a8854a)', padding: '1px 5px', borderRadius: 3 },

  // ICP roster
  icpRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--surf-1, #0f0d0a)', border: '1px solid var(--border-1, #1f1c15)', borderRadius: 4 },
  icpEmoji: { fontSize: 'var(--t-lg)', color: 'var(--brass, #a8854a)' },
  icpName: { fontSize: 'var(--t-sm)', color: 'var(--text-0, #e9e1ce)', fontWeight: 500 },
  icpMarket: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.12em', color: 'var(--text-mute, #9b907a)' },
  icpCount: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-sm)', fontWeight: 700, color: 'var(--brass, #a8854a)' },

  // Stat blocks
  statLabel: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 'var(--t-xs)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-place, #5a5448)' },
  statValue: { fontSize: 'var(--t-sm)', fontWeight: 600, color: 'var(--text-0, #e9e1ce)', fontVariantNumeric: 'tabular-nums' },

  footerNote: { marginTop: 18, padding: '10px 12px', fontSize: 'var(--t-xs)', color: 'var(--text-mute, #9b907a)', fontStyle: 'italic', borderTop: '1px solid var(--border-1, #1f1c15)' },
};
