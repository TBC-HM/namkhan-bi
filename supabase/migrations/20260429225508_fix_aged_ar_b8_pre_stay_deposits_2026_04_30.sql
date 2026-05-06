-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260429225508
-- Name:    fix_aged_ar_b8_pre_stay_deposits_2026_04_30
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- B8: aged AR misclassified all future-checkout open balances as "0-30 days overdue"
-- (because CASE used CURRENT_DATE - check_out_date which is negative for future stays
-- and negative <= 30 evaluates true)
-- Fix:
--   - Add explicit 'pre_stay_deposit' bucket for negative days_overdue
--   - Restrict 0_30 bucket to days_overdue between 0 and 30
--   - Also handle in-progress stays separately (check_in_date <= today < check_out_date)

DROP MATERIALIZED VIEW IF EXISTS public.mv_aged_ar CASCADE;

CREATE MATERIALIZED VIEW public.mv_aged_ar AS
SELECT
  property_id,
  reservation_id,
  guest_name,
  source_name,
  check_in_date,
  check_out_date,
  COALESCE(balance, 0) AS open_balance,
  CASE
    WHEN check_out_date IS NULL                                THEN 'unknown'
    WHEN check_in_date  > CURRENT_DATE                         THEN 'pre_stay_deposit'
    WHEN check_in_date <= CURRENT_DATE
         AND check_out_date >= CURRENT_DATE                    THEN 'in_house_open'
    WHEN (CURRENT_DATE - check_out_date)  BETWEEN 0  AND 30    THEN '0_30'
    WHEN (CURRENT_DATE - check_out_date)  BETWEEN 31 AND 60    THEN '31_60'
    WHEN (CURRENT_DATE - check_out_date)  BETWEEN 61 AND 90    THEN '61_90'
    ELSE                                                            '90_plus'
  END AS bucket,
  CURRENT_DATE - check_out_date AS days_overdue
FROM reservations
WHERE status NOT IN ('canceled','no_show')
  AND balance > 0;

CREATE UNIQUE INDEX idx_mv_aged_ar_pk ON public.mv_aged_ar (reservation_id);
CREATE INDEX idx_mv_aged_ar_bucket ON public.mv_aged_ar (property_id, bucket);

COMMENT ON MATERIALIZED VIEW public.mv_aged_ar IS
'Receivables view with aging buckets. B8 fix 2026-04-30: pre-stay open balances now classified as pre_stay_deposit (not 0-30 AR). True aged AR is bucket IN (0_30, 31_60, 61_90, 90_plus).';

REFRESH MATERIALIZED VIEW public.mv_aged_ar;