// lib/rules/wiring.ts
// PBS 2026-07-07: manifest declaring which DB rule_keys are actually consumed
// by a rule function AND which upstream data sources each rule needs.
//
// The guardrails settings cockpit reads this to render a live/missing dot
// per rule, so operators know at a glance which thresholds actually affect
// the HoD conclusions vs which are still dangling.
//
// Adding a new wired rule = adding an entry here + a matching case in the
// corresponding /lib/rules/{domain}.ts file.

export type WiringStatus = 'live' | 'not_wired';

export interface RuleWiring {
  status: WiringStatus;
  consumedBy?: string;         // human-readable pointer to the rule function
  requiresData?: string[];     // human-readable list of Supabase views/RPCs
  notWiredReason?: string;     // shown in the tooltip when status='not_wired'
}

// ─────────────────────────────────────────────────────────────
// Per-domain wiring map
// ─────────────────────────────────────────────────────────────
// A rule_key not present in a domain's map is treated as `not_wired`
// with a generic reason ("rule_key not implemented in lib/rules/{domain}.ts").
// Domains not present at all are treated as `not_wired` with reason
// "no rules file for this domain yet".

export const WIRING: Record<string, Record<string, RuleWiring>> = {
  revenue: {
    // Consumed by forward-outlook rules — occupancy_target drives the 14/30/60-90d window thresholds.
    occupancy_target:  { status: 'live', consumedBy: 'ruleShortWindowCritical/ShortMid/LongClosing@revenue.ts', requiresData: ['v_otb_pace'] },
    // NEW: pace_gap_pp now consumed by rulePaceVsSdly (v_otb_pace vs mv_kpi_daily SDLY).
    pace_gap_pp:       { status: 'live', consumedBy: 'rulePaceVsSdly@revenue.ts', requiresData: ['v_otb_pace', 'mv_kpi_daily'] },
    // Moved to "not_wired" by 2026-07-07 v3 rewrite — today-only rules were removed
    // per PBS ("all for today does not help"). Will re-wire against L14 rolling averages.
    adr_target:        { status: 'not_wired', notWiredReason: 'today-only ADR rule removed; needs re-wiring against L14 avg ADR' },
    revpar_target:     { status: 'not_wired', notWiredReason: 'today-only RevPAR rule removed; needs re-wiring against L14 avg RevPAR' },
    pickup_min_daily:  { status: 'not_wired', notWiredReason: 'today-only pickup rule removed; needs re-wiring against L7 avg pickup' },
    cancellation_rate: { status: 'not_wired', notWiredReason: 'no 30d cancel-rate calc wired to /revenue HoD context yet' },
    lead_time_min_days:{ status: 'not_wired', notWiredReason: 'requires avg lead-time calc from v_reservations_unified (not threaded)' },
    leakage_ota_share: { status: 'not_wired', notWiredReason: 'requires OTA channel share calc (not threaded)' },
    parity_breach_usd: { status: 'live', consumedBy: 'ruleIntegrityBreachUsd@parity.ts', requiresData: ['v_rate_integrity_matrix'] },
    compset_stale_days:{ status: 'live', consumedBy: 'ruleLighthouseStale@parity.ts',    requiresData: ['v_lighthouse_rateshop'] },
    integrity_max_spread_pct:   { status: 'live', consumedBy: 'ruleIntegrityMaxSpread@parity.ts',   requiresData: ['v_rate_integrity_matrix'] },
    integrity_soldout_days_max: { status: 'live', consumedBy: 'ruleIntegritySoldOutDays@parity.ts', requiresData: ['v_rate_integrity_matrix'] },
    lighthouse_stale_days:      { status: 'live', consumedBy: 'ruleLighthouseStale@parity.ts',     requiresData: ['v_lighthouse_rateshop'] },
    // PBS 2026-07-09 pm: compset conclusions.
    compset_undercut_days_pct:      { status: 'live', consumedBy: 'ruleCompsetUndercutDays@parity.ts', requiresData: ['v_parity_matrix_pb'] },
    compset_avg_delta_pct:          { status: 'live', consumedBy: 'ruleCompsetAvgDelta@parity.ts',    requiresData: ['v_parity_matrix_pb'] },
    compset_rate_change_3d_max_pct: { status: 'live', consumedBy: 'ruleCompsetRateChange3d@parity.ts', requiresData: ['v_lighthouse_rateshop'] },
    compset_rate_change_7d_max_pct: { status: 'live', consumedBy: 'ruleCompsetRateChange7d@parity.ts', requiresData: ['v_lighthouse_rateshop'] },
    // PBS 2026-07-09 pm: rate-plan hygiene guardrails.
    nrr_share_target:               { status: 'live', consumedBy: 'ruleNrrShareTarget@rateplans.ts',        requiresData: ['v_rate_plan_hygiene'] },
    early_bird_share_target:        { status: 'live', consumedBy: 'ruleEarlyBirdShareTarget@rateplans.ts', requiresData: ['v_rate_plan_hygiene'] },
    flex_share_max:                 { status: 'live', consumedBy: 'ruleFlexShareMax@rateplans.ts',         requiresData: ['v_rate_plan_hygiene'] },
    sleeping_plan_max_days:         { status: 'live', consumedBy: 'ruleSleepingPlanMax@rateplans.ts',      requiresData: ['v_rate_plan_hygiene'] },
    never_booked_plan_max_share:    { status: 'live', consumedBy: 'ruleNeverBookedShare@rateplans.ts',     requiresData: ['v_rate_plan_hygiene'] },
    orphan_catalogue_gap_max:       { status: 'live', consumedBy: 'ruleOrphanCatalogueGap@rateplans.ts',   requiresData: ['v_rate_plan_hygiene'] },
    // PBS 2026-07-17: page-scoped dynamic rules from evaluateDynamicPageRules.
    hod_pickup_missed_yesterday:        { status: 'live', consumedBy: 'evaluateDynamicPageRules@dynamicPageRules.ts', requiresData: ['fn_hod_day_activity','fn_guardrail_effective_threshold'] },
    pulse_low_occ_cluster_next14:       { status: 'live', consumedBy: 'evaluateDynamicPageRules@dynamicPageRules.ts', requiresData: ['v_otb_pace'] },
    pace_behind_60d_out:                { status: 'live', consumedBy: 'evaluateDynamicPageRules@dynamicPageRules.ts', requiresData: ['v_otb_pace','mv_kpi_daily'] },
    pace_ahead_30d_out:                 { status: 'live', consumedBy: 'evaluateDynamicPageRules@dynamicPageRules.ts', requiresData: ['v_otb_pace','mv_kpi_daily'] },
    compset_we_cheapest_not_soldout:    { status: 'live', consumedBy: 'evaluateDynamicPageRules@dynamicPageRules.ts', requiresData: ['v_parity_matrix_pb','v_otb_pace'] },
    markets_country_early_bird_closing: { status: 'live', consumedBy: 'evaluateDynamicPageRules@dynamicPageRules.ts', requiresData: ['v_country_stay_month_heatmap'] },
    markets_country_demand_surge:       { status: 'live', consumedBy: 'evaluateDynamicPageRules@dynamicPageRules.ts', requiresData: ['v_country_stay_month_heatmap'] },
    markets_country_new_market_signal:  { status: 'live', consumedBy: 'evaluateDynamicPageRules@dynamicPageRules.ts', requiresData: ['v_country_market_summary'] },
  },

  retention: {
    cancel_rate_target:    { status: 'live', consumedBy: 'ruleCancelRateHigh@retention.ts',       requiresData: ['pms.v_reservations'] },
    repeat_rate_target:    { status: 'live', consumedBy: 'ruleRepeatRateBelowTarget@retention.ts',requiresData: ['mv_guest_profile'] },
    no_shows_warn:         { status: 'live', consumedBy: 'ruleNoShows@retention.ts',              requiresData: ['pms.v_reservations'] },
    no_shows_critical:     { status: 'live', consumedBy: 'ruleNoShows@retention.ts',              requiresData: ['pms.v_reservations'] },
    winback_pool_warn:     { status: 'live', consumedBy: 'ruleWinbackDormant@retention.ts',       requiresData: ['mv_guest_profile'] },
    winback_pool_critical: { status: 'live', consumedBy: 'ruleWinbackDormant@retention.ts',       requiresData: ['mv_guest_profile'] },
    prestay_reach_target:  { status: 'live', consumedBy: 'rulePreStayCoverage@retention.ts',      requiresData: ['v_directory_full'] },
    arrival_cover_rate_min:{ status: 'not_wired', notWiredReason: 'newsletter arrival-cover calc not threaded to retention rules' },
    checkout_cover_rate_min:{ status: 'not_wired', notWiredReason: 'newsletter departure-cover calc not threaded to retention rules' },
  },

  reputation: {
    response_rate_target:  { status: 'live', consumedBy: 'ruleResponseRate@reputation.ts',      requiresData: ['mkt_reviews'] },
    low_scoring_unanswered:{ status: 'live', consumedBy: 'ruleLowScoringUnanswered@reputation.ts',requiresData: ['mkt_reviews'] },
    rating_drop_pp:        { status: 'live', consumedBy: 'ruleAvgRatingDrop@reputation.ts',     requiresData: ['mkt_reviews'] },
    scrape_stale_days:     { status: 'live', consumedBy: 'ruleScrapeStale@reputation.ts',       requiresData: ['mkt_reviews'] },
  },

  newsletter: {
    open_rate_target:     { status: 'live', consumedBy: 'ruleOpenRate@newsletter.ts',       requiresData: ['campaign_recipients'] },
    open_rate_min:        { status: 'live', consumedBy: 'ruleOpenRate@newsletter.ts',       requiresData: ['campaign_recipients'] },
    unsub_rate_target:    { status: 'live', consumedBy: 'ruleUnsubRate@newsletter.ts',      requiresData: ['campaign_recipients'] },
    unsub_rate_max:       { status: 'live', consumedBy: 'ruleUnsubRate@newsletter.ts',      requiresData: ['campaign_recipients'] },
    contactable_share:    { status: 'live', consumedBy: 'ruleContactableShare@newsletter.ts',requiresData: ['v_directory_full'] },
    days_since_send_warn: { status: 'live', consumedBy: 'ruleLongSinceSend@newsletter.ts',  requiresData: ['campaigns'] },
    campaign_cadence_days_min: { status: 'not_wired', notWiredReason: 'cadence-window rule not implemented' },
    mx_verified_share_min:{ status: 'not_wired', notWiredReason: 'MX verify share not calculated in newsletter context' },
  },

  observations: {
    no_country_share:     { status: 'live', consumedBy: 'ruleNoCountry@observations.ts',    requiresData: ['v_directory_full'] },
    no_email_share:       { status: 'live', consumedBy: 'ruleMissingEmail@observations.ts', requiresData: ['v_directory_full'] },
    no_source_share:      { status: 'live', consumedBy: 'ruleNoSource@observations.ts',     requiresData: ['pms.v_reservations'] },
    ota_no_email_share:   { status: 'live', consumedBy: 'ruleOtaNoEmail@observations.ts',   requiresData: ['pms.v_reservations'] },
    review_no_body_share: { status: 'live', consumedBy: 'ruleReviewsNoBody@observations.ts',requiresData: ['mkt_reviews'] },
  },

  sales: {
    inquiry_response_hours: { status: 'live', consumedBy: 'ruleInquiryResponseSlow@sales.ts', requiresData: ['sales_inquiries'] },
    conversion_rate:        { status: 'not_wired', notWiredReason: 'inquiry→booking conversion calc not threaded yet' },
    cost_per_lead_max:      { status: 'not_wired', notWiredReason: 'lead-source cost calc not threaded (needs ad-spend feed)' },
    group_lead_time_days:   { status: 'not_wired', notWiredReason: 'group-booking lead-time calc not threaded' },
  },

  marketing: {
    campaign_cadence_days_min: { status: 'live', consumedBy: 'ruleCampaignGap@marketing.ts',   requiresData: ['campaigns'] },
    cost_per_lead_max:         { status: 'not_wired', notWiredReason: 'ad-spend CPL calc not threaded' },
    prospect_enrichment_min:   { status: 'not_wired', notWiredReason: 'prospect enrichment % calc not threaded (web_analytics.subscribers)' },
    mx_verified_share_min:     { status: 'not_wired', notWiredReason: 'MX-verified share calc not threaded' },
  },

  operations: {
    fnb_capture_target:   { status: 'live', consumedBy: 'ruleFnbCapture@operations.ts',        requiresData: ['v_ancillary_capture_daily'] },
    spa_capture_target:   { status: 'live', consumedBy: 'ruleSpaCapture@operations.ts',        requiresData: ['v_ancillary_capture_daily'] },
    activities_capture:   { status: 'live', consumedBy: 'ruleActivitiesCapture@operations.ts', requiresData: ['v_ancillary_capture_daily'] },
    housekeeping_lag_min: { status: 'not_wired', notWiredReason: 'housekeeping lag calc not threaded' },
    inventory_low_par:    { status: 'not_wired', notWiredReason: 'inventory par-level calc not threaded' },
    supplier_late_days:   { status: 'not_wired', notWiredReason: 'supplier-delivery lateness calc not threaded' },
  },

  finance: {
    ap_late_days:       { status: 'not_wired', notWiredReason: 'AP aging RPC not wired to /finance HoD' },
    ar_days_max:        { status: 'not_wired', notWiredReason: 'AR aging RPC not wired to /finance HoD' },
    cash_days_min:      { status: 'not_wired', notWiredReason: 'cash runway calc not wired to /finance HoD' },
    payroll_pct_target: { status: 'not_wired', notWiredReason: 'payroll % of revenue calc not wired' },
    gop_margin_target:  { status: 'not_wired', notWiredReason: 'GOP margin MTD calc not wired' },
    variance_pl_pp:     { status: 'not_wired', notWiredReason: 'budget variance calc not wired' },
    food_cost_pct_max:  { status: 'not_wired', notWiredReason: 'F&B COGS % calc not wired' },
    beverage_cost_pct_max: { status: 'not_wired', notWiredReason: 'beverage COGS % calc not wired' },
  },

  contacts: {},
};

export function getWiring(domain: string, rule_key: string): RuleWiring {
  const dom = WIRING[domain];
  if (!dom) return { status: 'not_wired', notWiredReason: `domain '${domain}' has no rules file yet` };
  const w = dom[rule_key];
  if (!w) return { status: 'not_wired', notWiredReason: `rule_key not implemented in lib/rules/${domain}.ts` };
  return w;
}

// ─────────────────────────────────────────────────────────────
// Data-probe layer
// ─────────────────────────────────────────────────────────────
// Given a set of source names collected from wiring rows, decide which are
// currently "empty" (no data flowing). The guardrails settings page runs
// these probes in parallel via getSupabaseAdmin() and passes the set of
// missing sources back into computeRuleStatus() below.

export type ProbeResult = { ok: boolean; reason?: string };

export interface RuleStatus {
  status: 'live' | 'data_missing' | 'not_wired';
  reason?: string;               // human-readable, shown in tooltip
  consumedBy?: string;
}

export function computeRuleStatus(
  domain: string,
  rule_key: string,
  active: boolean,
  probeResults: Record<string, ProbeResult>,
): RuleStatus {
  if (!active) {
    // Inactive rows are neither live nor red — the client dims them separately.
    return { status: 'not_wired', reason: 'rule inactive (active=false)' };
  }
  const w = getWiring(domain, rule_key);
  if (w.status === 'not_wired') {
    return {
      status: 'not_wired',
      reason: w.notWiredReason ?? `no rule function evaluates ${domain}.${rule_key}`,
    };
  }
  // Wired — check all required data sources.
  // OPTIMISTIC-ON-UNKNOWN: if a probe wasn't run for a source (no entry in probeResults),
  // treat as live rather than false-red. Only flag missing when a probe returned ok=false.
  const missing: string[] = [];
  for (const src of w.requiresData ?? []) {
    const pr = probeResults[src];
    if (pr && !pr.ok) missing.push(src + (pr.reason ? ` (${pr.reason})` : ''));
  }
  if (missing.length > 0) {
    return {
      status: 'data_missing',
      reason: `data missing: ${missing.join(' · ')}`,
      consumedBy: w.consumedBy,
    };
  }
  return {
    status: 'live',
    reason: `wired via ${w.consumedBy}${(w.requiresData ?? []).length ? ' · reads ' + (w.requiresData ?? []).join(', ') : ''}`,
    consumedBy: w.consumedBy,
  };
}
