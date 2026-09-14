// lib/rules/evaluateForMarketingBriefings.ts
// PBS 2026-09-14 — marketing briefing evaluator.
// Mirrors evaluateForBriefings.ts pattern for the marketing domain.
// Loads context from fn_mkt_dash_payload (single RPC, returns JSONB) +
// marketing guardrails, then fires evaluateMarketingRules.
// Called by /api/cron/briefing-evaluate and the marketing briefing Refresh button.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { evaluateMarketingRules, type MarketingContext, type MarketingTargets } from '@/lib/rules/marketing';
import type { Insight } from '@/app/_components/ConclusionBlock';

// Re-export insightToUpsertArgs from the revenue evaluator — same shape, we just
// override source_area to 'marketing.*' via the key prefix conventions below.
export { insightToUpsertArgs } from '@/lib/rules/evaluateForBriefings';

function mktSourceArea(key: string): string {
  if (key.startsWith('mkt_direct_') || key.startsWith('mkt_ota_')) return 'marketing.channels';
  if (key.startsWith('mkt_newsletter_') || key.startsWith('mkt_open_') || key.startsWith('mkt_unsub_')) return 'marketing.newsletter';
  if (key.startsWith('mkt_social_') || key.startsWith('mkt_reach_')) return 'marketing.social';
  if (key.startsWith('mkt_prospect_') || key.startsWith('mkt_mx_') || key.startsWith('mkt_cpl_')) return 'marketing.prospects';
  return 'marketing.rules';
}

export function mktInsightToUpsertArgs(propertyId: number, insight: Insight) {
  const source_key = insight.key ?? `mkt:${insight.title.slice(0, 60)}`;
  const source_area = mktSourceArea(source_key);
  const body = [insight.body, insight.evidence, insight.action].filter(Boolean).join('\n\n');
  return {
    p_property_id: propertyId,
    p_source_area: source_area,
    p_source_key: source_key,
    p_severity: insight.priority,
    p_headline: insight.title,
    p_body: body,
    p_cta_kind: insight.href ? 'link' : 'none',
    p_cta_label: insight.action ?? null,
    p_cta_target: insight.href ?? null,
    p_cta_params: {} as Record<string, unknown>,
    p_kpi_baseline: {} as Record<string, unknown>,
  };
}

export async function evaluateForMarketingBriefings(propertyId: number): Promise<Insight[]> {
  const sb = getSupabaseAdmin();

  const [payloadRes, guardrailsRes] = await Promise.all([
    // Use 60-min cache to avoid the ~17s synchronous recompute.
    sb.rpc('fn_mkt_dash_payload', { p_property_id: propertyId, p_max_age_minutes: 60 }),
    sb.from('guardrails')
      .select('rule_key, threshold_val')
      .eq('property_id', propertyId)
      .eq('domain', 'marketing')
      .eq('active', true),
  ]);

  const payload = (payloadRes.data ?? {}) as Record<string, unknown>;
  const tiles = (payload.tiles ?? {}) as Record<string, Record<string, unknown>>;
  const metrics = (payload.metrics ?? {}) as Record<string, unknown>;
  const sub = (tiles.subscribers ?? {}) as Record<string, unknown>;
  const ds  = (tiles.direct_share ?? {}) as Record<string, unknown>;
  const soc = (tiles.social_publishing ?? {}) as Record<string, unknown>;

  // Build targets from guardrails rows.
  const targets: MarketingTargets = {};
  for (const g of (guardrailsRes.data ?? []) as Array<{ rule_key: string; threshold_val: unknown }>) {
    const n = Number(g.threshold_val);
    if (!Number.isFinite(n)) continue;
    (targets as Record<string, number>)[g.rule_key] = n;
  }

  // Days since last social post — derive from last_published_date.
  let daysSinceLastSocialPost: number | null = null;
  const lastPub = soc.last_published_date as string | null | undefined;
  if (lastPub) {
    const ms = Date.now() - new Date(lastPub).getTime();
    daysSinceLastSocialPost = Math.max(0, Math.floor(ms / 86400_000));
  }

  const ctx: MarketingContext = {
    currencySymbol: propertyId === 1000001 ? '€' : '$',

    // Campaign cadence (legacy: days_since_last_send from subscribers tile)
    daysSinceLastCampaignSend: num(sub.days_since_last_send),
    costPerLead: null,             // not in payload yet — rule skips gracefully
    activeCampaigns: 0,            // not in payload yet
    scheduledCampaigns: num(soc.scheduled_future) ?? 0,

    // Prospect quality — not in payload yet; rules skip gracefully
    prospectEnrichmentPct: null,
    mxVerifiedSharePct: null,

    // Newsletter
    openRatePct: null,             // not yet surfaced in payload; placeholder
    unsubRatePct: null,            // same
    daysSinceLastNewsletter: num(sub.days_since_last_send),

    // Channel mix
    directSharePct90d: num(ds.direct_pct_90d),
    otaSharePct90d: num(ds.ota_pct_90d),

    // Social
    daysSinceLastSocialPost,
    scheduledPosts: num(soc.scheduled_future),

    // Reach composite
    compositeChangePct: num(metrics.composite_change_pct),

    targets,
  };

  return evaluateMarketingRules(ctx);
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
