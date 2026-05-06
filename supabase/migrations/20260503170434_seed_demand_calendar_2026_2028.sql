-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503170434
-- Name:    seed_demand_calendar_2026_2028
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Seed every date 2026-01-01 to 2028-12-31 with day-of-week scoring
INSERT INTO revenue.demand_calendar (cal_date, day_of_week, iso_week, month, dow_score)
SELECT 
  d::date,
  EXTRACT(DOW FROM d)::smallint,
  EXTRACT(WEEK FROM d)::smallint,
  EXTRACT(MONTH FROM d)::smallint,
  CASE EXTRACT(DOW FROM d)::int
    WHEN 5 THEN 90  -- Friday
    WHEN 6 THEN 95  -- Saturday (peak for LP leisure)
    WHEN 4 THEN 70  -- Thursday
    WHEN 0 THEN 60  -- Sunday
    WHEN 3 THEN 45  -- Wednesday
    WHEN 2 THEN 35  -- Tuesday
    WHEN 1 THEN 30  -- Monday
  END
FROM generate_series('2026-01-01'::date, '2028-12-31'::date, '1 day'::interval) d
ON CONFLICT (cal_date) DO NOTHING;
