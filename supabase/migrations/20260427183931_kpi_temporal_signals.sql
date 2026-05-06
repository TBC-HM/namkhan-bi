-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427183931
-- Name:    kpi_temporal_signals
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ============================================================
-- MODULE 4: Time-based signals — DOW, weekday/weekend, seasonality
-- Excludes hour-of-day because transaction_date is post time, not service time
-- ============================================================

-- Day-of-week + weekday/weekend pattern
CREATE OR REPLACE VIEW kpi.v_dow_signals AS
SELECT 
  service_date,
  EXTRACT(DOW FROM service_date)::int AS dow,
  TO_CHAR(service_date, 'Day') AS dow_name,
  CASE WHEN EXTRACT(DOW FROM service_date) IN (5,6) THEN 'Weekend' ELSE 'Weekday' END AS day_type,
  usali_dept, usali_subdept,
  COUNT(*) AS tx,
  ROUND(SUM(amount)::numeric, 0) AS revenue
FROM transactions
WHERE service_date IS NOT NULL 
  AND transaction_type = 'debit'
  AND usali_dept NOT IN ('Tax','Fee','Adjustment')
GROUP BY service_date, EXTRACT(DOW FROM service_date), TO_CHAR(service_date, 'Day'),
         CASE WHEN EXTRACT(DOW FROM service_date) IN (5,6) THEN 'Weekend' ELSE 'Weekday' END,
         usali_dept, usali_subdept;

-- DOW summary skill: avg revenue by day of week and dept
CREATE OR REPLACE FUNCTION kpi.dow_pattern(
  p_from date DEFAULT (CURRENT_DATE - 90),
  p_to date DEFAULT (CURRENT_DATE - 1),
  p_dept text DEFAULT NULL,
  p_subdept text DEFAULT NULL
) RETURNS TABLE(
  dow_name text, dow_index int,
  total_revenue numeric, avg_daily_revenue numeric,
  total_tx bigint, avg_daily_tx numeric
) AS $$
  SELECT 
    TRIM(TO_CHAR(service_date, 'Day')),
    EXTRACT(DOW FROM service_date)::int,
    ROUND(SUM(amount)::numeric, 0),
    ROUND((SUM(amount)::numeric / COUNT(DISTINCT service_date))::numeric, 0),
    COUNT(*),
    ROUND((COUNT(*)::numeric / COUNT(DISTINCT service_date))::numeric, 1)
  FROM transactions
  WHERE service_date BETWEEN p_from AND p_to
    AND transaction_type = 'debit'
    AND usali_dept NOT IN ('Tax','Fee','Adjustment')
    AND (p_dept IS NULL OR usali_dept = p_dept)
    AND (p_subdept IS NULL OR usali_subdept = p_subdept)
  GROUP BY EXTRACT(DOW FROM service_date), TO_CHAR(service_date, 'Day')
  ORDER BY 2;
$$ LANGUAGE sql STABLE;

-- Monthly seasonality view (24 months out)
CREATE OR REPLACE VIEW kpi.v_monthly_seasonality AS
SELECT 
  TO_CHAR(service_date, 'YYYY-MM') AS year_month,
  EXTRACT(YEAR FROM service_date)::int AS year,
  EXTRACT(MONTH FROM service_date)::int AS month,
  TRIM(TO_CHAR(service_date, 'Mon')) AS month_name,
  usali_dept, usali_subdept,
  COUNT(*) AS tx,
  COUNT(DISTINCT reservation_id) AS reservations,
  ROUND(SUM(amount)::numeric, 0) AS revenue
FROM transactions
WHERE service_date IS NOT NULL 
  AND transaction_type = 'debit'
  AND usali_dept NOT IN ('Tax','Fee','Adjustment')
GROUP BY 1, 2, 3, 4, usali_dept, usali_subdept;

-- Seasonal index: month vs annual avg per dept
CREATE OR REPLACE VIEW kpi.v_seasonal_index AS
WITH monthly AS (
  SELECT 
    EXTRACT(MONTH FROM service_date)::int AS month,
    TRIM(TO_CHAR(service_date, 'Mon')) AS month_name,
    usali_dept,
    SUM(amount) AS revenue
  FROM transactions
  WHERE service_date IS NOT NULL
    AND transaction_type = 'debit'
    AND usali_dept NOT IN ('Tax','Fee','Adjustment')
    AND service_date >= '2025-01-01'
  GROUP BY 1, 2, usali_dept
),
avg_per_dept AS (
  SELECT usali_dept, AVG(revenue) AS monthly_avg
  FROM monthly GROUP BY usali_dept
)
SELECT 
  m.month, m.month_name, m.usali_dept,
  ROUND(m.revenue::numeric, 0) AS revenue,
  ROUND(a.monthly_avg::numeric, 0) AS avg_monthly,
  ROUND((m.revenue / NULLIF(a.monthly_avg, 0))::numeric, 2) AS index_vs_avg
FROM monthly m
JOIN avg_per_dept a ON a.usali_dept = m.usali_dept;
