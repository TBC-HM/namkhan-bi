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
    occupancy_target:  { status: 'live', consumedBy: 'ruleOccupancy@revenue.ts',   requiresData: ['fn_revenue_hod_today_kpi'] },
    adr_target:        { status: 'live', consumedBy: 'ruleAdr@revenue.ts',         requiresData: ['fn_revenue_hod_today_kpi'] },
    revpar_target:     { status: 'live', consumedBy: 'ruleRevpar@revenue.ts',      requiresData: ['fn_revenue_hod_today_kpi'] },
    pickup_min_daily:  { status: 'live', consumedBy: 'rulePickupMinDaily@revenue.ts', requiresData: ['getPulseTodayPickup'] },
    cancellation_rate: { status: 'not_wired', notWiredReason: 'no 30d cancel-rate calc wired to /revenue HoD context yet — only today\'s count' },
    pace_gap_pp:       { status: 'not_wired', notWiredReason: 'requires pace vs SDLY view (not threaded into /revenue HoD)' },
    lead_time_min_days:{ status: 'not_wired', notWiredReason: 'requires avg lead-time calc from pms.v_reservations (not threaded)' },
    leakage_ota_share: { status: 'not_wired', notWiredReason: 'requires OTA channel share calc (not threaded)' },
    parity_breach_usd: { status: 'not_wired', notWiredReason: 'requires parity scan data (not threaded)' },
    compset_stale_days:{ status: 'not_wired', notWiredReason: 'requires comp-set last-scrape date (not threaded)' },
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

  // Domains without any rules file yet — every DB rule_key resolves to `not_wired`
  sales:      {},
  marketing:  {},
  contacts:   {},
  operations: {},
  finance:    {},
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
  // Wired — check all required data sources
  const missing: string[] = [];
  for (const src of w.requiresData ?? []) {
    const pr = probeResults[src];
    if (!pr || !pr.ok) missing.push(src + (pr?.reason ? ` (${pr.reason})` : ''));
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
