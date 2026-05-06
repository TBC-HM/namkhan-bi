-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503213143
-- Name:    v_catalog_dirty_2026_05_03
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Cloudbeds catalog dirty-item queue.
-- One row per (item_category_name, description). Last 180d of transactions,
-- products only (excludes tax/fee/payment rows). Flags surface the kinds of
-- mess seen in the wild: USALI mis-bucket, > 2.5× price spread within SKU,
-- LAK-converted (.09/.55/.82 cents pattern), spa items missing duration, slash/multi-variant names.

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
    -- products only — drop tax/fee/payment rows from the cleanup queue
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
    -- "weird cents" detector — any transaction whose cents are not in a typical retail set
    SUM( CASE
      WHEN ROUND((amount - FLOOR(amount))::numeric, 2)
        NOT IN (0, 0.50, 0.95, 0.99, 0.25, 0.75, 0.05, 0.10, 0.15, 0.20, 0.30, 0.40, 0.45, 0.60, 0.70, 0.80, 0.85, 0.90)
      THEN 1 ELSE 0 END )::int AS weird_cents_lines
  FROM base
  GROUP BY usali_dept, usali_subdept, item_category_name, description
)
SELECT
  agg.*,
  -- Flags --------------------------------------------------------
  (usali_dept IS NULL OR usali_dept = 'Unclassified')                         AS f_unclassified,
  (max_amount > 0 AND min_amount > 0 AND (max_amount / min_amount) >= 2.5)    AS f_multi_price,
  (usali_subdept = 'Spa' AND description !~* '\d+\s*min')                     AS f_missing_duration,
  (weird_cents_lines >= GREATEST(1, lines/4))                                 AS f_lak_converted,
  (description ~ '[/,]'  OR description ~ '[ ]+$'  OR description ~ '[–-]\s*$'
     OR LENGTH(description) <= 4 OR item_category_name IS NULL)                AS f_dirty_name,
  -- Score & action ------------------------------------------------
  (
    (CASE WHEN usali_dept IS NULL OR usali_dept = 'Unclassified' THEN 1 ELSE 0 END)
   + (CASE WHEN max_amount > 0 AND min_amount > 0 AND (max_amount / min_amount) >= 2.5 THEN 1 ELSE 0 END)
   + (CASE WHEN usali_subdept = 'Spa' AND description !~* '\d+\s*min' THEN 1 ELSE 0 END)
   + (CASE WHEN weird_cents_lines >= GREATEST(1, lines/4) THEN 1 ELSE 0 END)
   + (CASE WHEN description ~ '[/,]' OR description ~ '[ ]+$' OR description ~ '[–-]\s*$'
              OR LENGTH(description) <= 4 OR item_category_name IS NULL THEN 1 ELSE 0 END)
  )::int AS dirty_score,
  CASE
    WHEN usali_dept IS NULL OR usali_dept = 'Unclassified' THEN 'Re-flag USALI'
    WHEN max_amount > 0 AND min_amount > 0 AND (max_amount / min_amount) >= 2.5 THEN 'Split SKU in Cloudbeds'
    WHEN usali_subdept = 'Spa' AND description !~* '\d+\s*min' THEN 'Add duration to name'
    WHEN description ~ '[/,]' THEN 'Split multi-variant name'
    WHEN item_category_name IS NULL THEN 'Set category in Cloudbeds'
    WHEN weird_cents_lines >= GREATEST(1, lines/4) THEN 'Set USD price (LAK-converted)'
    ELSE 'Review'
  END AS suggested_action
FROM agg
WHERE
  -- Only return items with at least one flag
  (usali_dept IS NULL OR usali_dept = 'Unclassified')
  OR (max_amount > 0 AND min_amount > 0 AND (max_amount / min_amount) >= 2.5)
  OR (usali_subdept = 'Spa' AND description !~* '\d+\s*min')
  OR (weird_cents_lines >= GREATEST(1, lines/4))
  OR (description ~ '[/,]' OR description ~ '[ ]+$' OR description ~ '[–-]\s*$'
       OR LENGTH(description) <= 4 OR item_category_name IS NULL)
ORDER BY dirty_score DESC, revenue_usd DESC;

COMMENT ON VIEW public.v_catalog_dirty IS 'Cloudbeds catalog cleanup queue. Rolls up the last 180d of products (no tax/fee/payment) and flags every (item_category_name, description) that needs a rename, re-flag, or repair. Source for /operations/catalog-cleanup.';

GRANT SELECT ON public.v_catalog_dirty TO anon, authenticated, service_role;
