// app/marketing/social/page.tsx
// PBS 2026-07-05: Migrated to new paper-white design (DashboardPage + KpiTile
// + MARKETING_SUBPAGES tabs). Live data: marketing.social_accounts via
// getSocialAccounts(). Everything else (proposed posts, concept flow, boost
// candidates, channel meta, ICPs, agents) is HARDCODED Phase 1 data —
// Phase 2 wires social_ai.posts + calendar + approvals + assets + boosts.
//
// Five inner sections switched via ?view=:
//   calendar · flow · channels · boost · inbox

import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { getSocialAccounts } from '@/lib/marketing';
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

// ─── Proposed posts (90 days) ─────────────────────────────────────────────

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
  reach?: number;
  saves?: number;
  engagement?: string;
}

function addDaysIso(baseIso: string, days: number): string {
  const d = new Date(baseIso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function buildProposedPosts(): ProposedPost[] {
  const todayIso = new Date().toISOString().slice(0, 10);
  const seeds: Array<Omit<ProposedPost, 'iso'> & { offset: number }> = [
    { offset: -10, platform: 'instagram', format: 'Reel',     icp: 'EU Wellness Women',   brief: '4am river silence',           hook: 'Why monks sweep at 4am',         status: 'Published', reach: 38_200, saves: 1240, engagement: '8.4%' },
    { offset:  -9, platform: 'pinterest', format: 'Photo',    icp: 'EU Wellness Women',   brief: 'Spa massage · brass + linen', hook: 'A ritual older than Europe',     status: 'Published', reach: 22_400, saves:  890, engagement: '6.1%' },
    { offset:  -7, platform: 'tiktok',    format: 'Reel',     icp: 'Luxury Couples',      brief: 'Candle dinner on the deck',   hook: 'Found the only river restaurant', status: 'Published', reach: 91_300, saves: 2780, engagement: '11.2%' },
    { offset:  -6, platform: 'youtube',   format: 'YT Short', icp: 'Mystique Explorers',  brief: '60s walk through Wat Xieng',  hook: '4am temple sweep',               status: 'Published', reach: 14_800, saves:  340, engagement: '5.2%' },
    { offset:  -4, platform: 'instagram', format: 'Carousel', icp: 'Conscious Food',      brief: '6-card foraging trip',        hook: 'Galangal harvest at dawn',       status: 'Published', reach: 28_900, saves: 1480, engagement: '9.7%' },
    { offset:  -3, platform: 'pinterest', format: 'Photo',    icp: 'Mystique Explorers',  brief: 'Saffron robes · golden hour', hook: 'Quiet wonder',                   status: 'Published', reach: 19_200, saves:  720, engagement: '5.8%' },
    { offset:  -2, platform: 'youtube',   format: 'YT Long',  icp: 'Conscious Food',      brief: '8-min farm-to-table docu',    hook: 'Where dinner walks before dawn', status: 'Published', reach: 42_100, saves: 1850, engagement: '12.4%' },
    { offset:  -1, platform: 'instagram', format: 'Reel',     icp: 'Digital Detox EU',    brief: 'Phone in a drawer 3 days',    hook: 'Your brain on no Wi-Fi',         status: 'Published', reach: 31_700, saves:  990, engagement: '7.9%' },
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
    { offset: 32, platform: 'instagram', format: 'Reel',     icp: 'Luxury Couples',     brief: 'Private river dinner',            hook: 'One table, one river, one night',               status: 'Draft' },
    { offset: 35, platform: 'pinterest', format: 'Photo',    icp: 'Conscious Food',     brief: 'Garden harvest still-life',        hook: "Today's dinner walked at sunrise",             status: 'Draft' },
    { offset: 38, platform: 'tiktok',    format: 'Reel',     icp: 'Mystique Explorers', brief: 'Monk almsgiving extended cut',      hook: 'The 4am gold extended',                         status: 'Draft' },
    { offset: 41, platform: 'youtube',   format: 'YT Long',  icp: 'EU Wellness Women',  brief: '15-min retreat-day documentary',    hook: 'A day at the Namkhan',                          status: 'Draft' },
    { offset: 45, platform: 'instagram', format: 'Carousel', icp: 'Asia Source Markets',brief: 'Lao-script hospitality cards · TH', hook: 'Hospitality in Lao',                            status: 'Draft' },
    { offset: 49, platform: 'instagram', format: 'Reel',     icp: 'Digital Detox EU',   brief: 'Sunrise without alarms',           hook: 'The body still knows',                          status: 'Draft' },
    { offset: 52, platform: 'linkedin',  format: 'Photo',    icp: 'Yoga Teachers · B2B',brief: 'Retreat layout · floorplan',        hook: 'How 14 retreats ran here last year',            status: 'Draft' },
    { offset: 56, platform: 'pinterest', format: 'Photo',    icp: 'Luxury Couples',     brief: 'Candle-lit suite at dusk',          hook: 'A room that knows the river',                   status: 'Draft' },
    { offset: 62, platform: 'instagram', format: 'Reel',     icp: 'EU Wellness Women',  brief: 'Spa ritual chain · slow',          hook: 'Six rituals in one morning',                    status: 'Draft' },
    { offset: 66, platform: 'youtube',   format: 'YT Short', icp: 'Mystique Explorers', brief: 'Sunset boat on the Nam Khan',       hook: 'Where the river turns gold',                    status: 'Draft' },
    { offset: 70, platform: 'pinterest', format: 'Photo',    icp: 'Conscious Food',     brief: 'Wild-honey breakfast still',        hook: 'Honey from the temple beekeeper',                status: 'Draft' },
    { offset: 75, platform: 'instagram', format: 'Carousel', icp: 'Luxury Couples',     brief: 'Anniversary package · refined',     hook: 'An anniversary worth telling',                  status: 'Draft' },
    { offset: 80, platform: 'facebook',  format: 'Carousel', icp: 'Asia Source Markets',brief: 'Wellness in Lao · TH-narrated',     hook: 'การพักผ่อนแบบลาว',                              status: 'Draft' },
  ];
  return seeds.map((s) => ({ iso: addDaysIso(todayIso, s.offset), ...s }));
}

const ALL_POSTS = buildProposedPosts();

// ─── Channel meta ─────────────────────────────────────────────────────────

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

// ─── Boost candidates ─────────────────────────────────────────────────────

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
  { hook: 'Found the only river restaurant', platform: 'tiktok',    organicReach: 91_300, organicEngagement: '11.2%', signal: 'Top 1% organic · viral coefficient 1.4 · 312 shares', proposedBudget: '$240 · 7 days',  projectedReach: '480k–720k',  projectedCpe: '$0.04', icp: 'Luxury Couples',    verdict: 'Strong Boost' },
  { hook: 'Where dinner walks before dawn',  platform: 'youtube',   organicReach: 42_100, organicEngagement: '12.4%', signal: 'Top 5% YT · long retention (74%) · saves up',       proposedBudget: '$180 · TrueView', projectedReach: '95k–140k',   projectedCpe: '$0.18', icp: 'Conscious Food',    verdict: 'Strong Boost' },
  { hook: 'Why monks sweep at 4am',          platform: 'instagram', organicReach: 38_200, organicEngagement: '8.4%',  signal: 'Saves climbing · DM intent · 4 booking clicks',     proposedBudget: '$120 · 5 days',   projectedReach: '180k–260k',  projectedCpe: '$0.07', icp: 'EU Wellness Women', verdict: 'Strong Boost' },
  { hook: 'Galangal harvest at dawn',        platform: 'instagram', organicReach: 28_900, organicEngagement: '9.7%',  signal: 'Strong saves · weak DMs · needs CTA tweak',         proposedBudget: '$80 · A/B test',  projectedReach: '90k–130k',   projectedCpe: '$0.09', icp: 'Conscious Food',    verdict: 'Moderate Boost' },
  { hook: 'Your brain on no Wi-Fi',          platform: 'instagram', organicReach: 31_700, organicEngagement: '7.9%',  signal: 'High reach · low booking-page clicks',              proposedBudget: '—',               projectedReach: '—',           projectedCpe: '—',     icp: 'Digital Detox EU',  verdict: 'Test First' },
  { hook: 'A ritual older than Europe',      platform: 'pinterest', organicReach: 22_400, organicEngagement: '6.1%',  signal: 'Steady saves · evergreen — boost as Idea Pin',      proposedBudget: '$60 · evergreen', projectedReach: '120k–180k',  projectedCpe: '$0.05', icp: 'EU Wellness Women', verdict: 'Moderate Boost' },
];

// ─── Concept flow ─────────────────────────────────────────────────────────

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

// ─── Loop + Agents ────────────────────────────────────────────────────────

const LOOP: { step: string; title: string; desc: string }[] = [
  { step: '01', title: 'ICP Signal',    desc: 'Map ICP needs · season · markets. What audience needs what story?' },
  { step: '02', title: 'Trend Watch',   desc: 'Scan Pinterest · IG · TikTok · YT trends + Google Trends + ours.' },
  { step: '03', title: 'Brief',         desc: 'Pillar + hook + CTA + format + language + posting time + ICP.' },
  { step: '04', title: 'Generate',      desc: 'Copy + visual + reel + YT short/long · multilingual variants.' },
  { step: '05', title: 'Reality Check', desc: 'Brand-fit + factual + visual fidelity. Flag for human review.' },
  { step: '06', title: 'Approve',       desc: 'Human signs off · approve · revise · reject. Autonomy threshold rules.' },
  { step: '07', title: 'Schedule',      desc: 'Calendar + platform · auto-publish at intent-time per ICP timezone.' },
  { step: '08', title: 'Analyze',       desc: 'Reach · saves · DMs · clicks · bookings → refines next-batch brief.' },
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

// ─── View params ──────────────────────────────────────────────────────────

type View = 'calendar' | 'flow' | 'channels' | 'boost' | 'inbox';
const VIEWS: View[] = ['calendar', 'flow', 'channels', 'boost', 'inbox'];
const VIEW_LABEL: Record<View, string> = {
  calendar: 'Calendar', flow: 'Concept flow', channels: 'Channels', boost: 'Boost', inbox: 'Approval inbox',
};

function parseView(v: string | string[] | undefined): View {
  const s = typeof v === 'string' ? v : 'calendar';
  return (VIEWS as string[]).includes(s) ? (s as View) : 'calendar';
}
function parseChannelFilter(v: string | string[] | undefined): Platform | 'all' {
  const s = typeof v === 'string' ? v : 'all';
  return (PLATFORMS as readonly string[]).includes(s) ? (s as Platform) : 'all';
}
type Win = 30 | 60 | 90;
function parseWindow(v: string | string[] | undefined): Win {
  const n = Number(typeof v === 'string' ? v : 30);
  return (n === 60 || n === 90) ? n : 30;
}

// ─── Page ─────────────────────────────────────────────────────────────────

interface Props { searchParams?: { view?: string; ch?: string; w?: string } }

export default async function SocialPage({ searchParams }: Props) {
  const view = parseView(searchParams?.view);
  const channelFilter = parseChannelFilter(searchParams?.ch);
  const windowDays: Win = parseWindow(searchParams?.w);

  const allAccounts = await getSocialAccounts();
  const dbByPlatform = new Map<string, any>();
  for (const a of allAccounts) dbByPlatform.set(String(a.platform).toLowerCase(), a);

  const todayIso = new Date().toISOString().slice(0, 10);

  const awaiting    = ALL_POSTS.filter((p) => p.status === 'Awaiting Approval').length;
  const scheduled   = ALL_POSTS.filter((p) => p.status === 'Scheduled' || p.status === 'Approved').length;
  const publishedLast30 = ALL_POSTS.filter((p) => p.status === 'Published').length;
  const reach30d    = ALL_POSTS.filter((p) => p.status === 'Published').reduce((s, p) => s + (p.reach ?? 0), 0);
  const engAvg      = '8.3%';
  const realityFlags = ALL_POSTS.filter((p) => p.status === 'Reality Flag').length;

  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map((s: any) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/marketing/social',
  }));

  const tiles: KpiTileProps[] = [
    { label: 'Awaiting approval', value: awaiting,          size: 'sm', footnote: 'human sign-off queue' },
    { label: 'Scheduled · 90d',    value: scheduled,        size: 'sm', footnote: 'scheduled + approved' },
    { label: 'Published · 30d',    value: publishedLast30,  size: 'sm' },
    { label: 'Reach · 30d',        value: reach30d.toLocaleString(), size: 'sm', footnote: 'sum published reach' },
    { label: 'Engagement · avg',   value: engAvg,           size: 'sm' },
    { label: 'Reality flags',      value: realityFlags,     size: 'sm', footnote: realityFlags > 0 ? 'action needed' : 'clear' },
  ];

  return (
    <div style={{ background: WHITE, minHeight: '100vh' }}>
      <DashboardPage
        title="Marketing · Social"
        subtitle="AI social cockpit — calendar · flow · channels · boost · inbox"
        tabs={tabs}
      >
        <Banner text="HARDCODED DATA — Phase 1 posts + concept flow + boost candidates + channel meta are static. Only marketing.social_accounts (follower counts + handles) is live. Phase 2 wires social_ai.posts + calendar + approvals + assets + boosts." />

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
          <CalendarView posts={ALL_POSTS} todayIso={todayIso} windowDays={windowDays} channelFilter={channelFilter} />
        )}
        {view === 'flow' && <ConceptFlowView />}
        {view === 'channels' && <ChannelsView dbByPlatform={dbByPlatform} />}
        {view === 'boost' && <BoostView />}
        {view === 'inbox' && <InboxView posts={ALL_POSTS} />}

        {/* Two-col: loop + ICP list + guardrails */}
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 340px)', gap: 12, alignItems: 'start' }}>
          <Section title="AI production loop" note="ICP signal → analyze">
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
                      <div style={{ fontSize: 10, color: INK_M }}>{icp.market}</div>
                    </div>
                    <span style={pillSt(FOREST)}>{icp.activePosts}</span>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Guardrails" note="non-negotiable">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Callout tone="brass">Reality Agent gates every post. Visuals must match the actual resort.</Callout>
                <Callout tone="warn">Auto-publish only after Reality Check passes. <strong>Never skip</strong>.</Callout>
                <Callout tone="soft">Every post tied to ICP + pillar + CTA. No random brand noise.</Callout>
                <Callout tone="soft">Per-channel frequency caps + banned-topic lists enforced in Channels tab.</Callout>
              </div>
            </Section>
          </div>
        </div>

        {/* Agent fleet */}
        <Section title="Agent fleet" note={`${AGENTS.length} social specialists · queue-only`}>
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
          Phase 1 cockpit · 5 sections via <code>?view=</code>. Phase 2 wires <code>social_ai.posts · calendar · approvals · assets · boosts</code> + 13 agents via <code>cap_skills</code>.
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

// ─── Calendar view ─────────────────────────────────────────────────────────

function CalendarView({ posts, todayIso, windowDays, channelFilter }: {
  posts: ProposedPost[]; todayIso: string; windowDays: Win; channelFilter: Platform | 'all';
}) {
  const cutoff = addDaysIso(todayIso, windowDays);
  const filtered = posts.filter((p) => p.iso >= todayIso && p.iso < cutoff && (channelFilter === 'all' || p.platform === channelFilter));
  const postsByDate = new Map<string, ProposedPost[]>();
  for (const p of filtered) {
    const arr = postsByDate.get(p.iso) ?? [];
    arr.push(p);
    postsByDate.set(p.iso, arr);
  }
  const days: string[] = Array.from({ length: windowDays }, (_, i) => addDaysIso(todayIso, i));
  const cwW = (w: Win) => `?view=calendar&w=${w}&ch=${channelFilter}`;
  const cwCh = (p: Platform | 'all') => `?view=calendar&w=${windowDays}&ch=${p}`;

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <Section title="Proposed calendar" note={`${filtered.length} posts · ${windowDays}-day window${channelFilter === 'all' ? '' : ` · ${PLATFORM_LABEL[channelFilter]}`}`}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={filterLabelSt}>Window</span>
            {([30, 60, 90] as Win[]).map((w) => (
              <a key={w} href={cwW(w)} style={{ ...chipSt, ...(w === windowDays ? chipActiveSt : {}) }}>{w}d</a>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={filterLabelSt}>Channel</span>
            <a href={cwCh('all')} style={{ ...chipSt, ...(channelFilter === 'all' ? chipActiveSt : {}) }}>All</a>
            {PLATFORMS.map((p) => (
              <a key={p} href={cwCh(p)} style={{ ...chipSt, ...(channelFilter === p ? chipActiveSt : {}) }}>
                {PLATFORM_GLYPH[p]} {PLATFORM_LABEL[p]}
              </a>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6 }}>
          {days.map((iso) => {
            const p = postsByDate.get(iso) ?? [];
            const d = new Date(iso + 'T00:00:00Z');
            const isToday = iso === todayIso;
            return (
              <div key={iso} style={{
                background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: '6px 8px',
                minHeight: 68, display: 'flex', flexDirection: 'column', gap: 4,
                borderColor: isToday ? FOREST : HAIR,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>{d.toLocaleDateString('en-GB', { day: '2-digit' })}</span>
                  <span style={{ fontSize: 9, color: INK_M }}>{d.toLocaleDateString('en-GB', { month: 'short' })} · {d.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                </div>
                {p.length === 0 ? (
                  <div style={{ color: INK_M, fontSize: 10 }}>—</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {p.map((post, i) => (
                      <span key={`${iso}-${i}`}
                            title={`${PLATFORM_LABEL[post.platform]} · ${post.format} · ${post.icp}\n${post.hook}`}
                            style={{ ...postChipSt, ...statusChipStyle(post.status) }}>
                        <span style={{ fontSize: 9, fontWeight: 700 }}>{PLATFORM_GLYPH[post.platform]}</span>
                        <span style={{ fontSize: 9 }}>{post.format}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function ConceptFlowView() {
  const byCol = new Map<ConceptColumn, ConceptCard[]>();
  for (const c of CONCEPT_CARDS) {
    if (!byCol.has(c.column)) byCol.set(c.column, []);
    byCol.get(c.column)!.push(c);
  }

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <Section title="Concept flow · pipeline" note="idea → scheduled · Kanban">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 6 }}>
          {CONCEPT_COLUMNS.map((col) => {
            const cards = byCol.get(col) ?? [];
            return (
              <div key={col} style={{ background: CREAM, border: `1px solid ${HAIR}`, borderRadius: 4, padding: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: FOREST, fontWeight: 700, marginBottom: 6 }}>
                  <span>{col}</span>
                  <span style={{ color: INK_M }}>{cards.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {cards.map((c, i) => (
                    <div key={`${col}-${i}`} style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 3, padding: '6px 8px' }}>
                      <div style={{ fontSize: 9, color: INK_M, marginBottom: 2 }}>{PLATFORM_GLYPH[c.platform]} · {c.format}</div>
                      <div style={{ fontSize: 11, color: INK, lineHeight: 1.4 }}>{c.hook}</div>
                      <div style={{ fontSize: 9, color: INK_M, marginTop: 2 }}>{c.icp}</div>
                    </div>
                  ))}
                  {cards.length === 0 && <div style={{ fontSize: 10, color: INK_M, fontStyle: 'italic', textAlign: 'center' }}>—</div>}
                </div>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function ChannelsView({ dbByPlatform }: { dbByPlatform: Map<string, any> }) {
  return (
    <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Section title="Channels · live inventory" note={`${PLATFORMS.length} platforms · marketing.social_accounts`}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
          {PLATFORMS.map((p) => {
            const meta = CHANNEL_META[p];
            const dbRow = dbByPlatform.get(p);
            const liveFollowers = dbRow?.followers ?? meta.followers;
            const liveHandle = dbRow?.handle as string | undefined;
            const liveUrl = dbRow?.url as string | undefined;
            return (
              <div key={p} style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>{PLATFORM_LABEL[p]}</span>
                  <span style={autonomyPillSt(meta.autonomyPhase)}>Phase {meta.autonomyPhase}</span>
                </div>
                <div style={{ fontSize: 11, color: INK_M }}>
                  {liveUrl ? <a href={liveUrl} target="_blank" rel="noopener noreferrer" style={{ color: FOREST }}>{liveHandle ?? 'open ↗'} ↗</a>
                    : liveHandle ? <span>{liveHandle}</span>
                    : <span style={{ fontStyle: 'italic' }}>handle not set</span>}
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Stat label="Followers" value={liveFollowers.toLocaleString('en-US')} />
                  <Stat label="Growth 30d" value={meta.growth30d} />
                  <Stat label="Eng rate" value={meta.engagementRate} />
                  <Stat label="Posts MTD" value={String(meta.postsMtd)} />
                </div>
                <div style={{ background: CREAM, borderLeft: `2px solid ${FOREST}`, padding: '6px 8px', marginTop: 2 }}>
                  <div style={{ fontSize: 9, color: INK_M, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Best post · last 30d</div>
                  <div style={{ fontSize: 11, color: INK, fontStyle: 'italic' }}>&quot;{meta.bestPost.hook}&quot;</div>
                  <div style={{ fontSize: 10, color: INK_M }}>{meta.bestPost.reach.toLocaleString('en-US')} reach · {meta.bestPost.engagement} eng</div>
                </div>
                <div style={{ fontSize: 10, color: INK_M }}>
                  <div>Freq: <strong>{meta.frequencyCap}</strong></div>
                  <div>Banned: <span>{meta.bannedTopics.join(' · ')}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Autonomy ladder · per-channel" note="trust-threshold model">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <AutonomyRung phase="A" title="Human approves every post" desc="Default. Every Reel / Photo / Carousel / Video clears the Approval queue. Reality Agent flags caught before publish." />
          <AutonomyRung phase="B" title="Human approves only Reality-flagged" desc="Pinterest + Facebook running here today. Brand-safe posts auto-publish per schedule; flagged content escalates." />
          <AutonomyRung phase="C" title="Full-auto within guardrails" desc="Threads only. High-cadence, lower-stakes channel. Reality-flag still escalates. Frequency cap enforced." />
        </div>
      </Section>
    </div>
  );
}

function BoostView() {
  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <Section title="Boost & promote candidates" note={`${BOOST_CANDIDATES.length} organic winners · AI proposes paid spend`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {BOOST_CANDIDATES.map((b, i) => (
            <div key={i} style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 13, color: INK, fontWeight: 600, fontStyle: 'italic' }}>&quot;{b.hook}&quot;</span>
                  <span style={{ fontSize: 10, color: INK_M }}>{PLATFORM_LABEL[b.platform]} · {b.icp}</span>
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
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" style={btnPrimary}>✓ Approve &amp; Boost</button>
                <button type="button" style={btnSecondary}>Adjust Budget</button>
                <button type="button" style={btnSecondary}>Skip</button>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function InboxView({ posts }: { posts: ProposedPost[] }) {
  const queue = posts.filter((p) => p.status === 'Awaiting Approval' || p.status === 'Reality Flag').sort((a, b) => a.iso.localeCompare(b.iso));
  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <Section title="Approval inbox" note={`${queue.length} posts awaiting human sign-off`}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 8 }}>
          {queue.map((p, i) => {
            const d = new Date(p.iso + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
            return (
              <div key={i} style={{ background: CREAM, border: `1px solid ${HAIR}`, borderRadius: 4, padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: INK_M, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{PLATFORM_GLYPH[p.platform]} · {PLATFORM_LABEL[p.platform]}</span>
                  <span style={statusPillSt(p.status)}>{p.status}</span>
                </div>
                <div style={{ fontSize: 12, color: INK, fontWeight: 600, fontStyle: 'italic', marginBottom: 4 }}>&quot;{p.hook}&quot;</div>
                <div style={{ fontSize: 10, color: INK_M, marginBottom: 4 }}>{p.format} · {p.icp} · {d}</div>
                <div style={{ fontSize: 11, color: INK_S, marginBottom: 6 }}>{p.brief}</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <button type="button" style={btnPrimary}>✓ Approve</button>
                  <button type="button" style={btnSecondary}>Edit</button>
                  <button type="button" style={btnSecondary}>Defer</button>
                </div>
              </div>
            );
          })}
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

function AutonomyRung({ phase, title, desc }: { phase: 'A' | 'B' | 'C'; title: string; desc: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: CREAM, border: `1px solid ${HAIR}`, borderRadius: 4 }}>
      <span style={autonomyPillSt(phase)}>Phase {phase}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: INK, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 11, color: INK_M, lineHeight: 1.5 }}>{desc}</div>
      </div>
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

// ─── Pills / chips ─────────────────────────────────────────────────────────

function statusChipStyle(status: PostStatus): React.CSSProperties {
  const color =
    status === 'Scheduled'         ? FOREST :
    status === 'Awaiting Approval' ? AMBER :
    status === 'Approved'          ? '#3E8DBE' :
    status === 'Reality Flag'      ? RED :
    status === 'Published'         ? '#5DA46B' :
                                     INK_M;
  return { borderColor: color, color };
}

function statusPillSt(status: PostStatus): React.CSSProperties {
  const color =
    status === 'Scheduled'         ? FOREST :
    status === 'Awaiting Approval' ? AMBER :
    status === 'Approved'          ? '#3E8DBE' :
    status === 'Reality Flag'      ? RED :
    status === 'Published'         ? '#5DA46B' :
                                     INK_M;
  return pillSt(color);
}

function autonomyPillSt(phase: 'A' | 'B' | 'C'): React.CSSProperties {
  const color = phase === 'A' ? INK_M : phase === 'B' ? AMBER : FOREST;
  return pillSt(color);
}

function verdictPillSt(v: BoostCandidate['verdict']): React.CSSProperties {
  const color = v === 'Strong Boost' ? FOREST : v === 'Moderate Boost' ? '#3E8DBE' : v === 'Test First' ? AMBER : INK_M;
  return pillSt(color);
}

function pillSt(color: string): React.CSSProperties {
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
const filterLabelSt: React.CSSProperties = { fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: FOREST, fontWeight: 700 };
const chipSt: React.CSSProperties = { padding: '3px 9px', fontSize: 11, letterSpacing: '0.06em', color: INK, background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 999, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' };
const chipActiveSt: React.CSSProperties = { color: WHITE, background: FOREST, borderColor: FOREST, fontWeight: 700 };
const postChipSt: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 3,
  padding: '2px 5px', border: '1px solid', borderRadius: 2, whiteSpace: 'nowrap',
  background: WHITE,
};
const workflowCellSt: React.CSSProperties = { background: CREAM, border: `1px solid ${HAIR}`, borderRadius: 4, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 };
const workflowStepSt: React.CSSProperties = { fontSize: 10, color: FOREST, fontWeight: 700, letterSpacing: '0.10em' };
const workflowTitleSt: React.CSSProperties = { fontSize: 12, color: INK, fontWeight: 600 };
const workflowDescSt: React.CSSProperties = { fontSize: 10, color: INK_M, lineHeight: 1.4 };
const agentCardSt: React.CSSProperties = { background: CREAM, border: `1px solid ${HAIR}`, borderRadius: 4, padding: '8px 10px' };
const signalPillSt: React.CSSProperties = { fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: FOREST, border: `1px solid ${FOREST}`, padding: '1px 5px', borderRadius: 2 };
const btnPrimary: React.CSSProperties = { padding: '4px 10px', fontSize: 11, fontWeight: 600, background: FOREST, color: WHITE, border: 'none', borderRadius: 3, cursor: 'pointer' };
const btnSecondary: React.CSSProperties = { padding: '4px 10px', fontSize: 11, fontWeight: 500, background: WHITE, color: INK_S, border: `1px solid ${HAIR}`, borderRadius: 3, cursor: 'pointer' };
