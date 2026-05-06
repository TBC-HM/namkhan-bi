-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504004625
-- Name:    v_catalog_dirty_with_decisions_v3_2026_05_04
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


DROP VIEW IF EXISTS public.v_catalog_dirty CASCADE;

CREATE OR REPLACE VIEW public.v_catalog_dirty AS
WITH base AS (
  SELECT
    t.transaction_id,
    COALESCE(m.usali_dept,  'Unclassified') AS usali_dept,
    m.usali_subdept,
    NULLIF(t.item_category_name,'') AS item_category_name,
    t.description,
    t.category,
    t.amount
  FROM public.transactions t
  LEFT JOIN public.mv_classified_transactions m ON m.transaction_id = t.transaction_id
  WHERE t.property_id = 260955
    AND t.amount > 0
    AND t.transaction_date >= CURRENT_DATE - INTERVAL '180 days'
    AND COALESCE(t.category,'') NOT IN ('tax','fee','payment')
), agg AS (
  SELECT
    usali_dept,
    usali_subdept,
    item_category_name,
    description,
    COUNT(*)::int                                  AS lines,
    ROUND(SUM(amount)::numeric,2)                  AS revenue_usd,
    ROUND(AVG(amount)::numeric,2)                  AS avg_amount,
    ROUND(MIN(amount)::numeric,2)                  AS min_amount,
    ROUND(MAX(amount)::numeric,2)                  AS max_amount,
    COUNT(DISTINCT ROUND(amount::numeric,2))::int  AS distinct_prices,
    SUM( CASE
      WHEN ROUND((amount - FLOOR(amount))::numeric, 2)
        NOT IN (0, 0.50, 0.95, 0.99, 0.25, 0.75, 0.05, 0.10, 0.15, 0.20, 0.30, 0.40, 0.45, 0.60, 0.70, 0.80, 0.85, 0.90)
      THEN 1 ELSE 0 END )::int AS weird_cents_lines
  FROM base
  GROUP BY usali_dept, usali_subdept, item_category_name, description
), flagged AS (
  SELECT
    a.usali_dept, a.usali_subdept, a.item_category_name, a.description,
    a.lines, a.revenue_usd, a.avg_amount, a.min_amount, a.max_amount,
    a.distinct_prices, a.weird_cents_lines,
    (a.usali_dept IS NULL OR a.usali_dept = 'Unclassified')                         AS f_unclassified,
    (a.max_amount > 0 AND a.min_amount > 0 AND (a.max_amount / a.min_amount) >= 2.5) AS f_multi_price,
    (a.usali_subdept = 'Spa' AND a.description !~* '\d+\s*min')                     AS f_missing_duration,
    (a.weird_cents_lines >= GREATEST(1, a.lines/4))                                 AS f_lak_converted,
    (a.description ~ '[/,]'  OR a.description ~ '[ ]+$'  OR a.description ~ '[–-]\s*$'
       OR LENGTH(a.description) <= 4 OR a.item_category_name IS NULL)               AS f_dirty_name,
    (
      (CASE WHEN a.usali_dept IS NULL OR a.usali_dept = 'Unclassified' THEN 1 ELSE 0 END)
     + (CASE WHEN a.max_amount > 0 AND a.min_amount > 0 AND (a.max_amount / a.min_amount) >= 2.5 THEN 1 ELSE 0 END)
     + (CASE WHEN a.usali_subdept = 'Spa' AND a.description !~* '\d+\s*min' THEN 1 ELSE 0 END)
     + (CASE WHEN a.weird_cents_lines >= GREATEST(1, a.lines/4) THEN 1 ELSE 0 END)
     + (CASE WHEN a.description ~ '[/,]' OR a.description ~ '[ ]+$' OR a.description ~ '[–-]\s*$'
                OR LENGTH(a.description) <= 4 OR a.item_category_name IS NULL THEN 1 ELSE 0 END)
    )::int AS dirty_score
  FROM agg a
)
SELECT
  f.usali_dept, f.usali_subdept, f.item_category_name, f.description,
  f.lines, f.revenue_usd, f.avg_amount, f.min_amount, f.max_amount,
  f.distinct_prices, f.weird_cents_lines,
  f.f_unclassified, f.f_multi_price, f.f_missing_duration, f.f_lak_converted, f.f_dirty_name,
  f.dirty_score,
  CASE
    WHEN f.f_unclassified THEN 'set_usali'
    WHEN f.f_multi_price THEN 'split_variants'
    WHEN f.f_missing_duration THEN 'rename'
    WHEN f.description ~ '[/,]' THEN 'split_variants'
    WHEN f.item_category_name IS NULL THEN 'set_category'
    WHEN f.f_lak_converted THEN 'set_price'
    ELSE 'todo'
  END AS suggested_action,
  d.id                  AS decision_id,
  d.action_type,
  d.target_description,
  d.target_usali_dept,
  d.target_usali_subdept,
  d.target_category,
  d.target_price_usd,
  d.notes               AS decision_notes,
  d.status              AS decision_status,
  d.decided_at,
  d.decided_by
FROM flagged f
LEFT JOIN public.catalog_cleanup_decisions d
  ON d.description = f.description
 AND COALESCE(d.item_category_name,'') = COALESCE(f.item_category_name,'')
 AND d.status = 'open'
WHERE
  f.f_unclassified OR f.f_multi_price OR f.f_missing_duration OR f.f_lak_converted OR f.f_dirty_name
ORDER BY
  CASE WHEN d.id IS NULL THEN 0 ELSE 1 END,
  f.dirty_score DESC,
  f.revenue_usd DESC;

GRANT SELECT ON public.v_catalog_dirty TO anon, authenticated, service_role;
