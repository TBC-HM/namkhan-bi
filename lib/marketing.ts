// lib/marketing.ts
// Server-side fetchers for the marketing schema.
// Uses anon Supabase client (already configured in lib/supabase.ts).

import { supabase } from '@/lib/supabase';

// ----- Types -----
export interface Review {
  id: number;
  source: string;
  reviewer_name: string | null;
  reviewer_country: string | null;
  rating_norm: number | null;
  rating_raw: number | null;
  rating_scale: number;
  title: string | null;
  body: string | null;
  language: string | null;
  reviewed_at: string | null;
  received_at: string;
  response_status: 'unanswered' | 'draft' | 'responded' | 'ignored';
  responded_at: string | null;
  is_verified: boolean;
}

export type MetricKind = 'followers' | 'subscribers' | 'reviews' | 'impressions';

export interface SocialAccount {
  id: number;
  platform: string;
  handle: string | null;
  url: string | null;
  display_name: string | null;
  /** What metric_value / secondary_value represent. Populated by social-followers-sync EF. */
  metric_kind?: MetricKind;
  /** Primary count: followers / subscribers / review count. */
  metric_value?: number;
  /** Secondary scalar: avg_rating when metric_kind === 'reviews'. */
  secondary_value?: number | null;
  /** Legacy alias — equals metric_value when metric_kind in (followers, subscribers), else 0. */
  followers: number;
  following: number;
  posts: number;
  last_synced_at: string | null;
  last_sync_status?: 'ok' | 'error' | 'skipped' | null;
  last_sync_error?: string | null;
  active: boolean;
}

export const METRIC_LABEL: Record<MetricKind, { primary: string; secondary?: string }> = {
  followers:   { primary: 'followers' },
  subscribers: { primary: 'subscribers' },
  reviews:     { primary: 'reviews', secondary: 'avg rating' },
  impressions: { primary: 'impressions' },
};

export interface Influencer {
  id: number;
  name: string;
  handle: string | null;
  primary_platform: string | null;
  reach: number | null;
  niche: string | null;
  country: string | null;
  stay_from: string | null;
  stay_to: string | null;
  comp_value_usd: number | null;
  paid_fee_usd: number | null;
  deliverables: string | null;
  delivered: boolean;
  delivered_links: string[] | null;
  estimated_reach: number | null;
}

export interface MediaLink {
  id: number;
  category: string;
  label: string;
  url: string;
  description: string | null;
  added_at: string;
}

// New media pipeline (Phase 1, 2026-05-01)
export interface MediaAssetReady {
  asset_id: string;
  asset_type: string;
  original_filename: string;
  caption: string | null;
  alt_text: string | null;
  primary_tier: string | null;
  secondary_tiers: string[] | null;
  property_area: string | null;
  room_type_id: number | null;
  captured_at: string | null;
  license_type: string;
  usage_rights: string[] | null;
  do_not_modify: boolean;
  has_identifiable_people: boolean;
  raw_path: string | null;
  master_path: string | null;
  width_px: number | null;
  height_px: number | null;
  qc_score: number | null;
  ai_confidence: number | null;
  tags: string[] | null;
  renders: Record<string, string> | null;
}

// ----- Queries -----

// Latest reviews — default 50, with optional source filter
export async function getReviews(opts: {
  limit?: number;
  source?: string;
  status?: string;
} = {}): Promise<Review[]> {
  const { limit = 50, source, status } = opts;
  let q = supabase
    .schema('marketing')
    .from('reviews')
    .select('id,source,reviewer_name,reviewer_country,rating_norm,rating_raw,rating_scale,title,body,language,reviewed_at,received_at,response_status,responded_at,is_verified')
    .order('received_at', { ascending: false })
    .limit(limit);

  if (source) q = q.eq('source', source);
  if (status) q = q.eq('response_status', status);

  const { data, error } = await q;
  if (error) {
    console.error('getReviews error', error);
    return [];
  }
  return (data ?? []) as Review[];
}

// NPS / rating breakdown by source (last 90 days)
export async function getReviewStatsBySource(days = 90): Promise<Array<{
  source: string;
  count: number;
  avg_rating: number;
  unanswered: number;
}>> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .schema('marketing')
    .from('reviews')
    .select('source,rating_norm,response_status')
    .gte('received_at', since.toISOString());

  if (error) {
    console.error('getReviewStatsBySource error', error);
    return [];
  }

  // Aggregate client-side (small dataset, no need for SQL view yet)
  const groups = new Map<string, { count: number; sum: number; ratings: number; unanswered: number }>();
  for (const r of data ?? []) {
    const g = groups.get(r.source) ?? { count: 0, sum: 0, ratings: 0, unanswered: 0 };
    g.count += 1;
    if (r.rating_norm != null) {
      g.sum += Number(r.rating_norm);
      g.ratings += 1;
    }
    if (r.response_status === 'unanswered') g.unanswered += 1;
    groups.set(r.source, g);
  }

  return Array.from(groups.entries())
    .map(([source, g]) => ({
      source,
      count: g.count,
      avg_rating: g.ratings > 0 ? g.sum / g.ratings : 0,
      unanswered: g.unanswered,
    }))
    .sort((a, b) => b.count - a.count);
}

export async function getReviewSummary(days = 30): Promise<{
  total: number;
  avg_rating: number;
  unanswered: number;
  response_rate: number;
}> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .schema('marketing')
    .from('reviews')
    .select('rating_norm,response_status')
    .gte('received_at', since.toISOString());

  if (error || !data) {
    return { total: 0, avg_rating: 0, unanswered: 0, response_rate: 0 };
  }

  const total = data.length;
  const ratings = data.filter(r => r.rating_norm != null).map(r => Number(r.rating_norm));
  const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
  const unanswered = data.filter(r => r.response_status === 'unanswered').length;
  const responded = data.filter(r => r.response_status === 'responded').length;
  const response_rate = total > 0 ? responded / total : 0;

  return { total, avg_rating: avg, unanswered, response_rate };
}

export async function getSocialAccounts(): Promise<SocialAccount[]> {
  const { data, error } = await supabase
    .schema('marketing')
    .from('social_accounts')
    .select('*')
    .eq('active', true)
    .order('platform', { ascending: true });

  if (error) {
    console.error('getSocialAccounts error', error);
    return [];
  }
  return (data ?? []) as SocialAccount[];
}

export async function getInfluencers(opts: { limit?: number } = {}): Promise<Influencer[]> {
  const { limit = 100 } = opts;
  const { data, error } = await supabase
    .schema('marketing')
    .from('influencers')
    .select('*')
    .order('stay_from', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.error('getInfluencers error', error);
    return [];
  }
  return (data ?? []) as Influencer[];
}

export async function getMediaLinks(): Promise<MediaLink[]> {
  const { data, error } = await supabase
    .schema('marketing')
    .from('media_links')
    .select('id,category,label,url,description,added_at')
    .eq('active', true)
    .order('category', { ascending: true })
    .order('added_at', { ascending: false });

  if (error) {
    console.error('getMediaLinks error', error);
    return [];
  }
  return (data ?? []) as MediaLink[];
}

// ----- New media pipeline (Phase 1 — 2026-05-01) -----
// Pulls from marketing.v_media_ready (license-aware, status='ready' only).

export async function getMediaReady(opts: {
  limit?: number;
  tier?: string;
  tag?: string;
  /** When true (default), excludes tier_archive (logos / decommissioned) from results
   *  unless `tier === 'tier_archive'` is explicitly requested. */
  excludeArchive?: boolean;
} = {}): Promise<MediaAssetReady[]> {
  const { limit = 200, tier, tag, excludeArchive = true } = opts;
  let q = supabase
    .schema('marketing')
    .from('v_media_ready')
    .select('*')
    .order('captured_at', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (tier) q = q.eq('primary_tier', tier);
  else if (excludeArchive) q = q.neq('primary_tier', 'tier_archive');
  if (tag)  q = q.contains('tags', [tag]);

  const { data, error } = await q;
  if (error) {
    console.error('getMediaReady error', error);
    return [];
  }
  return (data ?? []) as MediaAssetReady[];
}

/** Curator: top N photos by qc + ai_confidence (brand_fit), excludes logos & internal.
 *  Powers the "Fresh & ready" widget on /marketing/library. */
export async function getCuratorPicks(limit = 12): Promise<MediaAssetReady[]> {
  const { data, error } = await supabase
    .schema('marketing')
    .from('v_media_ready')
    .select('*')
    .in('primary_tier', ['tier_ota_profile', 'tier_website_hero', 'tier_social_pool'])
    .order('qc_score', { ascending: false, nullsFirst: false })
    .order('ai_confidence', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) {
    console.error('getCuratorPicks error', error);
    return [];
  }
  return (data ?? []) as MediaAssetReady[];
}

// ===== By-room + OTA Pack helpers =====

/** Locked room-type taxonomy. Slugs match marketing.media_taxonomy.tag_slug rows
 *  in category='room_type'. Order = how the OTA carousel surfaces them. */
export const ROOM_TYPE_SLUGS: Array<{ slug: string; label: string }> = [
  { slug: 'sunset_namkhan_river_villa',  label: 'Sunset Namkhan River Villa' },
  { slug: 'sunset_luang_prabang_villa',  label: 'Sunset Luang Prabang Villa' },
  { slug: 'riverfront_suite',            label: 'Riverfront Suite' },
  { slug: 'riverview_suite',             label: 'Riverview Suite' },
  { slug: 'art_deluxe_suite',            label: 'Art Deluxe Suite' },
  { slug: 'art_deluxe_room',             label: 'Art Deluxe Room' },
  { slug: 'art_deluxe_family_room',      label: 'Art Deluxe Family Room' },
  { slug: 'riverfront_glamping',         label: 'Riverfront Glamping' },
  { slug: 'namkhan_glamping_tent',       label: 'Namkhan Glamping Tent' },
  { slug: 'explorer_glamping',           label: 'Explorer Glamping' },
];

export interface RoomTypeBucket {
  slug: string;
  label: string;
  count: number;
  /** True when count < 5 (target minimum for OTA listing). */
  under_target: boolean;
  /** Up to 5 sample assets, qc_score DESC. */
  samples: MediaAssetReady[];
}

/** Returns one bucket per room_type tag, with sample photos + count.
 *  Used by the by-room widget on /marketing/library. */
export async function getRoomTypeBuckets(): Promise<RoomTypeBucket[]> {
  const buckets: RoomTypeBucket[] = [];
  for (const rt of ROOM_TYPE_SLUGS) {
    const { data, error } = await supabase
      .schema('marketing')
      .from('v_media_ready')
      .select('*')
      .contains('tags', [rt.slug])
      .neq('primary_tier', 'tier_archive')
      .order('qc_score', { ascending: false, nullsFirst: false })
      .order('ai_confidence', { ascending: false, nullsFirst: false })
      .limit(5);
    if (error) {
      console.error(`getRoomTypeBuckets error for ${rt.slug}`, error);
      buckets.push({ slug: rt.slug, label: rt.label, count: 0, under_target: true, samples: [] });
      continue;
    }
    // Get total count separately (Supabase JS doesn't return count in select with limit easily)
    const { count: cnt } = await supabase
      .schema('marketing')
      .from('v_media_ready')
      .select('*', { count: 'exact', head: true })
      .contains('tags', [rt.slug])
      .neq('primary_tier', 'tier_archive');
    const count = Number(cnt ?? 0);
    buckets.push({
      slug: rt.slug,
      label: rt.label,
      count,
      under_target: count < 5,
      samples: (data ?? []) as MediaAssetReady[],
    });
  }
  return buckets;
}

/** Canonical 50-photo OTA carousel template for Booking.com / Expedia / SLH.
 *  Each slot has a target count and a tag filter. */
export const OTA_PACK_SLOTS: Array<{
  slot: string;
  label: string;
  min_count: number;
  // Tags: photo qualifies if it has ANY of these tag slugs
  any_tags: string[];
  // Style filter: prefer these style tags
  style_tags?: string[];
}> = [
  { slot: 'hero',        label: 'Hero / cover',        min_count: 2,  any_tags: ['river_namkhan', 'river_mekong', 'river_confluence', 'riverbank', 'riverside'], style_tags: ['wide_environmental', 'editorial', 'drone_aerial_style'] },
  { slot: 'exterior',    label: 'Exterior / property', min_count: 5,  any_tags: ['exterior_facade', 'garden', 'rooftop', 'tuk_tuk_lounge'] },
  { slot: 'pool_spa',    label: 'Pool & spa',          min_count: 5,  any_tags: ['pool_area', 'spa_jungle', 'infinity_pool', 'outdoor_bath'] },
  { slot: 'dining',      label: 'Dining',              min_count: 6,  any_tags: ['roots_restaurant', 'riverside', 'bbq_grill', 'tasting_menu', 'set_menu', 'breakfast_basket', 'wine_pairing', 'plated_dish', 'food_flatlay'] },
  { slot: 'lifestyle',   label: 'Lifestyle / activity', min_count: 8, any_tags: ['kayaking', 'sunset_cruise', 'yoga', 'meditation', 'lao_cooking_class', 'spa_massage', 'almsgiving', 'temple_tour'] },
  { slot: 'rooms',       label: 'Rooms (mix across types)', min_count: 8, any_tags: ['canopy_bed', 'mosquito_net', 'balcony', 'terrace', 'daybed', 'outdoor_bath', 'hammock'] },
];

export interface OtaPackSlot {
  slot: string;
  label: string;
  min_count: number;
  found: number;
  gap: number;
  samples: MediaAssetReady[];
}

/** Returns one entry per OTA pack slot with current counts + 5 samples each.
 *  All samples filtered to qc_score >= 70 + brand_fit >= 0.7 + no logos. */
export async function getOtaPack(): Promise<OtaPackSlot[]> {
  const out: OtaPackSlot[] = [];
  for (const slot of OTA_PACK_SLOTS) {
    let q = supabase
      .schema('marketing')
      .from('v_media_ready')
      .select('*', { count: 'exact' })
      .neq('primary_tier', 'tier_archive')
      .gte('qc_score', 70)
      .gte('ai_confidence', 0.7)
      .overlaps('tags', slot.any_tags)
      .order('qc_score', { ascending: false, nullsFirst: false })
      .limit(slot.min_count);
    const { data, count, error } = await q;
    if (error) {
      console.error(`getOtaPack error for ${slot.slot}`, error);
      out.push({ slot: slot.slot, label: slot.label, min_count: slot.min_count, found: 0, gap: slot.min_count, samples: [] });
      continue;
    }
    const found = Number(count ?? 0);
    out.push({
      slot: slot.slot,
      label: slot.label,
      min_count: slot.min_count,
      found,
      gap: Math.max(0, slot.min_count - found),
      samples: (data ?? []) as MediaAssetReady[],
    });
  }
  return out;
}

export async function getMediaTierCounts(): Promise<Array<{
  primary_tier: string | null;
  total: number;
  photos: number;
  videos: number;
}>> {
  const { data, error } = await supabase
    .schema('marketing')
    .from('v_media_by_tier')
    .select('*');
  if (error) {
    console.error('getMediaTierCounts error', error);
    return [];
  }
  return (data ?? []) as any;
}

export async function getMediaRendersBucketUrl(asset: MediaAssetReady, purpose: string): Promise<string | null> {
  // Renders bucket is public, so we can build the URL directly.
  const path = asset.renders?.[purpose];
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  return `${base}/storage/v1/object/public/media-renders/${path}`;
}

// ===== Phase 2: Campaign workflow (2026-05-01) =====

export type CampaignChannel =
  | 'instagram_post' | 'instagram_carousel' | 'instagram_reel' | 'instagram_story'
  | 'facebook_post' | 'tiktok' | 'email_header' | 'email_full'
  | 'booking_com_gallery' | 'expedia_gallery' | 'agoda_gallery' | 'slh_gallery'
  | 'website_hero' | 'pdf_offer' | 'print_poster' | 'blog_header' | 'other';

export type CampaignStatus =
  | 'draft' | 'curating' | 'composing' | 'pending_approval' | 'approved'
  | 'scheduled' | 'published' | 'archived' | 'cancelled';

export type UsageTier =
  | 'tier_ota_profile' | 'tier_website_hero' | 'tier_social_pool' | 'tier_internal';

export interface CampaignTemplate {
  template_id: number;
  channel: CampaignChannel;
  name: string;
  aspect_ratio: string;
  output_width: number;
  output_height: number;
  min_assets: number;
  max_assets: number;
  caption_max_chars: number | null;
  hashtag_max: number | null;
  license_filter: string[] | null;
  logo_position: string | null;
  is_active: boolean;
}

export interface Campaign {
  campaign_id: string;
  name: string;
  channel: CampaignChannel;
  template_id: number | null;
  brief_text: string | null;
  vibe_tags: string[] | null;
  caption: string | null;
  hashtags: string[] | null;
  status: CampaignStatus;
  scheduled_at: string | null;
  published_at: string | null;
  external_post_url: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignCalendarRow extends Campaign {
  calendar_at: string;
  asset_count: number;
}

export interface CampaignAssetRow {
  campaign_id: string;
  slot_order: number;
  asset_id: string;
  caption_per_slot: string | null;
  alt_text_per_slot: string | null;
  final_render_path: string | null;
  created_at: string;
}

export interface TaxonomyEntry {
  tag_id: number;
  category: string;
  label: string;
  parent_id?: number | null;
  synonyms?: string[] | null;
  is_active?: boolean | null;
  used_count?: number | null;
}

// ----- Campaign queries -----

export async function getCampaigns(opts: { status?: CampaignStatus; limit?: number } = {}): Promise<CampaignCalendarRow[]> {
  let q = supabase
    .schema('marketing')
    .from('v_campaign_calendar')
    .select('*')
    .order('calendar_at', { ascending: false });
  if (opts.status) q = q.eq('status', opts.status);
  if (opts.limit)  q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) {
    console.error('getCampaigns error', error);
    return [];
  }
  return (data ?? []) as CampaignCalendarRow[];
}

export async function getCampaign(campaignId: string): Promise<Campaign | null> {
  const { data, error } = await supabase
    .schema('marketing')
    .from('campaigns')
    .select('*')
    .eq('campaign_id', campaignId)
    .maybeSingle();
  if (error) {
    console.error('getCampaign error', error);
    return null;
  }
  return data as Campaign | null;
}

export async function getCampaignAssets(campaignId: string): Promise<CampaignAssetRow[]> {
  const { data, error } = await supabase
    .schema('marketing')
    .from('campaign_assets')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('slot_order', { ascending: true });
  if (error) {
    console.error('getCampaignAssets error', error);
    return [];
  }
  return (data ?? []) as CampaignAssetRow[];
}

export async function getCampaignTemplates(): Promise<CampaignTemplate[]> {
  const { data, error } = await supabase
    .schema('marketing')
    .from('campaign_templates')
    .select('*')
    .eq('is_active', true)
    .order('template_id', { ascending: true });
  if (error) {
    console.error('getCampaignTemplates error', error);
    return [];
  }
  return (data ?? []) as CampaignTemplate[];
}

export async function getTaxonomy(): Promise<TaxonomyEntry[]> {
  const { data, error } = await supabase
    .schema('marketing')
    .from('media_taxonomy')
    .select('*')
    .order('category', { ascending: true })
    .order('label', { ascending: true });
  if (error) {
    console.error('getTaxonomy error', error);
    return [];
  }
  return (data ?? []) as TaxonomyEntry[];
}

export async function getFreeKeywords(): Promise<Array<{ keyword: string; seen_count?: number; promoted_to_tag_id?: number | null }>> {
  const { data, error } = await supabase
    .schema('marketing')
    .from('media_keywords_free')
    .select('*')
    .order('seen_count', { ascending: false, nullsFirst: false })
    .limit(500);
  if (error) {
    console.error('getFreeKeywords error', error);
    return [];
  }
  return (data ?? []) as Array<{ keyword: string; seen_count?: number; promoted_to_tag_id?: number | null }>;
}

// ----- Constants -----

export const TIER_LABEL: Record<UsageTier, string> = {
  tier_ota_profile:  'OTA Profile',
  tier_website_hero: 'Website Hero',
  tier_social_pool:  'Social Pool',
  tier_internal:     'Internal',
};

export const CHANNEL_LABEL: Record<CampaignChannel, string> = {
  instagram_post:      'Instagram · Post',
  instagram_carousel:  'Instagram · Carousel',
  instagram_reel:      'Instagram · Reel',
  instagram_story:     'Instagram · Story',
  facebook_post:       'Facebook · Post',
  tiktok:              'TikTok',
  email_header:        'Email · Header',
  email_full:          'Email · Full',
  booking_com_gallery: 'Booking.com · Gallery',
  expedia_gallery:     'Expedia · Gallery',
  agoda_gallery:       'Agoda · Gallery',
  slh_gallery:         'SLH · Submission',
  website_hero:        'Website · Hero',
  pdf_offer:           'PDF · Offer',
  print_poster:        'Print · Poster',
  blog_header:         'Blog · Header',
  other:               'Custom',
};

export const STATUS_COLOR: Record<CampaignStatus, { bg: string; tx: string; label: string }> = {
  draft:            { bg: 'var(--ink-mute)', tx: '#fff', label: 'draft' },
  curating:         { bg: 'var(--brass)',    tx: '#fff', label: 'curating' },
  composing:        { bg: 'var(--brass)',    tx: '#fff', label: 'composing' },
  pending_approval: { bg: 'var(--brass)',    tx: '#fff', label: 'pending approval' },
  approved:         { bg: 'var(--moss)',     tx: '#fff', label: 'approved' },
  scheduled:        { bg: 'var(--moss)',     tx: '#fff', label: 'scheduled' },
  published:        { bg: 'var(--moss)',     tx: '#fff', label: 'published' },
  archived:         { bg: 'var(--ink-mute)', tx: '#fff', label: 'archived' },
  cancelled:        { bg: 'var(--oxblood)',  tx: '#fff', label: 'cancelled' },
};
