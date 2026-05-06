-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504191541
-- Name:    2026_05_04_compset_analytics_views_v4
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- v4: match exact column types of the original views.
-- channels_seen is bigint (count) not text[] in the original schema.

CREATE OR REPLACE VIEW public.v_compset_rate_plan_landscape AS
WITH plan_types AS (
  SELECT
    rp.comp_id, cp.property_name, cp.is_self, rp.channel,
    CASE WHEN rp.is_refundable = true  THEN 'flexible'
         WHEN rp.is_refundable = false THEN 'restrictive'
         ELSE 'unknown' END AS category,
    UPPER(COALESCE(rp.meal_plan,'unknown')) || '_' ||
      CASE WHEN rp.is_refundable = true THEN 'REF'
           WHEN rp.is_refundable = false THEN 'NRF'
           ELSE 'UNK' END AS taxonomy_code,
    INITCAP(REPLACE(COALESCE(rp.meal_plan,'unknown'),'_',' ')) || ' · ' ||
      CASE WHEN rp.is_refundable = true THEN 'refundable'
           WHEN rp.is_refundable = false THEN 'non-refundable'
           ELSE 'unknown cancel' END AS plan_name,
    rp.rate_usd, rp.discount_pct, rp.promo_label
  FROM revenue.competitor_rate_plans rp
  JOIN revenue.competitor_property cp ON cp.comp_id = rp.comp_id
  WHERE rp.scrape_status = 'success' AND rp.rate_usd IS NOT NULL
    AND cp.set_id IN (SELECT set_id FROM revenue.competitor_set WHERE is_primary = true)
)
SELECT
  category, taxonomy_code, plan_name,
  COUNT(DISTINCT comp_id)                                          AS competitors_offering,
  COUNT(DISTINCT comp_id) FILTER (WHERE NOT is_self)               AS comps_offering_excl_self,
  COUNT(DISTINCT channel)                                          AS channels_seen,
  ROUND(AVG(rate_usd)::numeric, 2)                                 AS avg_rate_usd,
  ROUND(AVG(discount_pct) FILTER (WHERE discount_pct IS NOT NULL)::numeric, 1)
                                                                    AS avg_discount_when_promoted,
  bool_or(is_self)                                                  AS namkhan_offers,
  array_agg(DISTINCT property_name) FILTER (WHERE NOT is_self)     AS comps_offering_list
FROM plan_types
GROUP BY category, taxonomy_code, plan_name
ORDER BY competitors_offering DESC, plan_name;

CREATE OR REPLACE VIEW public.v_compset_rate_plan_gaps AS
SELECT
  l.taxonomy_code, l.plan_name, l.category,
  l.comps_offering_excl_self                                            AS comps_count,
  ROUND(
    (l.comps_offering_excl_self::numeric / NULLIF(
      (SELECT COUNT(*) FROM revenue.competitor_property cp
       WHERE cp.is_active AND NOT cp.is_self
         AND cp.set_id IN (SELECT set_id FROM revenue.competitor_set WHERE is_primary=true)
      )::numeric, 0)
    ) * 100, 1)                                                          AS comp_coverage_pct,
  l.avg_discount_when_promoted                                           AS avg_discount,
  l.avg_rate_usd,
  l.comps_offering_list,
  ROUND(
    (l.comps_offering_excl_self::numeric * 10) +
    (CASE WHEN l.avg_discount_when_promoted IS NOT NULL
          THEN l.avg_discount_when_promoted ELSE 0 END), 1)              AS easy_win_score
FROM public.v_compset_rate_plan_landscape l
WHERE l.namkhan_offers = false
  AND l.comps_offering_excl_self >= 1
ORDER BY easy_win_score DESC;

CREATE OR REPLACE VIEW public.v_compset_promo_behavior_signals AS
WITH per_comp AS (
  SELECT
    cp.comp_id, cp.property_name, cp.is_self,
    COUNT(DISTINCT rp.shop_date)                                              AS days_with_data,
    COUNT(DISTINCT rp.shop_date) FILTER (WHERE rp.promo_label IS NOT NULL)    AS days_with_promo,
    AVG(rp.discount_pct) FILTER (WHERE rp.discount_pct IS NOT NULL)           AS avg_discount_pct,
    MAX(rp.discount_pct)                                                      AS max_discount_seen,
    COUNT(*)                                                                  AS plans_total,
    COUNT(*) FILTER (WHERE rp.promo_label IS NOT NULL)                        AS plans_with_promo
  FROM revenue.competitor_property cp
  LEFT JOIN revenue.competitor_rate_plans rp
    ON rp.comp_id = cp.comp_id AND rp.scrape_status = 'success'
  WHERE cp.is_active
    AND cp.set_id IN (SELECT set_id FROM revenue.competitor_set WHERE is_primary=true)
  GROUP BY cp.comp_id, cp.property_name, cp.is_self
)
SELECT
  pc.comp_id, pc.property_name, pc.is_self, pc.days_with_data, pc.days_with_promo,
  CASE WHEN pc.plans_total > 0
       THEN ROUND((pc.plans_with_promo::numeric / pc.plans_total) * 100, 1)
       ELSE 0 END                                                              AS promo_frequency_pct,
  ROUND(pc.avg_discount_pct::numeric, 1)                                       AS avg_discount_pct,
  ROUND(pc.max_discount_seen::numeric, 1)                                      AS max_discount_seen,
  CASE
    WHEN pc.plans_total = 0                                          THEN 'no_data'
    WHEN pc.plans_with_promo = 0                                     THEN 'never_promo'
    WHEN (pc.plans_with_promo::numeric / pc.plans_total) >= 0.5      THEN 'always_promo'
    WHEN (pc.plans_with_promo::numeric / pc.plans_total) >= 0.2      THEN 'frequent_promo'
    ELSE                                                                  'rare_promo'
  END                                                                          AS pattern,
  CASE
    WHEN pc.plans_total = 0                                          THEN 'No data yet'
    WHEN pc.plans_with_promo = 0                                     THEN 'Never discounts'
    WHEN (pc.plans_with_promo::numeric / pc.plans_total) >= 0.5      THEN 'Always discounts'
    WHEN (pc.plans_with_promo::numeric / pc.plans_total) >= 0.2      THEN 'Frequent promo'
    ELSE                                                                  'Rare promo'
  END                                                                          AS pattern_label
FROM per_comp pc
ORDER BY pc.is_self DESC, promo_frequency_pct DESC;

GRANT SELECT ON public.v_compset_rate_plan_landscape, public.v_compset_rate_plan_gaps, public.v_compset_promo_behavior_signals
  TO anon, authenticated, service_role;

-- New tile view that has price + discount + promo freq for a single tile per comp
CREATE OR REPLACE VIEW public.v_compset_promo_tiles AS
WITH latest_rate AS (
  SELECT DISTINCT ON (cp.comp_id)
    cp.comp_id, cp.property_name, cp.is_self,
    rp.rate_usd     AS latest_rate_usd,
    rp.raw_room_type AS latest_room,
    rp.shop_date    AS last_shop_date,
    rp.stay_date    AS latest_stay_date,
    rp.is_refundable AS latest_is_refundable
  FROM revenue.competitor_property cp
  LEFT JOIN revenue.competitor_rate_plans rp
    ON rp.comp_id = cp.comp_id AND rp.scrape_status = 'success' AND rp.rate_usd IS NOT NULL
  WHERE cp.is_active
    AND cp.set_id IN (SELECT set_id FROM revenue.competitor_set WHERE is_primary=true)
  ORDER BY cp.comp_id, rp.shop_date DESC NULLS LAST, rp.rate_usd ASC
)
SELECT
  l.comp_id, l.property_name, l.is_self,
  l.latest_rate_usd, l.latest_room, l.last_shop_date, l.latest_stay_date, l.latest_is_refundable,
  p.promo_frequency_pct, p.avg_discount_pct, p.max_discount_seen,
  p.pattern, p.pattern_label, p.days_with_promo, p.days_with_data
FROM latest_rate l
LEFT JOIN public.v_compset_promo_behavior_signals p ON p.comp_id = l.comp_id
ORDER BY l.is_self DESC, l.latest_rate_usd ASC NULLS LAST;

GRANT SELECT ON public.v_compset_promo_tiles TO anon, authenticated, service_role;
