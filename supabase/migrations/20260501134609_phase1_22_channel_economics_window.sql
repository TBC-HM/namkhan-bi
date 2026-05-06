-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260501134609
-- Name:    phase1_22_channel_economics_window
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- 02_channel_economics_window.sql · v2 (with fuzzy-name join fix)
-- ROOT CAUSE: sources.name = 'Booking.com (Hotel Collect Booking)' vs
--             reservations.source_name = 'Booking.com' → JOIN miss → $0 commission tile.
-- FIX: 4-tier fuzzy lookup view + period-keyed channel economics matview +
--      OTA × Room-type matrix matview, all with proper unique indexes for
--      REFRESH MATERIALIZED VIEW CONCURRENTLY.

-- ============================================================================
-- 0) Helper: best-match commission % per raw source_name in reservations
-- ============================================================================

CREATE OR REPLACE VIEW public.v_commission_lookup AS
WITH src AS (
  SELECT name,
         category,
         COALESCE(commission_pct, 0)::numeric AS commission_pct
  FROM public.sources
  WHERE COALESCE(commission_pct, 0) > 0
),
distinct_res AS (
  SELECT DISTINCT source_name FROM public.reservations WHERE source_name IS NOT NULL
)
SELECT
  d.source_name,
  COALESCE(
    (SELECT commission_pct FROM src WHERE src.name = d.source_name LIMIT 1),
    (SELECT commission_pct FROM src WHERE src.name ILIKE d.source_name || ' (%' ORDER BY length(src.name) ASC LIMIT 1),
    (SELECT commission_pct FROM src WHERE d.source_name ILIKE src.name || ' (%' ORDER BY length(src.name) DESC LIMIT 1),
    (SELECT commission_pct FROM src WHERE src.name ILIKE split_part(d.source_name, ' ', 1) || '%' ORDER BY length(src.name) ASC LIMIT 1),
    0
  )::numeric AS commission_pct
FROM distinct_res d;

COMMENT ON VIEW public.v_commission_lookup IS
  'Bridges reservations.source_name -> sources.commission_pct despite naming mismatch.';

-- ============================================================================
-- 1) Period-keyed channel economics
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS public.mv_channel_economics CASCADE;

CREATE MATERIALIZED VIEW public.mv_channel_economics AS
WITH windows(window_days) AS (VALUES (7),(30),(60),(90),(180),(365)),
booked AS (
  SELECT
    r.property_id, r.source_name, w.window_days,
    count(*) FILTER (WHERE r.status NOT IN ('canceled','no_show'))            AS bookings,
    count(*) FILTER (WHERE r.status = 'canceled')                              AS canceled,
    sum(r.total_amount) FILTER (WHERE r.status NOT IN ('canceled','no_show')) AS gross_revenue,
    sum(r.nights)       FILTER (WHERE r.status NOT IN ('canceled','no_show')) AS roomnights,
    avg(EXTRACT(epoch FROM r.check_in_date - r.booking_date)/86400)
      FILTER (WHERE r.status NOT IN ('canceled','no_show'))                    AS avg_lead_days,
    avg(r.nights) FILTER (WHERE r.status NOT IN ('canceled','no_show'))       AS avg_los
  FROM public.reservations r
  CROSS JOIN windows w
  WHERE r.booking_date >= current_date - w.window_days
  GROUP BY 1,2,3
)
SELECT
  b.property_id, b.source_name, b.window_days, b.bookings, b.canceled,
  COALESCE(b.gross_revenue, 0)                                                AS gross_revenue,
  COALESCE(b.roomnights, 0)                                                   AS roomnights,
  COALESCE(cl.commission_pct, 0)                                              AS commission_pct,
  ROUND(COALESCE(b.gross_revenue, 0) * COALESCE(cl.commission_pct, 0) / 100, 2) AS commission_usd,
  ROUND(COALESCE(b.gross_revenue, 0) * (1 - COALESCE(cl.commission_pct, 0) / 100), 2) AS net_revenue,
  CASE WHEN b.bookings > 0 THEN ROUND(COALESCE(b.gross_revenue, 0) / b.bookings::numeric, 2) ELSE 0 END AS adr,
  CASE WHEN b.bookings > 0 THEN ROUND(b.canceled * 100.0 / b.bookings::numeric, 2) ELSE 0 END AS cancel_pct,
  ROUND(b.avg_lead_days::numeric, 1) AS avg_lead_days,
  ROUND(b.avg_los::numeric, 2)       AS avg_los
FROM booked b
LEFT JOIN public.v_commission_lookup cl ON cl.source_name = b.source_name;

CREATE UNIQUE INDEX idx_mv_channel_economics_pk
  ON public.mv_channel_economics (property_id, source_name, window_days);

COMMENT ON MATERIALIZED VIEW public.mv_channel_economics IS
  'Period-keyed channel economics. window_days IN {7,30,60,90,180,365}.';

-- ============================================================================
-- 2) OTA × Room-type matrix
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS public.mv_channel_x_roomtype CASCADE;

CREATE MATERIALIZED VIEW public.mv_channel_x_roomtype AS
WITH windows(window_days) AS (VALUES (30),(90),(365))
SELECT
  r.property_id, r.source_name, rt.room_type_name, rt.room_type_name_short, w.window_days,
  count(*) FILTER (WHERE r.status NOT IN ('canceled','no_show'))    AS bookings,
  count(*) FILTER (WHERE r.status = 'canceled')                      AS canceled,
  sum(rr.rate) FILTER (WHERE r.status NOT IN ('canceled','no_show')) AS revenue,
  count(rr.*) FILTER (WHERE r.status NOT IN ('canceled','no_show'))  AS roomnights,
  CASE WHEN count(rr.*) FILTER (WHERE r.status NOT IN ('canceled','no_show')) > 0
       THEN ROUND((sum(rr.rate) FILTER (WHERE r.status NOT IN ('canceled','no_show')))::numeric
            / NULLIF(count(rr.*) FILTER (WHERE r.status NOT IN ('canceled','no_show')), 0)::numeric, 2)
       ELSE 0 END                                                    AS adr,
  CASE WHEN count(*) FILTER (WHERE r.status NOT IN ('canceled','no_show')) > 0
       THEN ROUND((count(*) FILTER (WHERE r.status = 'canceled') * 100.0)::numeric
            / NULLIF(count(*) FILTER (WHERE r.status NOT IN ('canceled','no_show')), 0)::numeric, 2)
       ELSE 0 END                                                    AS cancel_pct
FROM public.reservations r
JOIN public.reservation_rooms rr ON rr.reservation_id = r.reservation_id
JOIN public.room_types rt        ON rt.room_type_id   = rr.room_type_id
CROSS JOIN windows w
WHERE r.booking_date >= current_date - w.window_days
GROUP BY r.property_id, r.source_name, rt.room_type_name, rt.room_type_name_short, w.window_days;

CREATE UNIQUE INDEX idx_mv_channel_x_roomtype_pk
  ON public.mv_channel_x_roomtype (property_id, source_name, room_type_name, window_days);

COMMENT ON MATERIALIZED VIEW public.mv_channel_x_roomtype IS
  'OTA × Room-type matrix for Channels tooltips. window_days IN {30,90,365}.';

-- ============================================================================
-- 3) Permissions
-- ============================================================================

GRANT SELECT ON public.v_commission_lookup TO anon, authenticated;
GRANT SELECT ON public.mv_channel_economics TO anon, authenticated;
GRANT SELECT ON public.mv_channel_x_roomtype TO anon, authenticated;