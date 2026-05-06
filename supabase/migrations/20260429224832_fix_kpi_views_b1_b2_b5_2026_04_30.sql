-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260429224832
-- Name:    fix_kpi_views_b1_b2_b5_2026_04_30
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- =============================================================================
-- Audit fixes: B1 (in_house consistency), B2 (capture window), B5 (rooms_available naming)
-- =============================================================================
-- Strategy: drop and recreate the materialized views with fixed definitions.
-- Indexes and refresh function are recreated to match.
-- All upstream references (mv_kpi_today, dashboards) keep working because
-- column names are preserved or added; nothing is removed.
-- =============================================================================

-- ----- 1. mv_kpi_today: fix B1 -----
-- in_house was: status = 'checked_in' only
-- now: any non-canceled/no-show reservation whose nights-table covers today
--      (matches occupied_tonight, single source of truth)

DROP MATERIALIZED VIEW IF EXISTS public.mv_kpi_today CASCADE;

CREATE MATERIALIZED VIEW public.mv_kpi_today AS
SELECT
  inv.property_id,
  CURRENT_DATE AS as_of,
  inv.total_rooms,
  -- B1 fix: align in_house with occupied_tonight (date-based, anti-canceled)
  ( SELECT COUNT(DISTINCT r.reservation_id)
    FROM reservations r
    JOIN reservation_rooms rr ON rr.reservation_id = r.reservation_id
    WHERE r.property_id = inv.property_id
      AND rr.night_date = CURRENT_DATE
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
  -- occupied_tonight is now identical to in_house; keep both for back-compat
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
'Per-property snapshot KPIs as of CURRENT_DATE. in_house and occupied_tonight are now identical (B1 fix 2026-04-30).';