-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260501213947
-- Name:    phase2_guest_directory
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- =====================================================================
-- Migration: phase2_guest_directory
-- Purpose : Materialised guest profile + reservation history views to
--           power /guest/directory portal (search, filter, drill-down).
--           Derives stays_count / total_spend / last_stay from reservations
--           because public.guests.total_stays / total_spent / last_stay_date
--           were never populated by the v11 sync.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS guest;

-- ---------------------------------------------------------------------
-- Materialised view: per-guest aggregate from reservations
--   Keyed on cb_guest_id (which IS guests.guest_id at the moment).
-- ---------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS guest.mv_guest_profile AS
SELECT
  g.guest_id,
  g.property_id,
  COALESCE(NULLIF(TRIM(g.first_name || ' ' || COALESCE(g.last_name,'')), ''), 'Unknown') AS full_name,
  g.first_name,
  g.last_name,
  NULLIF(g.country,'') AS country,
  NULLIF(g.email,'')   AS email,
  NULLIF(g.phone,'')   AS phone,
  NULLIF(g.city,'')    AS city,
  g.language,
  g.date_of_birth,
  g.gender,
  -- Derived stay history
  COUNT(r.reservation_id) FILTER (WHERE NOT r.is_cancelled)             AS bookings_count,
  COUNT(r.reservation_id) FILTER (WHERE r.status = 'checked_out')        AS stays_count,
  COUNT(r.reservation_id) FILTER (WHERE r.is_cancelled)                  AS cancellations_count,
  SUM(r.total_amount) FILTER (WHERE NOT r.is_cancelled)                  AS lifetime_revenue,
  AVG(r.total_amount / NULLIF(r.nights,0)) FILTER (WHERE NOT r.is_cancelled) AS avg_adr,
  SUM(r.nights) FILTER (WHERE r.status = 'checked_out')                  AS total_nights,
  MIN(r.check_in_date) FILTER (WHERE r.status = 'checked_out')           AS first_stay_date,
  MAX(r.check_out_date) FILTER (WHERE r.status = 'checked_out')          AS last_stay_date,
  MAX(r.check_in_date) FILTER (WHERE r.check_in_date >= current_date)    AS upcoming_stay_date,
  COUNT(DISTINCT r.source_name) FILTER (WHERE NOT r.is_cancelled)        AS distinct_sources,
  -- Top source as JSON for tag display
  (
    SELECT r2.source_name
    FROM public.reservations r2
    WHERE r2.cb_guest_id = g.guest_id AND r2.source_name IS NOT NULL
    GROUP BY r2.source_name
    ORDER BY COUNT(*) DESC
    LIMIT 1
  ) AS top_source,
  (
    SELECT r2.market_segment
    FROM public.reservations r2
    WHERE r2.cb_guest_id = g.guest_id AND r2.market_segment IS NOT NULL
    GROUP BY r2.market_segment
    ORDER BY COUNT(*) DESC
    LIMIT 1
  ) AS top_segment,
  -- Repeat flag derived
  (COUNT(r.reservation_id) FILTER (WHERE r.status = 'checked_out') > 1) AS is_repeat,
  -- Marketing-readiness score (0-100, simple weighted)
  (
    LEAST(100,
      (CASE WHEN g.email IS NOT NULL AND g.email <> '' THEN 40 ELSE 0 END) +
      (CASE WHEN g.phone IS NOT NULL AND g.phone <> '' THEN 20 ELSE 0 END) +
      (CASE WHEN g.country IS NOT NULL AND g.country <> '' THEN 10 ELSE 0 END) +
      (CASE WHEN g.city IS NOT NULL AND g.city <> '' THEN 10 ELSE 0 END) +
      (CASE WHEN g.date_of_birth IS NOT NULL THEN 10 ELSE 0 END) +
      (CASE WHEN g.language IS NOT NULL THEN 10 ELSE 0 END)
    )
  )::smallint AS marketing_readiness_score
FROM public.guests g
LEFT JOIN public.reservations r ON r.cb_guest_id = g.guest_id
GROUP BY g.guest_id, g.property_id, g.first_name, g.last_name, g.country,
         g.email, g.phone, g.city, g.language, g.date_of_birth, g.gender;

CREATE UNIQUE INDEX IF NOT EXISTS mv_guest_profile_pk
  ON guest.mv_guest_profile (guest_id);

CREATE INDEX IF NOT EXISTS mv_guest_profile_country_idx
  ON guest.mv_guest_profile (country);

CREATE INDEX IF NOT EXISTS mv_guest_profile_revenue_idx
  ON guest.mv_guest_profile (lifetime_revenue DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS mv_guest_profile_last_stay_idx
  ON guest.mv_guest_profile (last_stay_date DESC NULLS LAST);

-- Trigram index for fast name search (no exact match needed)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS mv_guest_profile_name_trgm
  ON guest.mv_guest_profile USING gin (full_name gin_trgm_ops);

-- ---------------------------------------------------------------------
-- View: per-guest reservation timeline (lazy-loaded by drill-down)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW guest.v_guest_reservations AS
SELECT
  r.cb_guest_id                 AS guest_id,
  r.reservation_id,
  r.booking_id,
  r.status,
  r.is_cancelled,
  r.source_name,
  r.market_segment,
  r.rate_plan,
  r.room_type_name,
  r.check_in_date,
  r.check_out_date,
  r.nights,
  r.adults,
  r.children,
  r.total_amount,
  r.paid_amount,
  r.balance,
  r.currency,
  r.booking_date,
  r.cancellation_date,
  CASE 
    WHEN r.is_cancelled THEN 'cancelled'
    WHEN r.check_in_date > current_date THEN 'upcoming'
    WHEN r.check_out_date < current_date THEN 'past'
    ELSE 'in_house'
  END AS phase
FROM public.reservations r
WHERE r.cb_guest_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- View: country aggregates for the directory header
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW guest.v_directory_facets AS
SELECT
  country,
  COUNT(*) AS guest_count,
  SUM(lifetime_revenue) AS total_revenue,
  SUM(stays_count) AS total_stays,
  COUNT(*) FILTER (WHERE is_repeat) AS repeat_guests,
  COUNT(*) FILTER (WHERE email IS NOT NULL) AS contactable_email,
  COUNT(*) FILTER (WHERE phone IS NOT NULL) AS contactable_phone
FROM guest.mv_guest_profile
WHERE country IS NOT NULL AND country <> '' AND country <> '00'
GROUP BY country
ORDER BY total_revenue DESC NULLS LAST;

-- ---------------------------------------------------------------------
-- Refresh function (call from pg_cron nightly + after sync)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION guest.refresh_guest_profile()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY guest.mv_guest_profile;
END;
$$;

-- ---------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------
GRANT USAGE ON SCHEMA guest TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA guest TO authenticated;
GRANT SELECT ON guest.mv_guest_profile TO authenticated;
GRANT SELECT ON guest.v_guest_reservations TO authenticated;
GRANT SELECT ON guest.v_directory_facets TO authenticated;
