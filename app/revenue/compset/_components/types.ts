// app/revenue/compset/_components/types.ts
// Shared row types for the compset v3 page. All shapes mirror the public.v_compset_*
// proxies (which pass-through the revenue.* views). Verified against information_schema
// 2026-05-03.

export type SetSummaryRow = {
  set_id: string;
  set_name: string;
  set_type: 'manual' | 'ai_proposed' | 'pms' | 'bdc_rate_insights' | 'external_feed';
  is_primary: boolean;
  created_at: string;
  property_count: number;
  self_count: number;
  shop_days_last_7: number;
  last_shop_date: string | null;
  successful_obs_7d: number;
  failed_obs_7d: number;
  data_freshness: 'fresh' | 'aging' | 'stale' | 'no_data';
};

export type PropertySummaryRow = {
  comp_id: string;
  set_id: string;
  set_name: string;
  set_type: string;
  property_name: string;
  is_self: boolean;
  scrape_priority: number | null;
  star_rating: number | null;
  rooms: number | null;
  bdc_url: string | null;
  agoda_url: string | null;
  expedia_url: string | null;
  trip_url: string | null;
  direct_url: string | null;
  has_bdc: boolean;
  has_agoda: boolean;
  has_expedia: boolean;
  has_trip: boolean;
  has_direct: boolean;
  review_score: number | null;
  review_count: number | null;
  channels_with_reviews: number | null;
  reviews_by_channel: Record<string, unknown> | null;
  latest_usd: number | null;
  latest_channel: string | null;
  last_shop_date: string | null;
  avg_30d_usd: number | null;
  obs_count_30d: number | null;
  min_30d_usd: number | null;
  max_30d_usd: number | null;
  pct_vs_median: number | null;
  last_shop_human: string | null;
};

export type DataMaturityRow = {
  distinct_shop_days: number;
  first_shop_date: string | null;
  last_shop_date: string | null;
  total_observations: number;
  properties_with_data: number;
  maturity_stage:
    | 'no_data'
    | 'bootstrapping'
    | 'baseline'
    | 'trends_emerging'
    | 'mature';
  status_message: string;
  show_simple_trends: boolean;
  show_full_charts: boolean;
  show_anomaly_detection: boolean;
};

export type PromoBehaviorRow = {
  comp_id: string;
  property_name: string;
  is_self: boolean;
  days_with_data: number;
  days_with_promo: number;
  promo_frequency_pct: number | null;
  avg_discount_pct: number | null;
  max_discount_seen: number | null;
  pattern:
    | 'no_data'
    | 'no_promos'
    | 'sustained_low_discount'
    | 'sustained_aggressive'
    | 'flash_burst'
    | 'periodic'
    | 'occasional';
  pattern_label: string;
};

export type RatePlanGapRow = {
  taxonomy_code: string;
  plan_name: string;
  category: string | null;
  comps_count: number;
  comp_coverage_pct: number | null;
  avg_discount: number | null;
  avg_rate_usd: number | null;
  comps_offering_list: string[] | null;
  easy_win_score: number | null;
};

export type NamkhanVsCompRow = {
  taxonomy_code: string;
  plan_name: string;
  category: string | null;
  namkhan_avg_rate: number | null;
  comp_avg_rate: number | null;
  comps_with_plan: number;
  price_diff_usd: number | null;
  price_diff_pct: number | null;
  positioning:
    | 'we_dont_offer'
    | 'comps_dont_offer'
    | 'aligned'
    | 'priced_above'
    | 'priced_below';
};

export type RatePlanLandscapeRow = {
  category: string | null;
  taxonomy_code: string;
  plan_name: string;
  competitors_offering: number;
  comps_offering_excl_self: number;
  channels_seen: number;
  avg_rate_usd: number | null;
  avg_discount_when_promoted: number | null;
  namkhan_offers: boolean;
  comps_offering_list: string[] | null;
};

export type AgentRunSummaryRow = {
  run_id: string;
  agent_id: string;
  agent_code: string;
  agent_name: string;
  started_at: string | null;
  finished_at: string | null;
  status: 'running' | 'success' | 'partial' | 'failed' | string | null;
  duration_ms: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  cost_usd: number | null;
  proposals_created: number | null;
  error_message: string | null;
  minutes_ago: number | null;
};

export type AgentRow = {
  agent_id: string;
  code: string;
  name: string;
  status: string | null;
  schedule_human: string | null;
  model_id: string | null;
  monthly_budget_usd: number | null;
  month_to_date_cost_usd: number | null;
  last_run_at: string | null;
  runtime_settings: Record<string, unknown> | null;
};

export type UpcomingEventRow = {
  event_id: string;
  display_name: string;
  type_code: string | null;
  type_display: string | null;
  category: string | null;
  date_start: string;
  date_end: string | null;
  buildup_start: string | null;
  days_until_event: number | null;
  days_until_buildup: number | null;
  status: 'live' | 'buildup' | 'imminent' | 'horizon' | string | null;
  demand_score: number | null;
  source_markets: string[] | null;
};

export type ScrapeDateRow = {
  stay_date: string;
  total_score: number;
  dow_score: number;
  event_score: number;
  lead_time_score: number;
  events: string[] | null;
  reason: string | null;
};

// =============================================================================
// Pattern → icon / colour mappings (per addendum: hardcode the mapping, NOT data)
// =============================================================================

export const PROMO_PATTERN_ICONS: Record<PromoBehaviorRow['pattern'], string> = {
  no_data: 'o',
  no_promos: '—',
  sustained_low_discount: '─',
  sustained_aggressive: '━',
  flash_burst: '⚡',
  periodic: '∿',
  occasional: '·',
};

export const PROMO_PATTERN_COLORS: Record<PromoBehaviorRow['pattern'], string> = {
  no_data: 'var(--ink-mute)',
  no_promos: 'var(--ink-mute)',
  sustained_low_discount: 'var(--moss-glow)',
  sustained_aggressive: 'var(--st-bad)',
  flash_burst: 'var(--brass)',
  periodic: 'var(--brass-soft)',
  occasional: 'var(--ink-soft)',
};

export const MATURITY_STAGE_TONE: Record<
  DataMaturityRow['maturity_stage'],
  { tone: 'inactive' | 'pending' | 'active' | 'info' | 'expired'; label: string }
> = {
  no_data:        { tone: 'inactive', label: 'NO DATA' },
  bootstrapping:  { tone: 'pending',  label: 'BOOTSTRAPPING' },
  baseline:       { tone: 'pending',  label: 'BUILDING' },
  trends_emerging:{ tone: 'active',   label: 'TRENDS' },
  mature:         { tone: 'active',   label: 'MATURE' },
};

// =============================================================================
// DEEP-VIEW row types — sourced from public.v_compset_competitor_* proxies
// added 2026-05-03 for the inline row-expand on PropertyTable.
// =============================================================================

export type CompetitorPropertyDetailRow = {
  comp_id: string;
  set_id: string;
  property_name: string;
  is_self: boolean;
  scrape_priority: number | null;
  star_rating: number | null;
  rooms: number | null;
  city: string | null;
  country: string | null;
  room_type_target: string | null;
  bdc_url: string | null;
  bdc_property_id: string | null;
  agoda_url: string | null;
  agoda_property_id: string | null;
  expedia_url: string | null;
  trip_url: string | null;
  trip_property_id: string | null;
  traveloka_url: string | null;
  traveloka_property_id: string | null;
  direct_url: string | null;
  google_place_id: string | null;
  is_active: boolean | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type CompetitorRoomMappingRow = {
  mapping_id: string;
  comp_id: string;
  channel: string;
  competitor_room_name: string | null;
  competitor_room_size_sqm: number | null;
  competitor_max_occupancy: number | null;
  competitor_bed_config: string | null;
  our_room_tier: string | null;
  our_room_type_id: string | null;
  is_target_room: boolean | null;
  notes: string | null;
  verified_at: string | null;
};

export type CompetitorRatePlanMixRow = {
  comp_id: string;
  property_name: string | null;
  is_self: boolean | null;
  channel: string;
  taxonomy_code: string;
  plan_name: string;
  category: string | null;
  dates_offered: number | null;
  avg_rate_usd: number | null;
  min_rate_usd: number | null;
  max_rate_usd: number | null;
  avg_discount_pct: number | null;
  has_member_variant: boolean | null;
  distinct_labels: number | null;
};

export type CompetitorRateMatrixRow = {
  comp_id: string;
  stay_date: string;
  channel: string;
  rate_usd: number | null;
  is_available: boolean | null;
  is_refundable: boolean | null;
  shop_date: string | null;
  scrape_status: string | null;
  display_date: string | null;
  events: string[] | null;
  event_score: number | null;
};

export type RankingLatestRow = {
  comp_id: string;
  channel: string;
  search_destination: string | null;
  sort_order: string;
  position: number | null;
  total_results: number | null;
  page_number: number | null;
  is_above_fold: boolean | null;
  is_first_page: boolean | null;
  has_sponsored_badge: boolean | null;
  has_genius_badge: boolean | null;
  shop_date: string | null;
  days_old: number | null;
  prev_position: number | null;
  positions_gained: number | null;
  movement: string | null;
};

export type CompetitorReviewsSummaryRow = {
  comp_id: string;
  weighted_score: number | null;
  total_reviews: number | null;
  channels_with_reviews: number | null;
  by_channel: Record<string, unknown> | null;
};

/** All deep-view data for a single competitor, assembled server-side. */
export type CompetitorDeepData = {
  detail: CompetitorPropertyDetailRow | null;
  roomMappings: CompetitorRoomMappingRow[];
  ratePlanMix: CompetitorRatePlanMixRow[];
  rateMatrix: CompetitorRateMatrixRow[];
  rankings: RankingLatestRow[];
  reviewsSummary: CompetitorReviewsSummaryRow | null;
  ratePlansLive: RatePlanLiveRow[];
};

/** Per-comp tile row from public.v_compset_promo_tiles — single tile in the
 *  PROMO BEHAVIOR strip showing latest BDC price + promo frequency. */
export type PromoTileRow = {
  comp_id: string;
  property_name: string;
  is_self: boolean;
  latest_rate_usd: number | null;
  latest_room: string | null;
  last_shop_date: string | null;
  latest_stay_date: string | null;
  latest_is_refundable: boolean | null;
  promo_frequency_pct: number | null;
  avg_discount_pct: number | null;
  max_discount_seen: number | null;
  pattern: string | null;
  pattern_label: string | null;
  days_with_promo: number | null;
  days_with_data: number | null;
};

/** Per-plan row from public.v_compset_rate_plans_latest (latest shop_date per cell). */
export type RatePlanLiveRow = {
  plan_id: string;
  comp_id: string;
  channel: string;
  shop_date: string;
  stay_date: string;
  raw_label: string;
  raw_room_type: string | null;
  rate_usd: number | null;
  is_refundable: boolean | null;
  prepayment_required: boolean | null;
  cancellation_deadline_days: number | null;
  meal_plan: string | null;
  has_strikethrough: boolean | null;
  strikethrough_rate_usd: number | null;
  discount_pct: number | null;
  promo_label: string | null;
  is_member_only: boolean | null;
  los_nights: number | null;
};

/** Channels whose URL we surface in the deep-view URL grid.
 *  Agoda removed 2026-05-04 — Namkhan has no Agoda account, no need to track. */
export const DEEP_VIEW_CHANNELS: ReadonlyArray<{
  key: 'bdc' | 'expedia' | 'trip' | 'direct';
  label: string;
}> = [
  { key: 'bdc',     label: 'Booking.com' },
  { key: 'expedia', label: 'Expedia' },
  { key: 'trip',    label: 'Trip.com' },
  { key: 'direct',  label: 'Direct website' },
];

/** Six (channel × sort) ranking contexts surfaced in the rankings grid. */
export const DEEP_VIEW_RANKING_CONTEXTS: ReadonlyArray<{
  channel: string;
  sort_order: string;
  channel_label: string;
  sort_label: string;
}> = [
  { channel: 'bdc',     sort_order: 'recommended', channel_label: 'BOOKING', sort_label: 'Recommended' },
  { channel: 'bdc',     sort_order: 'price_asc',   channel_label: 'BOOKING', sort_label: 'Price asc' },
  { channel: 'bdc',     sort_order: 'rating',      channel_label: 'BOOKING', sort_label: 'Rating' },
  { channel: 'agoda',   sort_order: 'recommended', channel_label: 'AGODA',   sort_label: 'Recommended' },
  { channel: 'agoda',   sort_order: 'price_asc',   channel_label: 'AGODA',   sort_label: 'Price asc' },
  { channel: 'expedia', sort_order: 'recommended', channel_label: 'EXPEDIA', sort_label: 'Recommended' },
];
