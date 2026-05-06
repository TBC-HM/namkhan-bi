-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505000323
-- Name:    poster_recent_explicit_columns
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Replace poster_recent with explicit columns so PostgREST can serialize it.
DROP FUNCTION IF EXISTS public.poster_recent(date, date, integer);
CREATE OR REPLACE FUNCTION public.poster_recent(p_from date, p_to date, p_limit integer DEFAULT 2000)
RETURNS TABLE (
  receipt_id bigint, application text, order_source text, table_label text, floor_area text, waiter text,
  open_at timestamptz, close_at timestamptz, total_time_text text, location text, client text, customer_group text,
  customers_count integer, order_total numeric, paid numeric, cash numeric, card numeric,
  service_charge numeric, taxes numeric, order_discount numeric, order_promotions numeric,
  status text, payment_method text,
  reconciled boolean, reconciled_with text, cb_reservation_id text,
  cb_match_amount numeric, cb_match_delta numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pos, public
AS $$
  SELECT receipt_id, application, order_source, table_label, floor_area, waiter,
         open_at, close_at, total_time_text, location, client, customer_group,
         customers_count, order_total, paid, cash, card, service_charge, taxes,
         order_discount, order_promotions, status, payment_method,
         reconciled, reconciled_with, cb_reservation_id, cb_match_amount, cb_match_delta
  FROM pos.poster_receipts
  WHERE open_at >= p_from::timestamptz
    AND open_at <  (p_to::timestamptz + interval '1 day')
  ORDER BY open_at DESC NULLS LAST
  LIMIT p_limit;
$$;
GRANT EXECUTE ON FUNCTION public.poster_recent(date, date, int) TO anon, authenticated, service_role;