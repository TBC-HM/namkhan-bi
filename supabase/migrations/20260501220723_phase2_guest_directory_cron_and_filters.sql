-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260501220723
-- Name:    phase2_guest_directory_cron_and_filters
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- =====================================================================
-- 1. pg_cron schedule for guest.mv_guest_profile refresh
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Unschedule existing job if present (idempotent)
DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'refresh-guest-profile';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

-- Run nightly at 03:15 UTC (15 min after the typical Cloudbeds sync window)
SELECT cron.schedule(
  'refresh-guest-profile',
  '15 3 * * *',
  $$ SELECT guest.refresh_guest_profile(); $$
);

-- =====================================================================
-- 2. Add stay_window column to mv_guest_profile so we can filter by
--    "guests with a reservation in next 7 / 30 / 90 days".
--    Reservations create guests; this surfaces the upcoming-stay window
--    cleanly so the UI doesn't have to compute date math on every query.
-- =====================================================================

-- Drop and recreate the materialized view with the extra fields.
DROP MATERIALIZED VIEW IF EXISTS guest.mv_guest_profile CASCADE;

CREATE MATERIALIZED VIEW guest.mv_guest_profile AS
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
  COUNT(r.reservation_id) FILTER (WHERE NOT r.is_cancelled)             AS bookings_count,
  COUNT(r.reservation_id) FILTER (WHERE r.status = 'checked_out')        AS stays_count,
  COUNT(r.reservation_id) FILTER (WHERE r.is_cancelled)                  AS cancellations_count,
  SUM(r.total_amount) FILTER (WHERE NOT r.is_cancelled)                  AS lifetime_revenue,
  AVG(r.total_amount / NULLIF(r.nights,0)) FILTER (WHERE NOT r.is_cancelled) AS avg_adr,
  SUM(r.nights) FILTER (WHERE r.status = 'checked_out')                  AS total_nights,
  MIN(r.check_in_date) FILTER (WHERE r.status = 'checked_out')           AS first_stay_date,
  MAX(r.check_out_date) FILTER (WHERE r.status = 'checked_out')          AS last_stay_date,
  -- Upcoming stay = nearest future reservation (not cancelled)
  MIN(r.check_in_date) FILTER (
    WHERE r.check_in_date >= current_date AND NOT r.is_cancelled
  )                                                                       AS upcoming_stay_date,
  -- Days until next stay (NULL if none)
  (
    MIN(r.check_in_date) FILTER (
      WHERE r.check_in_date >= current_date AND NOT r.is_cancelled
    ) - current_date
  )::int                                                                  AS days_until_arrival,
  -- Stay window bucket: 7d / 30d / 90d / later / none
  CASE
    WHEN MIN(r.check_in_date) FILTER (
           WHERE r.check_in_date >= current_date AND NOT r.is_cancelled
         ) IS NULL THEN 'none'
    WHEN MIN(r.check_in_date) FILTER (
           WHERE r.check_in_date >= current_date AND NOT r.is_cancelled
         ) <= current_date + interval '7 days'  THEN 'next_7'
    WHEN MIN(r.check_in_date) FILTER (
           WHERE r.check_in_date >= current_date AND NOT r.is_cancelled
         ) <= current_date + interval '30 days' THEN 'next_30'
    WHEN MIN(r.check_in_date) FILTER (
           WHERE r.check_in_date >= current_date AND NOT r.is_cancelled
         ) <= current_date + interval '90 days' THEN 'next_90'
    ELSE 'later'
  END                                                                     AS arrival_bucket,
  COUNT(DISTINCT r.source_name) FILTER (WHERE NOT r.is_cancelled)         AS distinct_sources,
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
  (COUNT(r.reservation_id) FILTER (WHERE r.status = 'checked_out') > 1) AS is_repeat,
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

CREATE UNIQUE INDEX mv_guest_profile_pk
  ON guest.mv_guest_profile (guest_id);
CREATE INDEX mv_guest_profile_country_idx
  ON guest.mv_guest_profile (country);
CREATE INDEX mv_guest_profile_revenue_idx
  ON guest.mv_guest_profile (lifetime_revenue DESC NULLS LAST);
CREATE INDEX mv_guest_profile_last_stay_idx
  ON guest.mv_guest_profile (last_stay_date DESC NULLS LAST);
CREATE INDEX mv_guest_profile_arrival_bucket_idx
  ON guest.mv_guest_profile (arrival_bucket);
CREATE INDEX mv_guest_profile_upcoming_idx
  ON guest.mv_guest_profile (upcoming_stay_date) WHERE upcoming_stay_date IS NOT NULL;
CREATE INDEX mv_guest_profile_repeat_idx
  ON guest.mv_guest_profile (is_repeat) WHERE is_repeat = true;
CREATE INDEX mv_guest_profile_email_idx
  ON guest.mv_guest_profile (guest_id) WHERE email IS NOT NULL;
CREATE INDEX mv_guest_profile_name_trgm
  ON guest.mv_guest_profile USING gin (full_name gin_trgm_ops);

-- Re-grant after recreation
GRANT SELECT ON guest.mv_guest_profile TO authenticated, anon;

-- =====================================================================
-- 3. Recreate facets view (was dropped CASCADE)
-- =====================================================================
CREATE OR REPLACE VIEW guest.v_directory_facets AS
SELECT
  country,
  COUNT(*) AS guest_count,
  SUM(lifetime_revenue) AS total_revenue,
  SUM(stays_count) AS total_stays,
  COUNT(*) FILTER (WHERE is_repeat) AS repeat_guests,
  COUNT(*) FILTER (WHERE email IS NOT NULL) AS contactable_email,
  COUNT(*) FILTER (WHERE phone IS NOT NULL) AS contactable_phone,
  COUNT(*) FILTER (WHERE arrival_bucket IN ('next_7','next_30')) AS arriving_30d
FROM guest.mv_guest_profile
WHERE country IS NOT NULL AND country <> '' AND country <> '00'
GROUP BY country
ORDER BY total_revenue DESC NULLS LAST;

GRANT SELECT ON guest.v_directory_facets TO authenticated, anon;

-- =====================================================================
-- 4. Headline RPC (single round-trip, faster than 4 count queries)
-- =====================================================================
CREATE OR REPLACE FUNCTION guest.directory_headline()
RETURNS TABLE (
  total integer,
  repeat_guests integer,
  upcoming_total integer,
  next_7 integer,
  next_30 integer,
  next_90 integer,
  contactable integer
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COUNT(*)::int                                                 AS total,
    COUNT(*) FILTER (WHERE is_repeat)::int                        AS repeat_guests,
    COUNT(*) FILTER (WHERE upcoming_stay_date IS NOT NULL)::int   AS upcoming_total,
    COUNT(*) FILTER (WHERE arrival_bucket = 'next_7')::int        AS next_7,
    COUNT(*) FILTER (WHERE arrival_bucket IN ('next_7','next_30'))::int AS next_30,
    COUNT(*) FILTER (WHERE arrival_bucket IN ('next_7','next_30','next_90'))::int AS next_90,
    COUNT(*) FILTER (WHERE email IS NOT NULL)::int                AS contactable
  FROM guest.mv_guest_profile;
$$;

GRANT EXECUTE ON FUNCTION guest.directory_headline() TO authenticated, anon;
