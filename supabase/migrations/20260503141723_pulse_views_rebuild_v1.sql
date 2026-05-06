-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503141723
-- Name:    pulse_views_rebuild_v1
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE OR REPLACE VIEW public.v_pulse_room_type_30d AS
WITH params AS (SELECT 30 AS win_days),
nights AS (
  SELECT
    rt.room_type_id,
    rt.room_type_name,
    rt.room_type_name_short,
    rt.quantity AS rooms,
    COUNT(rr.id) FILTER (
      WHERE rr.night_date BETWEEN CURRENT_DATE - (SELECT win_days FROM params) AND CURRENT_DATE - 1
    ) AS rn_actual,
    SUM(rr.rate) FILTER (
      WHERE rr.night_date BETWEEN CURRENT_DATE - (SELECT win_days FROM params) AND CURRENT_DATE - 1
    ) AS rev_actual,
    COUNT(rr.id) FILTER (
      WHERE rr.night_date BETWEEN CURRENT_DATE - 365 - (SELECT win_days FROM params) AND CURRENT_DATE - 365 - 1
    ) AS rn_stly,
    SUM(rr.rate) FILTER (
      WHERE rr.night_date BETWEEN CURRENT_DATE - 365 - (SELECT win_days FROM params) AND CURRENT_DATE - 365 - 1
    ) AS rev_stly
  FROM public.room_types rt
  LEFT JOIN public.reservation_rooms rr ON rr.room_type_id = rt.room_type_id
  LEFT JOIN public.reservations r ON r.reservation_id = rr.reservation_id
  WHERE COALESCE(r.is_cancelled, false) = false
  GROUP BY rt.room_type_id, rt.room_type_name, rt.room_type_name_short, rt.quantity
)
SELECT
  room_type_id,
  room_type_name,
  COALESCE(room_type_name_short, room_type_name) AS room_type_short,
  rooms,
  (SELECT win_days FROM params) AS win_days,
  rn_actual,
  ROUND((rn_actual::numeric / NULLIF(rooms * (SELECT win_days FROM params), 0)) * 100, 1) AS occ_pct_actual,
  ROUND(rev_actual / NULLIF(rn_actual, 0), 0) AS adr_actual,
  ROUND(rev_actual, 0) AS revenue_actual,
  rn_stly,
  ROUND((rn_stly::numeric / NULLIF(rooms * (SELECT win_days FROM params), 0)) * 100, 1) AS occ_pct_stly,
  ROUND(rev_stly / NULLIF(rn_stly, 0), 0) AS adr_stly
FROM nights
ORDER BY revenue_actual DESC NULLS LAST;