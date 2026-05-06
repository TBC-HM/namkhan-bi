-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427183217
-- Name:    kpi_returning_guests_v2
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


CREATE OR REPLACE VIEW kpi.v_guest_lifetime AS
WITH res_with_spend AS (
  SELECT 
    r.reservation_id,
    COALESCE(NULLIF(r.raw->>'guestID',''), 'unknown') AS guest_id,
    r.guest_name, r.guest_country, r.check_in_date, r.check_out_date,
    r.nights, r.source_name, r.is_cancelled,
    COALESCE(ra.total_rev, 0) AS res_total_rev,
    COALESCE(ra.ancillary_rev, 0) AS res_ancillary_rev,
    COALESCE(ra.rooms_rev, 0) AS res_rooms_rev
  FROM reservations r
  LEFT JOIN kpi.v_reservation_ancillary ra ON ra.reservation_id = r.reservation_id
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
WHERE guest_id <> 'unknown'
GROUP BY guest_id;

CREATE OR REPLACE FUNCTION kpi.repeat_rate(
  p_from date DEFAULT (CURRENT_DATE - 365),
  p_to date DEFAULT (CURRENT_DATE - 1)
) RETURNS TABLE(
  total_stays_in_period int, unique_guests_in_period int,
  repeat_guests_in_period int, new_guests_in_period int,
  repeat_pct numeric, repeat_revenue numeric, new_revenue numeric, repeat_revenue_pct numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH stays_period AS (
    SELECT 
      COALESCE(NULLIF(r.raw->>'guestID',''), 'unknown') AS guest_id,
      r.reservation_id, r.check_in_date,
      COALESCE(ra.total_rev, 0) AS rev
    FROM reservations r
    LEFT JOIN kpi.v_reservation_ancillary ra ON ra.reservation_id = r.reservation_id
    WHERE NOT r.is_cancelled 
      AND r.check_in_date BETWEEN p_from AND p_to
      AND COALESCE(NULLIF(r.raw->>'guestID',''), 'unknown') <> 'unknown'
  ),
  classified AS (
    SELECT sp.*,
      CASE WHEN EXISTS (
        SELECT 1 FROM reservations r2 
        WHERE COALESCE(NULLIF(r2.raw->>'guestID',''), 'unknown') = sp.guest_id
          AND NOT r2.is_cancelled 
          AND r2.check_in_date < sp.check_in_date
      ) THEN 'repeat' ELSE 'new' END AS guest_type
    FROM stays_period sp
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
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION kpi.top_guests(p_limit int DEFAULT 50, p_min_stays int DEFAULT 2)
RETURNS TABLE(
  guest_id text, guest_name text, country text,
  total_stays bigint, total_nights bigint,
  lifetime_rev numeric, ancillary_rev numeric, avg_per_stay numeric,
  first_stay date, last_stay date, days_since_last int
) AS $$
  SELECT g.guest_id, g.guest_name, g.guest_country,
    g.total_stays, g.total_nights,
    ROUND(g.lifetime_total_rev::numeric, 0),
    ROUND(g.lifetime_ancillary_rev::numeric, 0),
    ROUND((g.lifetime_total_rev / NULLIF(g.total_stays,0))::numeric, 0),
    g.first_stay, g.last_stay,
    (CURRENT_DATE - g.last_stay)::int
  FROM kpi.v_guest_lifetime g
  WHERE g.total_stays >= p_min_stays
  ORDER BY g.lifetime_total_rev DESC NULLS LAST
  LIMIT p_limit;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE VIEW kpi.v_cohort_retention AS
WITH first_stays AS (
  SELECT guest_id, TO_CHAR(first_stay, 'YYYY-MM') AS cohort_month, first_stay
  FROM kpi.v_guest_lifetime
  WHERE first_stay >= '2024-01-01'
),
returns AS (
  SELECT fs.cohort_month, fs.guest_id,
    COUNT(*) FILTER (WHERE r.check_in_date > fs.first_stay AND NOT r.is_cancelled) AS return_count
  FROM first_stays fs
  LEFT JOIN reservations r 
    ON COALESCE(NULLIF(r.raw->>'guestID',''),'unknown') = fs.guest_id
  GROUP BY fs.cohort_month, fs.guest_id
)
SELECT cohort_month, COUNT(*) AS cohort_size,
  COUNT(*) FILTER (WHERE return_count > 0) AS returned,
  ROUND(100.0 * COUNT(*) FILTER (WHERE return_count > 0) / NULLIF(COUNT(*),0), 1) AS retention_pct
FROM returns
GROUP BY cohort_month ORDER BY cohort_month;
