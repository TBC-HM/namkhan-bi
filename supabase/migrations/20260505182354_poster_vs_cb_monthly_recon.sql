-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505182354
-- Name:    poster_vs_cb_monthly_recon
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE OR REPLACE FUNCTION public.poster_vs_cb_monthly()
RETURNS TABLE (
  month_yyyymm   text,
  poster_room_n   integer,
  poster_room_usd numeric,
  poster_total_usd numeric,
  cb_fnb_n        integer,
  cb_fnb_usd      numeric,
  delta_usd       numeric,
  match_pct       numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pos, public
AS $$
WITH poster_room AS (
  SELECT to_char(COALESCE(close_at, open_at)::date, 'YYYY-MM') AS m,
         COUNT(*)::int AS n,
         COALESCE(SUM(order_total), 0) AS usd
  FROM pos.poster_receipts
  WHERE payment_method = 'Charge Room / to Folio' AND status = 'Close'
  GROUP BY 1
), poster_total AS (
  SELECT to_char(COALESCE(close_at, open_at)::date, 'YYYY-MM') AS m,
         COALESCE(SUM(order_total), 0) AS usd
  FROM pos.poster_receipts
  WHERE status = 'Close'
  GROUP BY 1
), cb_fnb AS (
  SELECT to_char(transaction_date::date, 'YYYY-MM') AS m,
         COUNT(*)::int AS n,
         COALESCE(SUM(amount), 0) AS usd
  FROM mv_classified_transactions
  WHERE property_id = 260955 AND usali_dept = 'F&B' AND amount > 0
  GROUP BY 1
)
SELECT
  COALESCE(pr.m, pt.m, c.m) AS month_yyyymm,
  COALESCE(pr.n,   0)::int  AS poster_room_n,
  COALESCE(pr.usd, 0)       AS poster_room_usd,
  COALESCE(pt.usd, 0)       AS poster_total_usd,
  COALESCE(c.n,    0)::int  AS cb_fnb_n,
  COALESCE(c.usd,  0)       AS cb_fnb_usd,
  COALESCE(c.usd, 0) - COALESCE(pr.usd, 0)       AS delta_usd,
  CASE WHEN COALESCE(c.usd, 0) > 0
       THEN ROUND(100.0 * COALESCE(pr.usd, 0) / c.usd, 1)
       ELSE NULL END                              AS match_pct
FROM poster_room pr
FULL OUTER JOIN poster_total pt USING (m)
FULL OUTER JOIN cb_fnb c USING (m)
ORDER BY month_yyyymm DESC;
$$;
GRANT EXECUTE ON FUNCTION public.poster_vs_cb_monthly() TO anon, authenticated, service_role;