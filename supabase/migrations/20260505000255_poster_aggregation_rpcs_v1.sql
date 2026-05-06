-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505000255
-- Name:    poster_aggregation_rpcs_v1
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Aggregation RPCs for /finance/poster — every tile is a single Postgres
-- aggregation, no client-side row processing. All RPCs live in public so the
-- existing supabase-js client (no .schema() call) can read them.

-- Period totals
CREATE OR REPLACE FUNCTION public.poster_period_totals(p_from date, p_to date)
RETURNS TABLE (
  receipts_total integer,
  closed_n integer,
  open_n integer,
  deleted_n integer,
  canceled_n integer,
  order_usd numeric,
  paid_usd numeric,
  service_charge_usd numeric,
  taxes_usd numeric,
  discount_usd numeric,
  earliest timestamptz,
  latest timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pos, public
AS $$
  SELECT
    COUNT(*)::int                                                                       AS receipts_total,
    COUNT(*) FILTER (WHERE status='Close')::int                                          AS closed_n,
    COUNT(*) FILTER (WHERE status='Open')::int                                           AS open_n,
    COUNT(*) FILTER (WHERE status='Delete')::int                                         AS deleted_n,
    COUNT(*) FILTER (WHERE status='Canceled')::int                                       AS canceled_n,
    COALESCE(SUM(order_total)      FILTER (WHERE status='Close'), 0)                     AS order_usd,
    COALESCE(SUM(paid)             FILTER (WHERE status='Close'), 0)                     AS paid_usd,
    COALESCE(SUM(service_charge)   FILTER (WHERE status='Close'), 0)                     AS service_charge_usd,
    COALESCE(SUM(taxes)            FILTER (WHERE status='Close'), 0)                     AS taxes_usd,
    COALESCE(SUM(order_discount)   FILTER (WHERE status='Close'), 0)                     AS discount_usd,
    MIN(open_at)                                                                         AS earliest,
    MAX(close_at)                                                                        AS latest
  FROM pos.poster_receipts
  WHERE open_at >= p_from::timestamptz
    AND open_at <  (p_to::timestamptz + interval '1 day');
$$;

-- Payment-method breakdown
CREATE OR REPLACE FUNCTION public.poster_by_method(p_from date, p_to date)
RETURNS TABLE (
  payment_method text,
  closed_n integer,
  open_n integer,
  deleted_n integer,
  order_usd numeric,
  paid_usd numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pos, public
AS $$
  SELECT
    COALESCE(payment_method, '(null)')                                                   AS payment_method,
    COUNT(*) FILTER (WHERE status='Close')::int                                          AS closed_n,
    COUNT(*) FILTER (WHERE status='Open')::int                                           AS open_n,
    COUNT(*) FILTER (WHERE status='Delete')::int                                         AS deleted_n,
    COALESCE(SUM(order_total) FILTER (WHERE status='Close'), 0)                          AS order_usd,
    COALESCE(SUM(paid)        FILTER (WHERE status='Close'), 0)                          AS paid_usd
  FROM pos.poster_receipts
  WHERE open_at >= p_from::timestamptz
    AND open_at <  (p_to::timestamptz + interval '1 day')
  GROUP BY payment_method
  ORDER BY order_usd DESC NULLS LAST;
$$;

-- Top buckets — order_source / waiter / floor_area
CREATE OR REPLACE FUNCTION public.poster_top_bucket(p_field text, p_from date, p_to date, p_limit integer DEFAULT 10)
RETURNS TABLE (bucket text, receipts integer, order_usd numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pos, public
AS $$
BEGIN
  IF p_field NOT IN ('order_source', 'waiter', 'floor_area', 'client') THEN
    RAISE EXCEPTION 'Invalid field: %', p_field;
  END IF;
  RETURN QUERY EXECUTE format($q$
    SELECT COALESCE(%I, '(unknown)') AS bucket,
           COUNT(*)::int AS receipts,
           COALESCE(SUM(order_total), 0) AS order_usd
    FROM pos.poster_receipts
    WHERE status = 'Close'
      AND open_at >= $1::timestamptz
      AND open_at <  ($2::timestamptz + interval '1 day')
    GROUP BY 1
    ORDER BY 3 DESC NULLS LAST
    LIMIT $3
  $q$, p_field) USING p_from, p_to, p_limit;
END;
$$;

-- Most-recent receipts (filtered server-side to the period)
CREATE OR REPLACE FUNCTION public.poster_recent(p_from date, p_to date, p_limit integer DEFAULT 2000)
RETURNS SETOF pos.poster_receipts
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pos, public
AS $$
  SELECT *
  FROM pos.poster_receipts
  WHERE open_at >= p_from::timestamptz
    AND open_at <  (p_to::timestamptz + interval '1 day')
  ORDER BY open_at DESC NULLS LAST
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.poster_period_totals(date, date)         TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.poster_by_method(date, date)             TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.poster_top_bucket(text, date, date, int) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.poster_recent(date, date, int)           TO anon, authenticated, service_role;