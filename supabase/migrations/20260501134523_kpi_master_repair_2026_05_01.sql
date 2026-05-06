-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260501134523
-- Name:    kpi_master_repair_2026_05_01
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- See sql/03_kpi_master_repair.sql for full notes.

-- 1) Add unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_kpi_today_pk
  ON public.mv_kpi_today (property_id, as_of);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_kpi_daily_pk
  ON public.mv_kpi_daily (property_id, night_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_capture_rates_pk
  ON public.mv_capture_rates (property_id);

-- 2) Fix capacity at source
CREATE OR REPLACE VIEW public.v_property_inventory AS
SELECT
  rt.property_id,
  SUM(rt.quantity)::integer AS total_rooms
FROM public.room_types rt
WHERE EXISTS (
  SELECT 1
  FROM public.reservation_rooms rr
  WHERE rr.room_type_id = rt.room_type_id
    AND rr.night_date >= CURRENT_DATE - INTERVAL '90 days'
)
GROUP BY rt.property_id;

COMMENT ON VIEW public.v_property_inventory IS
  'Selling capacity. Sums room_types.quantity for room types booked in last 90d. '
  'Updated 2026-05-01 to fix the 19-vs-24 capacity bug.';
