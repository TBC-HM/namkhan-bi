-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503145834
-- Name:    phase8_daily_revenue_with_stly
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


CREATE OR REPLACE VIEW public.v_daily_revenue_90d AS
WITH days AS (
  SELECT generate_series(CURRENT_DATE - 89, CURRENT_DATE, '1 day'::interval)::date AS day
),
actual AS (
  SELECT rr.night_date AS day, ROUND(SUM(rr.rate), 2) AS revenue
  FROM public.reservation_rooms rr
  JOIN public.reservations r 
    ON r.reservation_id = rr.reservation_id 
   AND NOT r.is_cancelled
  WHERE rr.night_date BETWEEN CURRENT_DATE - 89 AND CURRENT_DATE
  GROUP BY 1
),
stly_monthly AS (
  SELECT period_year, period_month, value_numeric AS monthly_total,
    EXTRACT(DAY FROM (
      make_date(period_year, period_month, 1) + INTERVAL '1 month' - INTERVAL '1 day'
    ))::int AS days_in_month
  FROM plan.drivers d
  JOIN plan.scenarios s USING (scenario_id)
  WHERE s.name = 'Actuals 2025' AND d.driver_key = 'revenue_total_usd'
)
SELECT 
  d.day,
  COALESCE(a.revenue, 0) AS revenue_actual_usd,
  ROUND(s.monthly_total / NULLIF(s.days_in_month, 0), 2) AS revenue_stly_daily_avg_usd
FROM days d
LEFT JOIN actual a ON a.day = d.day
LEFT JOIN stly_monthly s 
  ON s.period_year  = EXTRACT(YEAR  FROM (d.day - INTERVAL '1 year'))::int
 AND s.period_month = EXTRACT(MONTH FROM (d.day - INTERVAL '1 year'))::int
ORDER BY d.day;

GRANT SELECT ON public.v_daily_revenue_90d TO anon, authenticated;
