-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427182213
-- Name:    kpi_schema_init
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Dedicated schema for KPI views and skill functions
CREATE SCHEMA IF NOT EXISTS kpi;
GRANT USAGE ON SCHEMA kpi TO postgres, anon, authenticated, service_role;

-- ===========================================================
-- BASE: occupied-rooms-per-day reference (used by all capture rates)
-- ===========================================================
CREATE OR REPLACE VIEW kpi.v_occupancy_base AS
SELECT 
  rr.night_date AS stay_date,
  COUNT(DISTINCT rr.reservation_id) AS reservations_in_house,
  COUNT(*) AS occupied_room_nights,
  SUM(COALESCE(r.adults,0) + COALESCE(r.children,0)) AS guests_in_house,
  SUM(rr.rate) AS rooms_revenue
FROM reservation_rooms rr
JOIN reservations r ON r.reservation_id = rr.reservation_id
WHERE NOT r.is_cancelled AND r.status NOT IN ('no_show')
GROUP BY rr.night_date;

CREATE INDEX IF NOT EXISTS idx_rr_night_date ON reservation_rooms(night_date);
CREATE INDEX IF NOT EXISTS idx_res_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_res_check_in ON reservations(check_in_date);
CREATE INDEX IF NOT EXISTS idx_res_check_out ON reservations(check_out_date);
CREATE INDEX IF NOT EXISTS idx_res_source_name ON reservations(source_name);
CREATE INDEX IF NOT EXISTS idx_res_country ON reservations(guest_country);
CREATE INDEX IF NOT EXISTS idx_res_guest ON reservations(guest_name);
CREATE INDEX IF NOT EXISTS idx_tx_service_dept ON transactions(service_date, usali_dept);
CREATE INDEX IF NOT EXISTS idx_tx_res_dept ON transactions(reservation_id, usali_dept);
