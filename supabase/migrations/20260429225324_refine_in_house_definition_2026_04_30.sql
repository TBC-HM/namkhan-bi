-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260429225324
-- Name:    refine_in_house_definition_2026_04_30
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- B1 refinement: in_house = on-property right now (NOT arriving today)
-- occupied_tonight = will sleep here tonight (INCLUDES today's arrivals)
-- These should differ when arrivals_today > 0.
-- Both anti-canceled, both date-based — but in_house excludes today's check-ins
-- because at the moment "in_house" is queried, today's arrivals may not have arrived yet.

DROP MATERIALIZED VIEW IF EXISTS public.mv_kpi_today CASCADE;

CREATE MATERIALIZED VIEW public.mv_kpi_today AS
SELECT
  inv.property_id,
  CURRENT_DATE AS as_of,
  inv.total_rooms,
  -- in_house: already on property (check-in BEFORE today, not yet checked out)
  ( SELECT COUNT(*)
    FROM reservations r
    WHERE r.property_id = inv.property_id
      AND r.check_in_date < CURRENT_DATE
      AND r.check_out_date > CURRENT_DATE
      AND r.status NOT IN ('canceled','no_show')
  ) AS in_house,
  ( SELECT COUNT(*)
    FROM reservations r
    WHERE r.property_id = inv.property_id
      AND r.check_in_date = CURRENT_DATE
      AND r.status NOT IN ('canceled','no_show')
  ) AS arrivals_today,
  ( SELECT COUNT(*)
    FROM reservations r
    WHERE r.property_id = inv.property_id
      AND r.check_out_date = CURRENT_DATE
      AND r.status NOT IN ('canceled','no_show')
  ) AS departures_today,
  ( SELECT COUNT(*)
    FROM reservations r
    WHERE r.property_id = inv.property_id
      AND r.check_in_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 90
      AND r.status NOT IN ('canceled','no_show')
  ) AS otb_next_90d,
  -- occupied_tonight: includes today's arrivals (will sleep here tonight)
  ( SELECT COUNT(DISTINCT r.reservation_id)
    FROM reservations r
    JOIN reservation_rooms rr ON rr.reservation_id = r.reservation_id
    WHERE r.property_id = inv.property_id
      AND rr.night_date = CURRENT_DATE
      AND r.status NOT IN ('canceled','no_show')
  ) AS occupied_tonight,
  ( SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE r.status = 'canceled')::numeric
                 / NULLIF(COUNT(*),0)::numeric, 2)
    FROM reservations r
    WHERE r.property_id = inv.property_id
      AND r.booking_date >= CURRENT_DATE - 90
  ) AS cancellation_pct_90d,
  ( SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE r.status = 'no_show')::numeric
                 / NULLIF(COUNT(*) FILTER (WHERE r.status <> 'canceled'),0)::numeric, 2)
    FROM reservations r
    WHERE r.property_id = inv.property_id
      AND r.check_in_date BETWEEN CURRENT_DATE - 90 AND CURRENT_DATE
  ) AS no_show_pct_90d
FROM v_property_inventory inv;

CREATE UNIQUE INDEX idx_mv_kpi_today_pk ON public.mv_kpi_today (property_id);

COMMENT ON MATERIALIZED VIEW public.mv_kpi_today IS
'Per-property snapshot KPIs as of CURRENT_DATE. in_house = strict on-property (excludes today arrivals & departures = same day). occupied_tonight = anyone sleeping tonight (includes today arrivals). When arrivals_today > 0 they will differ — that is correct.';
COMMENT ON COLUMN public.mv_kpi_today.in_house IS 'Guests already on property: check-in BEFORE today, check-out AFTER today, anti-canceled. Excludes today arrivals (not yet on-property) and today departures (already left).';
COMMENT ON COLUMN public.mv_kpi_today.occupied_tonight IS 'Guests who will sleep here tonight: any reservation_room.night_date = today, anti-canceled. Includes today arrivals.';

-- Refresh
REFRESH MATERIALIZED VIEW public.mv_kpi_today;