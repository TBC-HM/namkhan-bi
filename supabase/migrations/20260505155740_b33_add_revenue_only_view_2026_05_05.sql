-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505155740
-- Name:    b33_add_revenue_only_view_2026_05_05
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- B33: mv_classified_transactions includes payments which inflate "Unclassified" by $258k.
-- Don't touch the matview (4 dependents). Add a clean revenue-only view.

CREATE OR REPLACE VIEW public.v_classified_revenue 
WITH (security_invoker = on) AS
SELECT 
  transaction_id,
  property_id,
  reservation_id,
  transaction_date,
  category,
  transaction_type,
  item_category_name,
  description,
  amount,
  currency,
  user_name,
  usali_dept,
  usali_subdept
FROM public.mv_classified_transactions
WHERE category IN ('custom_item', 'product', 'addon')
  AND usali_dept NOT IN ('Tax', 'Fee', 'Adjustment');

COMMENT ON VIEW public.v_classified_revenue IS 
'Revenue-only filter on mv_classified_transactions. Excludes payments, refunds, taxes, fees, and adjustments. Use this for ad-hoc revenue analysis or in agent prompts. mv_classified_transactions itself includes ALL transaction types and is misleading for revenue queries.';

GRANT SELECT ON public.v_classified_revenue TO anon, authenticated;