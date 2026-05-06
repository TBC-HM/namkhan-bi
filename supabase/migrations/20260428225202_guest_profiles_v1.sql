-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260428225202
-- Name:    guest_profiles_v1
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

DROP MATERIALIZED VIEW IF EXISTS public.mv_guest_profiles CASCADE;

CREATE MATERIALIZED VIEW public.mv_guest_profiles AS
WITH res AS (
  SELECT *
  FROM reservations
  WHERE property_id = 260955
    AND cb_guest_id IS NOT NULL
    AND cb_guest_id <> ''
),
-- Most recent name per guest
recent_name AS (
  SELECT DISTINCT ON (cb_guest_id) cb_guest_id, guest_name
  FROM res
  ORDER BY cb_guest_id, check_in_date DESC NULLS LAST
),
-- Most recent non-null country per guest
recent_country AS (
  SELECT DISTINCT ON (cb_guest_id) cb_guest_id, guest_country
  FROM res
  WHERE guest_country IS NOT NULL AND guest_country <> ''
  ORDER BY cb_guest_id, check_in_date DESC NULLS LAST
),
-- Most recent non-null email per guest
recent_email AS (
  SELECT DISTINCT ON (cb_guest_id) cb_guest_id, guest_email
  FROM res
  WHERE guest_email IS NOT NULL AND guest_email <> ''
  ORDER BY cb_guest_id, check_in_date DESC NULLS LAST
),
-- Most recent channel from completed stays
recent_channel AS (
  SELECT DISTINCT ON (cb_guest_id) cb_guest_id, source_name
  FROM res
  WHERE source_name IS NOT NULL AND status = 'checked_out'
  ORDER BY cb_guest_id, check_in_date DESC NULLS LAST
),
-- Aggregates
agg AS (
  SELECT
    cb_guest_id,
    COUNT(*) FILTER (WHERE status = 'checked_out')               AS stays_completed,
    COUNT(*) FILTER (WHERE status IN ('confirmed','checked_in')) AS stays_upcoming,
    COUNT(*) FILTER (WHERE is_cancelled = true)                  AS stays_cancelled,
    COALESCE(SUM(nights)       FILTER (WHERE status = 'checked_out'), 0) AS total_nights,
    COALESCE(SUM(total_amount) FILTER (WHERE status = 'checked_out'), 0) AS total_room_revenue_lak,
    MIN(check_in_date)  FILTER (WHERE status = 'checked_out') AS first_stay_date,
    MAX(check_in_date)  FILTER (WHERE status = 'checked_out') AS last_stay_date,
    MAX(check_out_date) FILTER (WHERE status = 'checked_out') AS last_checkout_date
  FROM res
  GROUP BY cb_guest_id
),
-- Ancillary spend per guest
ancillary AS (
  SELECT
    r.cb_guest_id,
    COALESCE(SUM(mct.amount) FILTER (WHERE mct.usali_dept = 'food_beverage'), 0) AS fnb_spend_lak,
    COALESCE(SUM(mct.amount) FILTER (WHERE mct.usali_dept IN ('spa','activities','laundry','other')), 0) AS other_spend_lak
  FROM res r
  LEFT JOIN mv_classified_transactions mct
    ON mct.reservation_id = r.reservation_id
   AND mct.amount > 0
  WHERE r.status = 'checked_out'
  GROUP BY r.cb_guest_id
)
SELECT
  a.cb_guest_id,
  260955::bigint              AS property_id,
  rn.guest_name,
  rc.guest_country,
  re.guest_email,
  a.stays_completed,
  a.stays_upcoming,
  a.stays_cancelled,
  a.total_nights,
  a.total_room_revenue_lak,
  COALESCE(an.fnb_spend_lak, 0)   AS fnb_spend_lak,
  COALESCE(an.other_spend_lak, 0) AS other_spend_lak,
  a.total_room_revenue_lak + COALESCE(an.fnb_spend_lak, 0) + COALESCE(an.other_spend_lak, 0) AS lifetime_value_lak,
  a.first_stay_date,
  a.last_stay_date,
  a.last_checkout_date,
  CASE WHEN a.last_stay_date IS NULL THEN NULL ELSE (CURRENT_DATE - a.last_stay_date) END AS days_since_last_stay,
  rch.source_name AS most_recent_channel,
  (a.stays_completed >= 2)                                               AS is_repeat,
  (a.stays_completed >= 3)                                               AS is_vip,
  ((a.total_room_revenue_lak + COALESCE(an.fnb_spend_lak, 0) + COALESCE(an.other_spend_lak, 0)) >= 50000000) AS is_big_spender,
  (COALESCE(an.fnb_spend_lak, 0) > 0)                                    AS is_fnb_converter,
  (rch.source_name ILIKE '%direct%' OR rch.source_name ILIKE '%website%') AS is_direct_booker,
  (a.last_stay_date IS NOT NULL AND a.last_stay_date < CURRENT_DATE - INTERVAL '24 months') AS is_lost,
  (a.last_stay_date IS NOT NULL AND a.last_stay_date >= CURRENT_DATE - INTERVAL '12 months' AND a.stays_completed = 1) AS is_recent_first_timer
FROM agg a
LEFT JOIN recent_name    rn  USING (cb_guest_id)
LEFT JOIN recent_country rc  USING (cb_guest_id)
LEFT JOIN recent_email   re  USING (cb_guest_id)
LEFT JOIN recent_channel rch USING (cb_guest_id)
LEFT JOIN ancillary      an  USING (cb_guest_id)
WHERE a.stays_completed > 0 OR a.stays_upcoming > 0;

CREATE UNIQUE INDEX ON public.mv_guest_profiles (cb_guest_id);
CREATE INDEX ON public.mv_guest_profiles (last_stay_date DESC NULLS LAST);
CREATE INDEX ON public.mv_guest_profiles (lifetime_value_lak DESC);
CREATE INDEX ON public.mv_guest_profiles (guest_country);
CREATE INDEX ON public.mv_guest_profiles (is_vip)         WHERE is_vip = true;
CREATE INDEX ON public.mv_guest_profiles (is_big_spender) WHERE is_big_spender = true;
CREATE INDEX ON public.mv_guest_profiles (is_lost)        WHERE is_lost = true;

GRANT SELECT ON public.mv_guest_profiles TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.refresh_bi_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_classified_transactions;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_kpi_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_kpi_today;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_revenue_by_usali_dept;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_channel_perf;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_pace_otb;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_arrivals_departures_today;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_aged_ar;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_capture_rates;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_rate_inventory_calendar;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_guest_profiles;
END;
$$;