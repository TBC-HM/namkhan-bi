// Shape of public.fn_mkt_dash_payload(p_property_id, p_max_age_minutes)
// Only the keys the page reads are typed; everything else is passed through as Record<string, unknown>.

export type Num = number | null;
// Widened payload value type. jsonb numerics can arrive as strings, and whole
// tiles are JSON null for a tenant with no marketing.dash_source_map row, so the
// display helpers accept everything the payload can actually hand them.
export type Val = number | string | boolean | null | undefined;

export interface Action {
  rank: number; rule_key: string; category: string; severity: 'red' | 'amber' | 'grey';
  title: string; detail: string; route_path: string; cta_label: string;
  route_path_2: string | null; cta_label_2: string | null;
  metric_key: string; metric_value: Num; threshold: Num;
}

export interface BarometerRow {
  channel_key: string; method: string; now_asof: string; now_value: Num;
  before_asof: string; before_value: Num; change_pct: Num; change_abs: Num;
  direction: 'up' | 'down' | 'flat' | 'unknown'; days_apart: Num;
}

export interface Freshness { source_key: string; label: string; asof: string | null; days_old: Num; status: 'fresh' | 'warn' | 'bad' | 'missing' }
export interface SeriesPoint { d: string; v: Num }
export interface ChannelMix { window_key: string; channel_dash: string; bookings: number; nights: number; revenue: number; pct_revenue: Num; pct_nights: Num }
export interface Market { window_key: string; country: string; bookings: number; nights: number; revenue: number; pct_revenue: Num; rank_revenue: number }
export interface Source { source_name: string; channel_dash: string; bookings: number; revenue: number; avg_booking_value: Num; pct_revenue: Num; rank_revenue: number }
export interface WeeklyBooking { week_start: string; bookings: number; revenue: number; direct_slh_pct: Num; is_partial_week: boolean }
export interface Pipeline { stream: string; planned: Num; approved: Num; ready: Num; published: Num; sort_order: number }
export interface Agenda { item_date: string; item_type: 'email_slot' | 'domain_expiry' | 'goal_deadline'; title: string; detail: string; status: string }
export interface Goal {
  goal_id: number; title: string; metric: string; target_value: Num; deadline: string | null;
  computed_value: Num; computed_label: string | null; computed_source: string | null;
  status_flag: 'ok' | 'warn' | 'bad' | 'na'; stored_current_value: Num; days_to_deadline: Num;
}
export interface IcpProfile {
  icp_key: string; name: string; icp_type: string; bookings_89d: Num; revenue_89d: Num; adr_89d: Num; los_89d: Num;
  actual_share_revenue_pct: Num; target_share_pct: Num; source_countries: string[] | null; booking_channels: string[] | null;
}
export interface SocialPlatform { platform: string; asof: string; impressions: Num; reach: Num; followers: Num; before_impressions: Num; impressions_change_pct: Num; followers_change: Num; no_data: boolean }
export interface SubscriberGroup { slug: string; name: string; members: number; cadence_per_month: Num }
export interface SubscribersTile {
  rows_real: Num; rows_total: Num; rows_foreign: Num; new_real_30d: Num; new_real_prev_30d: Num;
  src_pms: Num; src_gmail: Num; src_dmc: Num; src_manual: Num;
  sends_broadcast: Num; sends_lifecycle: Num; sends_total: Num; sends_30d: Num;
  last_send_date: string | null; days_since_last_send: Num;
  unsubscribed: Num; bounced: Num; blocklist_scoped: Num; blocklist_unscoped: Num;
  groups: SubscriberGroup[] | null;
}
export interface IcpCoverage {
  bookings_total: Num; bookings_matched: Num; bookings_matched_pct: Num;
  revenue_total: Num; revenue_matched: Num; revenue_matched_pct: Num;
  profiles_total: Num; profiles_zero_bookings: Num; profiles_with_target: Num;
  feeds_ingesting: Num; feeds_total: Num; snapshot_week: string | null;
}

export interface Payload {
  property_id: number; generated_at: string; cached?: boolean; cache_age_sec?: number;
  metrics: Record<string, number | string | null>;
  badges: {
    today: { actions: number; actions_red: number; composite_change_pct: Num };
    revenue: { direct_pct_90d: Num; direct_slh_pct_90d: Num };
    reach: { published_30d: Num; sends_30d: Num };
    segments: { bookings_matched_pct: Num };
    goals: { measured: Num; stored: Num; total: Num };
  };
  actions: Action[];
  freshness: Freshness[];
  barometer: BarometerRow[];
  series: Record<string, SeriesPoint[]>;
  // Every tile is JSON null for a tenant without a marketing.dash_source_map row
  // (Donna 1000001 today) — the component optional-chains all of them.
  tiles: {
    direct_share: Record<string, Num> | null; bookings: Record<string, Num | string> | null; reputation: Record<string, Num | string> | null;
    reviews_monthly: { month_start: string; reviews: number; avg_rating: Num; low_reviews: number; is_partial_month: boolean }[] | null;
    demand_inbox: Record<string, Num | string> | null; inquiries_weekly: { week_start: string; inquiries: number; is_partial_week: boolean }[] | null;
    website: Record<string, Num | string> | null; search: Record<string, Num | string> | null;
    social_platforms: SocialPlatform[] | null; social_publishing: Record<string, Num | string | boolean> | null;
    subscribers: SubscribersTile | null;
    funnels: Record<string, Num | boolean> | null; retreats: Record<string, Num | string> | null; villa_direct: Record<string, Num> | null;
    icp_coverage: IcpCoverage | null; icp_profiles: IcpProfile[] | null;
  };
  origin: { markets_ytd: Market[]; markets_90d: Market[]; sources_90d: Source[]; channel_mix: ChannelMix[]; bookings_weekly: WeeklyBooking[] };
  pipeline: Pipeline[]; agenda: Agenda[]; goals: Goal[];
  deploy: { vercel_project_name: string; commit_short: string; commit_message: string; prod_aliased_at: string; commit_author_name: string } | null;
}

export type TabKey = 'today' | 'revenue' | 'reach' | 'segments' | 'goals';
export const TABS: { key: TabKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'reach', label: 'Reach' },
  { key: 'segments', label: 'Segments & funnels' },
  { key: 'goals', label: 'Goals & data' },
];
