-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502140818
-- Name:    fix_mv_channel_economics_today_and_forward_windows
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- =====================================================================
-- mv_channel_economics: add the missing windows the frontend needs:
--   1     = TODAY      (booking_date = CURRENT_DATE)
--   -7    = NEXT 7d    (check_in BETWEEN today AND today+7, NOT cancelled)
--   -30   = NEXT 30d   (check_in BETWEEN today AND today+30)
--   -90   = NEXT 90d   (check_in BETWEEN today AND today+90)
--   YTD   = 9999       (booking_date >= date_trunc('year', today))
-- The existing 7,30,60,90,180,365 windows stay (booking_date back N days).
--
-- Convention: positive window_days = backward-looking on booking_date,
--             negative window_days = forward-looking on check_in_date,
--             1                    = today only,
--             9999                 = YTD.
-- =====================================================================

DROP MATERIALIZED VIEW IF EXISTS public.mv_channel_economics CASCADE;

CREATE MATERIALIZED VIEW public.mv_channel_economics AS
WITH
-- 1. Backward-looking on booking_date (existing semantics + TODAY=1 + YTD=9999)
backward AS (
  SELECT 1::int AS window_days, r.*
  FROM reservations r WHERE r.booking_date::date = CURRENT_DATE
  UNION ALL
  SELECT 7,    r.* FROM reservations r WHERE r.booking_date >= CURRENT_DATE - 7
  UNION ALL
  SELECT 30,   r.* FROM reservations r WHERE r.booking_date >= CURRENT_DATE - 30
  UNION ALL
  SELECT 60,   r.* FROM reservations r WHERE r.booking_date >= CURRENT_DATE - 60
  UNION ALL
  SELECT 90,   r.* FROM reservations r WHERE r.booking_date >= CURRENT_DATE - 90
  UNION ALL
  SELECT 180,  r.* FROM reservations r WHERE r.booking_date >= CURRENT_DATE - 180
  UNION ALL
  SELECT 365,  r.* FROM reservations r WHERE r.booking_date >= CURRENT_DATE - 365
  UNION ALL
  SELECT 9999, r.* FROM reservations r WHERE r.booking_date >= date_trunc('year', CURRENT_DATE)
),
-- 2. Forward-looking on check_in_date (next N days arrivals)
forward AS (
  SELECT -7::int AS window_days, r.*
  FROM reservations r 
  WHERE r.check_in_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
    AND NOT r.is_cancelled
  UNION ALL
  SELECT -30, r.* FROM reservations r 
  WHERE r.check_in_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
    AND NOT r.is_cancelled
  UNION ALL
  SELECT -90, r.* FROM reservations r 
  WHERE r.check_in_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 90
    AND NOT r.is_cancelled
),
all_scoped AS (
  SELECT * FROM backward UNION ALL SELECT * FROM forward
),
booked AS (
  SELECT
    a.property_id,
    a.source_name,
    a.window_days,
    COUNT(*) FILTER (WHERE a.status NOT IN ('canceled','no_show')) AS bookings,
    COUNT(*) FILTER (WHERE a.status = 'canceled')                  AS canceled,
    SUM(a.total_amount) FILTER (WHERE a.status NOT IN ('canceled','no_show')) AS gross_revenue,
    SUM(a.nights)       FILTER (WHERE a.status NOT IN ('canceled','no_show')) AS roomnights,
    AVG(EXTRACT(epoch FROM a.check_in_date::timestamptz - a.booking_date) / 86400)
        FILTER (WHERE a.status NOT IN ('canceled','no_show')) AS avg_lead_days,
    AVG(a.nights) FILTER (WHERE a.status NOT IN ('canceled','no_show')) AS avg_los
  FROM all_scoped a
  GROUP BY a.property_id, a.source_name, a.window_days
)
SELECT
  b.property_id, b.source_name, b.window_days,
  b.bookings, b.canceled,
  COALESCE(b.gross_revenue, 0) AS gross_revenue,
  COALESCE(b.roomnights, 0)    AS roomnights,
  COALESCE(cl.commission_pct, 0) AS commission_pct,
  ROUND(COALESCE(b.gross_revenue, 0) * COALESCE(cl.commission_pct, 0) / 100, 2) AS commission_usd,
  ROUND(COALESCE(b.gross_revenue, 0) * (1 - COALESCE(cl.commission_pct, 0) / 100), 2) AS net_revenue,
  CASE WHEN b.bookings > 0
       THEN ROUND(COALESCE(b.gross_revenue, 0) / b.bookings, 2)
       ELSE 0 END AS adr,
  CASE WHEN b.bookings > 0
       THEN ROUND(b.canceled::numeric * 100.0 / b.bookings, 2)
       ELSE 0 END AS cancel_pct,
  ROUND(b.avg_lead_days::numeric, 1) AS avg_lead_days,
  ROUND(b.avg_los::numeric,       2) AS avg_los
FROM booked b
LEFT JOIN v_commission_lookup cl ON cl.source_name = b.source_name;

CREATE UNIQUE INDEX mv_channel_economics_pk
  ON public.mv_channel_economics (property_id, source_name, window_days);
CREATE INDEX mv_channel_economics_window_idx
  ON public.mv_channel_economics (window_days);

GRANT SELECT ON public.mv_channel_economics TO authenticated, anon;
