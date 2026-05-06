-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260501135551
-- Name:    kpi_calc_repair_2026_05_01_v2
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ============================================================================
-- Bug #1: mv_kpi_today.in_house counts reservations, not rooms
-- Bug #2: arrivals_today / departures_today count reservations, not rooms
-- Bug #3: mv_channel_perf.adr_90d uses booking total/stay-length (overstates ADR
--          for multi-room group bookings)
-- Bug #4: bookings_30d/90d/365d include canceled (incomparable to revenue)
--
-- This migration replaces mv_kpi_today and mv_channel_perf with corrected
-- formulas. mv_kpi_daily already uses correct room-night formulas.
-- ============================================================================

-- 1) mv_kpi_today: count rooms (not reservations) for in_house, arrivals, departures
DROP MATERIALIZED VIEW IF EXISTS public.mv_kpi_today CASCADE;

CREATE MATERIALIZED VIEW public.mv_kpi_today AS
SELECT
  inv.property_id,
  CURRENT_DATE AS as_of,
  inv.total_rooms,
  inv.total_rooms AS rooms_inventory,
  -- in_house: count of room-nights occupied tonight
  ( SELECT count(*)
    FROM public.reservations r
    JOIN public.reservation_rooms rr ON rr.reservation_id = r.reservation_id
    WHERE r.property_id = inv.property_id
      AND rr.night_date = CURRENT_DATE
      AND r.status NOT IN ('canceled','no_show')
  ) AS in_house,
  -- arrivals_today: count of rooms checking in today (not bookings)
  ( SELECT count(*)
    FROM public.reservations r
    JOIN public.reservation_rooms rr ON rr.reservation_id = r.reservation_id
    WHERE r.property_id = inv.property_id
      AND r.check_in_date = CURRENT_DATE
      AND rr.night_date = CURRENT_DATE
      AND r.status NOT IN ('canceled','no_show')
  ) AS arrivals_today,
  -- departures_today: rooms checking out today
  ( SELECT count(*)
    FROM public.reservations r
    JOIN public.reservation_rooms rr ON rr.reservation_id = r.reservation_id
    WHERE r.property_id = inv.property_id
      AND r.check_out_date = CURRENT_DATE
      AND rr.night_date = CURRENT_DATE - 1
      AND r.status NOT IN ('canceled','no_show')
  ) AS departures_today,
  -- otb_next_90d: count of room-nights to be sold in next 90 days
  ( SELECT count(*)
    FROM public.reservations r
    JOIN public.reservation_rooms rr ON rr.reservation_id = r.reservation_id
    WHERE r.property_id = inv.property_id
      AND rr.night_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 90
      AND r.status NOT IN ('canceled','no_show')
  ) AS otb_next_90d,
  -- occupied_tonight: same as in_house but at room-night granularity (kept for FE compat)
  ( SELECT count(*)
    FROM public.reservations r
    JOIN public.reservation_rooms rr ON rr.reservation_id = r.reservation_id
    WHERE r.property_id = inv.property_id
      AND rr.night_date = CURRENT_DATE
      AND r.status NOT IN ('canceled','no_show')
  ) AS occupied_tonight,
  -- cancellation_pct_90d: % of bookings made in last 90d that were canceled
  ( SELECT round(100.0 * count(*) FILTER (WHERE r.status = 'canceled')::numeric
        / NULLIF(count(*), 0)::numeric, 2)
    FROM public.reservations r
    WHERE r.property_id = inv.property_id
      AND r.booking_date >= CURRENT_DATE - 90
  ) AS cancellation_pct_90d,
  -- no_show_pct_90d: % of expected arrivals (last 90d) that no-showed
  ( SELECT round(100.0 * count(*) FILTER (WHERE r.status = 'no_show')::numeric
        / NULLIF(count(*) FILTER (WHERE r.status <> 'canceled'), 0)::numeric, 2)
    FROM public.reservations r
    WHERE r.property_id = inv.property_id
      AND r.check_in_date BETWEEN CURRENT_DATE - 90 AND CURRENT_DATE
  ) AS no_show_pct_90d
FROM public.v_property_inventory inv;

CREATE UNIQUE INDEX idx_mv_kpi_today_pk ON public.mv_kpi_today (property_id, as_of);

COMMENT ON MATERIALIZED VIEW public.mv_kpi_today IS
  'Today snapshot. in_house/arrivals/departures count rooms not reservations '
  '(fixes group-booking undercount). Updated 2026-05-01.';

-- 2) mv_channel_perf: rebuild with room-night ADR + non-canceled bookings count
DROP MATERIALIZED VIEW IF EXISTS public.mv_channel_perf CASCADE;

CREATE MATERIALIZED VIEW public.mv_channel_perf AS
WITH base AS (
  SELECT
    r.property_id,
    COALESCE(r.source_name, 'Unknown') AS source_name,
    r.reservation_id,
    r.status,
    r.booking_date,
    r.check_in_date,
    r.check_out_date,
    r.nights AS resv_nights,
    r.total_amount,
    -- count of room-night records for this reservation
    (SELECT count(*) FROM public.reservation_rooms rr2
       WHERE rr2.reservation_id = r.reservation_id) AS roomnights_in_resv,
    -- sum of rate (room-only revenue, USALI-aligned)
    (SELECT sum(rr2.rate) FROM public.reservation_rooms rr2
       WHERE rr2.reservation_id = r.reservation_id) AS rooms_revenue
  FROM public.reservations r
  WHERE r.check_in_date >= CURRENT_DATE - 365
)
SELECT
  property_id,
  source_name,
  -- 30d window: bookings ON CHECK-IN, non-canceled (matches revenue scope)
  count(*) FILTER (WHERE check_in_date >= CURRENT_DATE - 30
                     AND check_in_date <= CURRENT_DATE
                     AND status NOT IN ('canceled','no_show')) AS bookings_30d,
  COALESCE(sum(rooms_revenue) FILTER (WHERE check_in_date >= CURRENT_DATE - 30
                     AND check_in_date <= CURRENT_DATE
                     AND status NOT IN ('canceled','no_show')), 0) AS revenue_30d,
  COALESCE(sum(roomnights_in_resv) FILTER (WHERE check_in_date >= CURRENT_DATE - 30
                     AND check_in_date <= CURRENT_DATE
                     AND status NOT IN ('canceled','no_show')), 0) AS roomnights_30d,
  -- separate cancel count
  count(*) FILTER (WHERE status = 'canceled'
                     AND check_in_date >= CURRENT_DATE - 30
                     AND check_in_date <= CURRENT_DATE) AS canceled_30d,
  -- 90d window
  count(*) FILTER (WHERE check_in_date >= CURRENT_DATE - 90
                     AND check_in_date <= CURRENT_DATE
                     AND status NOT IN ('canceled','no_show')) AS bookings_90d,
  COALESCE(sum(rooms_revenue) FILTER (WHERE check_in_date >= CURRENT_DATE - 90
                     AND check_in_date <= CURRENT_DATE
                     AND status NOT IN ('canceled','no_show')), 0) AS revenue_90d,
  COALESCE(sum(roomnights_in_resv) FILTER (WHERE check_in_date >= CURRENT_DATE - 90
                     AND check_in_date <= CURRENT_DATE
                     AND status NOT IN ('canceled','no_show')), 0) AS roomnights_90d,
  count(*) FILTER (WHERE status = 'canceled'
                     AND check_in_date >= CURRENT_DATE - 90
                     AND check_in_date <= CURRENT_DATE) AS canceled_90d,
  -- 365d window
  count(*) FILTER (WHERE check_in_date >= CURRENT_DATE - 365
                     AND check_in_date <= CURRENT_DATE
                     AND status NOT IN ('canceled','no_show')) AS bookings_365d,
  COALESCE(sum(rooms_revenue) FILTER (WHERE check_in_date >= CURRENT_DATE - 365
                     AND check_in_date <= CURRENT_DATE
                     AND status NOT IN ('canceled','no_show')), 0) AS revenue_365d,
  -- ADR_90d: revenue / roomnights (room-night based, USALI correct)
  CASE WHEN sum(roomnights_in_resv) FILTER (WHERE check_in_date >= CURRENT_DATE - 90
                     AND check_in_date <= CURRENT_DATE
                     AND status NOT IN ('canceled','no_show')) > 0
       THEN round(
         sum(rooms_revenue) FILTER (WHERE check_in_date >= CURRENT_DATE - 90
                     AND check_in_date <= CURRENT_DATE
                     AND status NOT IN ('canceled','no_show'))
         / sum(roomnights_in_resv) FILTER (WHERE check_in_date >= CURRENT_DATE - 90
                     AND check_in_date <= CURRENT_DATE
                     AND status NOT IN ('canceled','no_show'))::numeric
         , 2)
       ELSE 0
  END AS adr_90d,
  -- avg lead time (booking-level, not roomnight-level — lead time is per-booking)
  round(avg((check_in_date - booking_date::date)::numeric)
        FILTER (WHERE check_in_date >= CURRENT_DATE - 90
                  AND check_in_date <= CURRENT_DATE
                  AND status NOT IN ('canceled','no_show')), 1) AS avg_lead_time_90d,
  -- avg LOS (booking-level)
  round(avg(resv_nights)
        FILTER (WHERE check_in_date >= CURRENT_DATE - 90
                  AND check_in_date <= CURRENT_DATE
                  AND status NOT IN ('canceled','no_show')), 1) AS avg_los_90d
FROM base
GROUP BY property_id, source_name;

CREATE UNIQUE INDEX idx_mv_channel_perf_pk ON public.mv_channel_perf (property_id, source_name);

COMMENT ON MATERIALIZED VIEW public.mv_channel_perf IS
  'Channel performance. ADR is room-night based (sum(rate) / sum(roomnights)). '
  'bookings_*d counts only non-canceled (matches revenue scope). '
  'canceled_*d separate column for cancel-rate calc. Updated 2026-05-01.';

-- 3) Add capacity-mode columns to v_property_inventory for the toggle
DROP VIEW IF EXISTS public.v_property_inventory CASCADE;

CREATE VIEW public.v_property_inventory AS
SELECT
  property_id,
  capacity_selling AS total_rooms,  -- default = selling (24)
  capacity_selling,
  capacity_live,
  capacity_total
FROM public.v_property_totals;

COMMENT ON VIEW public.v_property_inventory IS
  'Property capacity. Default total_rooms = capacity_selling (booked in last 90d, = 24). '
  'capacity_live includes rooms with future inventory (= 30). '
  'capacity_total = all room types (= 30). '
  'Frontend can join on this view directly to support a capacity-mode toggle. '
  'Updated 2026-05-01.';
