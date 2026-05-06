-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502144122
-- Name:    phase2_rateplan_analytics_views
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- v_rate_plan_perf : per-plan KPIs over a parameterized window
CREATE OR REPLACE VIEW public.v_rate_plan_perf AS
SELECT
  r.property_id,
  r.rate_plan,
  r.check_in_date,
  r.status,
  r.total_amount,
  r.nights,
  r.booking_date,
  CASE
    WHEN r.rate_plan ILIKE '%nkmember%'                                          THEN 'Member'
    WHEN r.rate_plan ILIKE '%hilton%programme%' OR r.rate_plan ILIKE '%uwc%'     THEN 'B2B / Loyalty'
    WHEN r.rate_plan ILIKE '%advance purchase%' OR r.rate_plan ILIKE '%non refundable%' THEN 'Restricted'
    WHEN r.rate_plan ILIKE '%gds%' OR r.rate_plan ILIKE '%mobile(app)%'
         OR r.rate_plan ILIKE '%lowestavailablerate%'                            THEN 'GDS / Channel'
    WHEN r.rate_plan ILIKE '%flex%' OR r.rate_plan ILIKE '%best available%'
         OR r.rate_plan ILIKE '%standard%'                                       THEN 'Flex / BAR'
    WHEN r.rate_plan ILIKE '%special%' OR r.rate_plan ILIKE '%offer%'
         OR r.rate_plan ILIKE '%promo%'                                          THEN 'Promotion'
    WHEN r.rate_plan ILIKE '%detox%' OR r.rate_plan ILIKE '%retreat%'
         OR r.rate_plan ILIKE '%package%'                                        THEN 'Package'
    ELSE 'Other'
  END AS plan_type,
  EXISTS (
    SELECT 1 FROM rate_plans rp
    WHERE rp.property_id = r.property_id AND rp.rate_name = r.rate_plan
  ) AS is_configured,
  (r.check_in_date - r.booking_date::date) AS lead_days
FROM reservations r
WHERE r.property_id = 260955
  AND r.rate_plan IS NOT NULL
  AND r.rate_plan <> '';

-- v_rate_plan_sleeping : configured plans NOT booked in last 90d
CREATE OR REPLACE VIEW public.v_rate_plan_sleeping AS
WITH last_use AS (
  SELECT
    rate_plan,
    MAX(booking_date::date) AS last_booked
  FROM reservations
  WHERE property_id = 260955
    AND status != 'canceled'
    AND rate_plan IS NOT NULL
  GROUP BY rate_plan
)
SELECT
  rp.rate_name,
  rp.rate_type,
  lu.last_booked,
  COALESCE((CURRENT_DATE - lu.last_booked), 9999) AS days_since
FROM rate_plans rp
LEFT JOIN last_use lu ON lu.rate_plan = rp.rate_name
WHERE rp.property_id = 260955
  AND (lu.last_booked IS NULL OR lu.last_booked < CURRENT_DATE - 90);

-- v_rate_plan_orphans : plans booked but NOT in rate_plans master table
CREATE OR REPLACE VIEW public.v_rate_plan_orphans AS
WITH used AS (
  SELECT
    rate_plan,
    COUNT(*) AS bookings_lifetime,
    SUM(total_amount) AS revenue_lifetime,
    MAX(booking_date::date) AS last_booked
  FROM reservations
  WHERE property_id = 260955
    AND status != 'canceled'
    AND rate_plan IS NOT NULL
  GROUP BY rate_plan
)
SELECT
  u.rate_plan,
  u.bookings_lifetime,
  u.revenue_lifetime,
  u.last_booked
FROM used u
WHERE NOT EXISTS (
  SELECT 1 FROM rate_plans rp
  WHERE rp.property_id = 260955 AND rp.rate_name = u.rate_plan
);

-- Grants
GRANT SELECT ON public.v_rate_plan_perf TO anon, authenticated;
GRANT SELECT ON public.v_rate_plan_sleeping TO anon, authenticated;
GRANT SELECT ON public.v_rate_plan_orphans TO anon, authenticated;