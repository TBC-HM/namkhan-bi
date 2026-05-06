-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427183503
-- Name:    kpi_returning_v3
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Rebuild views/functions to use indexed cb_guest_id

CREATE OR REPLACE VIEW kpi.v_guest_lifetime AS
WITH res_with_spend AS (
  SELECT 
    r.reservation_id, r.cb_guest_id AS guest_id,
    r.guest_name, r.guest_country, r.check_in_date, r.check_out_date,
    r.nights, r.source_name, r.is_cancelled,
    COALESCE(ra.total_rev, 0) AS res_total_rev,
    COALESCE(ra.ancillary_rev, 0) AS res_ancillary_rev,
    COALESCE(ra.rooms_rev, 0) AS res_rooms_rev
  FROM reservations r
  LEFT JOIN kpi.v_reservation_ancillary ra ON ra.reservation_id = r.reservation_id
  WHERE r.cb_guest_id IS NOT NULL
)
SELECT 
  guest_id,
  (array_agg(guest_name ORDER BY check_in_date DESC NULLS LAST))[1] AS guest_name,
  (array_agg(guest_country ORDER BY check_in_date DESC NULLS LAST) 
     FILTER (WHERE guest_country IS NOT NULL AND guest_country <> ''))[1] AS guest_country,
  COUNT(*) FILTER (WHERE NOT is_cancelled) AS total_stays,
  COUNT(*) FILTER (WHERE is_cancelled) AS cancelled_stays,
  SUM(nights) FILTER (WHERE NOT is_cancelled) AS total_nights,
  SUM(res_total_rev) FILTER (WHERE NOT is_cancelled) AS lifetime_total_rev,
  SUM(res_rooms_rev) FILTER (WHERE NOT is_cancelled) AS lifetime_rooms_rev,
  SUM(res_ancillary_rev) FILTER (WHERE NOT is_cancelled) AS lifetime_ancillary_rev,
  MIN(check_in_date) FILTER (WHERE NOT is_cancelled) AS first_stay,
  MAX(check_in_date) FILTER (WHERE NOT is_cancelled) AS last_stay,
  (array_agg(source_name ORDER BY check_in_date DESC NULLS LAST))[1] AS last_source,
  CASE WHEN COUNT(*) FILTER (WHERE NOT is_cancelled) >= 2 THEN true ELSE false END AS is_repeat
FROM res_with_spend
GROUP BY guest_id;

CREATE OR REPLACE FUNCTION kpi.repeat_rate(
  p_from date DEFAULT (CURRENT_DATE - 365),
  p_to date DEFAULT (CURRENT_DATE - 1)
) RETURNS TABLE(
  total_stays_in_period int, unique_guests_in_period int,
  repeat_guests_in_period int, new_guests_in_period int,
  repeat_pct numeric, repeat_revenue numeric, new_revenue numeric, repeat_revenue_pct numeric
) AS $$
  WITH stays_period AS (
    SELECT r.cb_guest_id AS guest_id, r.reservation_id, r.check_in_date,
      COALESCE(ra.total_rev, 0) AS rev
    FROM reservations r
    LEFT JOIN kpi.v_reservation_ancillary ra ON ra.reservation_id = r.reservation_id
    WHERE NOT r.is_cancelled 
      AND r.check_in_date BETWEEN p_from AND p_to
      AND r.cb_guest_id IS NOT NULL
  ),
  -- Compute first stay per guest globally (cheap with index)
  first_stay_per_guest AS (
    SELECT cb_guest_id, MIN(check_in_date) AS first_check_in
    FROM reservations 
    WHERE NOT is_cancelled AND cb_guest_id IS NOT NULL
    GROUP BY cb_guest_id
  ),
  classified AS (
    SELECT sp.*,
      CASE WHEN sp.check_in_date > f.first_check_in THEN 'repeat' ELSE 'new' END AS guest_type
    FROM stays_period sp
    JOIN first_stay_per_guest f ON f.cb_guest_id = sp.guest_id
  )
  SELECT 
    COUNT(*)::int,
    COUNT(DISTINCT guest_id)::int,
    COUNT(DISTINCT guest_id) FILTER (WHERE guest_type = 'repeat')::int,
    COUNT(DISTINCT guest_id) FILTER (WHERE guest_type = 'new')::int,
    ROUND(100.0 * COUNT(DISTINCT guest_id) FILTER (WHERE guest_type = 'repeat') 
          / NULLIF(COUNT(DISTINCT guest_id),0), 1),
    ROUND(SUM(rev) FILTER (WHERE guest_type = 'repeat')::numeric, 0),
    ROUND(SUM(rev) FILTER (WHERE guest_type = 'new')::numeric, 0),
    ROUND(100.0 * SUM(rev) FILTER (WHERE guest_type = 'repeat') / NULLIF(SUM(rev), 0), 1)
  FROM classified;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE VIEW kpi.v_cohort_retention AS
WITH first_stays AS (
  SELECT guest_id, TO_CHAR(first_stay, 'YYYY-MM') AS cohort_month, first_stay
  FROM kpi.v_guest_lifetime
  WHERE first_stay >= '2024-01-01'
),
returns AS (
  SELECT fs.cohort_month, fs.guest_id,
    EXISTS (
      SELECT 1 FROM reservations r2
      WHERE r2.cb_guest_id = fs.guest_id 
        AND r2.check_in_date > fs.first_stay 
        AND NOT r2.is_cancelled
    ) AS has_returned
  FROM first_stays fs
)
SELECT cohort_month, COUNT(*) AS cohort_size,
  COUNT(*) FILTER (WHERE has_returned) AS returned,
  ROUND(100.0 * COUNT(*) FILTER (WHERE has_returned) / NULLIF(COUNT(*),0), 1) AS retention_pct
FROM returns
GROUP BY cohort_month ORDER BY cohort_month;
