-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503145751
-- Name:    phase6_pace_curve_v2
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Pace curve = day-by-day rooms occupied (historical actuals + forward OTB)
-- vs STLY (1 year prior, monthly avg) vs Budget (current year, monthly avg)
CREATE OR REPLACE VIEW public.v_pace_curve AS
WITH days AS (
  SELECT generate_series(CURRENT_DATE - 90, CURRENT_DATE + 120, '1 day'::interval)::date AS day
),
actuals AS (
  -- Historical occupied rooms per day
  SELECT rr.night_date AS day, COUNT(*) AS rooms_sold
  FROM public.reservation_rooms rr
  JOIN public.reservations r 
    ON r.reservation_id = rr.reservation_id 
   AND r.status NOT IN ('cancelled', 'no_show')
  WHERE rr.night_date BETWEEN CURRENT_DATE - 90 AND CURRENT_DATE - 1
  GROUP BY 1
),
otb AS (
  -- Forward OTB
  SELECT night_date AS day, confirmed_rooms AS rooms_otb
  FROM public.v_otb_pace
),
stly_monthly AS (
  SELECT period_year, period_month, value_numeric AS monthly_total,
    EXTRACT(DAY FROM (
      make_date(period_year, period_month, 1) + INTERVAL '1 month' - INTERVAL '1 day'
    ))::int AS days_in_month
  FROM plan.drivers d
  JOIN plan.scenarios s USING (scenario_id)
  WHERE s.name = 'Actuals 2025' AND d.driver_key = 'room_nights'
),
budget_monthly AS (
  SELECT period_year, period_month, value_numeric AS monthly_total,
    EXTRACT(DAY FROM (
      make_date(period_year, period_month, 1) + INTERVAL '1 month' - INTERVAL '1 day'
    ))::int AS days_in_month
  FROM plan.drivers d
  JOIN plan.scenarios s USING (scenario_id)
  WHERE s.name = 'Budget 2026 v1' AND d.driver_key = 'room_nights'
)
SELECT 
  d.day,
  CASE WHEN d.day < CURRENT_DATE THEN COALESCE(a.rooms_sold, 0) ELSE NULL END AS rooms_actual,
  CASE WHEN d.day >= CURRENT_DATE THEN COALESCE(o.rooms_otb, 0)::int ELSE NULL END AS rooms_otb,
  ROUND(s.monthly_total / NULLIF(s.days_in_month, 0), 1) AS rooms_stly_daily_avg,
  ROUND(b.monthly_total / NULLIF(b.days_in_month, 0), 1) AS rooms_budget_daily_avg,
  s.monthly_total AS stly_month_total,
  b.monthly_total AS budget_month_total
FROM days d
LEFT JOIN actuals a ON a.day = d.day
LEFT JOIN otb     o ON o.day = d.day
LEFT JOIN stly_monthly s 
  ON s.period_year  = EXTRACT(YEAR  FROM (d.day - INTERVAL '1 year'))::int
 AND s.period_month = EXTRACT(MONTH FROM (d.day - INTERVAL '1 year'))::int
LEFT JOIN budget_monthly b 
  ON b.period_year  = EXTRACT(YEAR  FROM d.day)::int
 AND b.period_month = EXTRACT(MONTH FROM d.day)::int
ORDER BY d.day;

GRANT SELECT ON public.v_pace_curve TO anon, authenticated;
