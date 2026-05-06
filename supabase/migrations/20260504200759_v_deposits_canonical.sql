-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504200759
-- Name:    v_deposits_canonical
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- v_deposits_canonical: every transaction that is a true deposit
-- (payment received BEFORE the guest's check-in date).
-- Source of truth = public.transactions joined to public.reservations.
CREATE OR REPLACE VIEW public.v_deposits_canonical AS
SELECT
  t.transaction_id,
  t.reservation_id,
  t.transaction_date::date AS payment_date,
  r.check_in_date          AS arrival_date,
  (r.check_in_date - t.transaction_date::date)::int AS days_in_advance,
  t.amount,
  t.currency,
  t.method,
  t.user_name,
  r.status AS reservation_status,
  CASE
    WHEN r.check_in_date IS NULL THEN 'no_arrival_date'
    WHEN r.check_in_date <  CURRENT_DATE THEN 'past_arrival'
    WHEN r.check_in_date <= (CURRENT_DATE + INTERVAL '7 days')::date  THEN 'arr_le_7d'
    WHEN r.check_in_date <= (CURRENT_DATE + INTERVAL '30 days')::date THEN 'arr_le_30d'
    WHEN r.check_in_date <= (CURRENT_DATE + INTERVAL '90 days')::date THEN 'arr_le_90d'
    ELSE 'arr_gt_90d'
  END AS arrival_bucket
FROM public.transactions t
JOIN public.reservations r ON r.reservation_id = t.reservation_id
WHERE t.transaction_type = 'credit'
  AND t.category = 'payment'
  AND t.amount > 0
  AND r.check_in_date IS NOT NULL
  AND t.transaction_date::date < r.check_in_date;

COMMENT ON VIEW public.v_deposits_canonical IS
'Every payment received BEFORE the guest check-in date. Drives /finance/ledger Deposits tiles.';

GRANT SELECT ON public.v_deposits_canonical TO anon, authenticated, service_role;

-- Aggregated KPI snapshot (one row per call) for the ledger page
CREATE OR REPLACE VIEW public.v_deposits_summary AS
SELECT
  -- Total cash held in advance against future arrivals (canonical)
  COALESCE(SUM(amount) FILTER (WHERE arrival_bucket NOT IN ('past_arrival','no_arrival_date')), 0)
    AS total_held_future_usd,
  COUNT(DISTINCT reservation_id) FILTER (WHERE arrival_bucket NOT IN ('past_arrival','no_arrival_date'))
    AS reservations_with_deposit,
  COALESCE(SUM(amount) FILTER (WHERE arrival_bucket IN ('arr_le_7d','arr_le_30d')), 0)
    AS deposits_arriving_30d_usd,
  COALESCE(SUM(amount) FILTER (WHERE arrival_bucket = 'arr_le_7d'), 0)
    AS deposits_arriving_7d_usd,
  COUNT(DISTINCT reservation_id) FILTER (WHERE arrival_bucket = 'arr_le_7d')
    AS reservations_arriving_7d,
  -- "Overdue balance" = reservations checking in within 7 days that still have a balance > 0
  -- This needs reservation balance, computed below in a separate query block
  0::numeric AS placeholder
FROM public.v_deposits_canonical;

GRANT SELECT ON public.v_deposits_summary TO anon, authenticated, service_role;
