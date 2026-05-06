-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502220222
-- Name:    phase1_13_kpi_today_filter_fix
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- phase1_13_kpi_today_filter_fix · 2026-05-02
-- Bug: mv_kpi_today.in_house counts confirmed reservations (not yet arrived) as in-house.
-- Cloudbeds counts only checked_in. Fix: tighten filter.
-- Also: add expected_arrivals_today (Cloudbeds-aligned, includes late confirmed)
--       and align departures_today to distinct count by check_out_date.

DROP MATERIALIZED VIEW IF EXISTS public.mv_kpi_today CASCADE;

CREATE MATERIALIZED VIEW public.mv_kpi_today AS
SELECT
  inv.property_id,
  CURRENT_DATE AS as_of,
  inv.total_rooms,
  inv.total_rooms AS rooms_inventory,

  -- IN-HOUSE: rooms occupied tonight by checked_in guests only (matches Cloudbeds)
  (SELECT count(*)
   FROM public.reservations r
   JOIN public.reservation_rooms rr ON rr.reservation_id = r.reservation_id
   WHERE r.property_id = inv.property_id
     AND rr.night_date = CURRENT_DATE
     AND r.status = 'checked_in'
  ) AS in_house,

  -- ARRIVALS TODAY (status-strict): only reservations actually arriving today, not cancelled/no_show
  -- This is the "checked_in starting today" count
  (SELECT count(*)
   FROM public.reservations r
   JOIN public.reservation_rooms rr ON rr.reservation_id = r.reservation_id
   WHERE r.property_id = inv.property_id
     AND r.check_in_date = CURRENT_DATE
     AND rr.night_date = CURRENT_DATE
     AND r.status NOT IN ('canceled','no_show')
  ) AS arrivals_today,

  -- EXPECTED ARRIVALS TODAY (Cloudbeds-aligned): includes late confirmed reservations
  -- where check_in_date <= today and guest hasn't checked in yet (still confirmed)
  (SELECT count(DISTINCT r.reservation_id)
   FROM public.reservations r
   WHERE r.property_id = inv.property_id
     AND r.status NOT IN ('canceled','no_show','checked_out')
     AND (
       (r.check_in_date = CURRENT_DATE)
       OR (r.check_in_date < CURRENT_DATE AND r.status = 'confirmed' AND r.check_out_date > CURRENT_DATE)
     )
  ) AS expected_arrivals_today,

  -- DEPARTURES TODAY: distinct reservations checking out today, not cancelled/no_show
  -- Drops the (night_date = CURRENT_DATE - 1) requirement which was missing some departures
  (SELECT count(DISTINCT r.reservation_id)
   FROM public.reservations r
   WHERE r.property_id = inv.property_id
     AND r.check_out_date = CURRENT_DATE
     AND r.status IN ('checked_in','checked_out')
  ) AS departures_today,

  -- OTB next 90 days (room-nights on the books, excluding canceled/no_show)
  (SELECT count(*)
   FROM public.reservations r
   JOIN public.reservation_rooms rr ON rr.reservation_id = r.reservation_id
   WHERE r.property_id = inv.property_id
     AND rr.night_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 90
     AND r.status NOT IN ('canceled','no_show')
  ) AS otb_next_90d,

  -- OCCUPIED TONIGHT: room-nights tonight excluding canceled/no_show
  -- (broader than in_house — includes confirmed not-yet-arrived; useful for forecasting)
  (SELECT count(*)
   FROM public.reservations r
   JOIN public.reservation_rooms rr ON rr.reservation_id = r.reservation_id
   WHERE r.property_id = inv.property_id
     AND rr.night_date = CURRENT_DATE
     AND r.status NOT IN ('canceled','no_show')
  ) AS occupied_tonight,

  -- 90-day cancellation rate
  (SELECT round(
     100.0 * count(*) FILTER (WHERE r.status = 'canceled')::numeric
       / NULLIF(count(*), 0)::numeric,
     2)
   FROM public.reservations r
   WHERE r.property_id = inv.property_id
     AND r.booking_date >= CURRENT_DATE - 90
  ) AS cancellation_pct_90d,

  -- 90-day no-show rate
  (SELECT round(
     100.0 * count(*) FILTER (WHERE r.status = 'no_show')::numeric
       / NULLIF(count(*) FILTER (WHERE r.status <> 'canceled'), 0)::numeric,
     2)
   FROM public.reservations r
   WHERE r.property_id = inv.property_id
     AND r.check_in_date BETWEEN CURRENT_DATE - 90 AND CURRENT_DATE
  ) AS no_show_pct_90d

FROM public.v_property_inventory inv;

CREATE UNIQUE INDEX idx_mv_kpi_today_pk
  ON public.mv_kpi_today (property_id, as_of);

COMMENT ON MATERIALIZED VIEW public.mv_kpi_today IS
  'Today snapshot. in_house = rooms occupied tonight by checked_in guests (matches Cloudbeds). '
  'arrivals_today = strict (room-night with check_in=today, not cancelled). '
  'expected_arrivals_today = Cloudbeds-aligned including late confirmed reservations. '
  'departures_today = distinct reservations with check_out=today. '
  'occupied_tonight = broader incl. confirmed-not-yet-arrived (forecasting use). '
  'See migration phase1_13_kpi_today_filter_fix.';

REFRESH MATERIALIZED VIEW public.mv_kpi_today;