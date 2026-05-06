-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503171213
-- Name:    plan_ly_forecast_views_2026_05_03
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- LY (Actuals 2025) raw lines, normalised to gl vocabulary
CREATE OR REPLACE VIEW gl.v_ly_lines AS
SELECT
  (l.period_year::text || '-' || lpad(l.period_month::text, 2, '0')) AS period_yyyymm,
  a.usali_subcategory,
  gl.normalize_plan_dept(m.usali_dept) AS usali_department,
  l.amount_usd
FROM plan.lines l
JOIN plan.scenarios s ON s.scenario_id = l.scenario_id
LEFT JOIN gl.accounts a ON a.account_id = l.account_code
LEFT JOIN plan.account_map m ON m.account_code = l.account_code
WHERE s.name = 'Actuals 2025'
  AND a.usali_subcategory IS NOT NULL
  AND COALESCE(m.usali_dept, '') <> 'Balance Sheet';

GRANT SELECT ON gl.v_ly_lines TO anon, service_role;

-- Forecast (Conservative 2026) raw lines
CREATE OR REPLACE VIEW gl.v_forecast_lines AS
SELECT
  (l.period_year::text || '-' || lpad(l.period_month::text, 2, '0')) AS period_yyyymm,
  a.usali_subcategory,
  gl.normalize_plan_dept(m.usali_dept) AS usali_department,
  l.amount_usd
FROM plan.lines l
JOIN plan.scenarios s ON s.scenario_id = l.scenario_id
LEFT JOIN gl.accounts a ON a.account_id = l.account_code
LEFT JOIN plan.account_map m ON m.account_code = l.account_code
WHERE s.name = 'Conservative 2026'
  AND a.usali_subcategory IS NOT NULL
  AND COALESCE(m.usali_dept, '') <> 'Balance Sheet';

GRANT SELECT ON gl.v_forecast_lines TO anon, service_role;

-- Combined "scenario stack" view for any one period: all 4 scenarios side-by-side
CREATE OR REPLACE VIEW gl.v_scenario_stack AS
WITH actual AS (
  SELECT period_yyyymm, usali_subcategory,
         COALESCE(usali_department, 'Undistributed') AS usali_department,
         CASE WHEN usali_subcategory = 'Revenue' THEN -sum(amount_usd) ELSE sum(amount_usd) END AS amt
  FROM gl.mv_usali_pl_monthly
  GROUP BY period_yyyymm, usali_subcategory, COALESCE(usali_department, 'Undistributed')
),
budget AS (
  SELECT period_yyyymm, usali_subcategory, usali_department, sum(amount_usd) AS amt
  FROM gl.v_budget_lines GROUP BY 1,2,3
),
ly AS (
  SELECT period_yyyymm, usali_subcategory, usali_department, sum(amount_usd) AS amt
  FROM gl.v_ly_lines GROUP BY 1,2,3
),
fcast AS (
  SELECT period_yyyymm, usali_subcategory, usali_department, sum(amount_usd) AS amt
  FROM gl.v_forecast_lines GROUP BY 1,2,3
)
SELECT
  COALESCE(a.period_yyyymm, b.period_yyyymm, l.period_yyyymm, f.period_yyyymm)             AS period_yyyymm,
  COALESCE(a.usali_subcategory, b.usali_subcategory, l.usali_subcategory, f.usali_subcategory) AS usali_subcategory,
  COALESCE(a.usali_department, b.usali_department, l.usali_department, f.usali_department)    AS usali_department,
  COALESCE(a.amt, 0) AS actual_usd,
  COALESCE(b.amt, 0) AS budget_usd,
  COALESCE(l.amt, 0) AS ly_usd,
  COALESCE(f.amt, 0) AS forecast_usd
FROM actual a
FULL OUTER JOIN budget b USING (period_yyyymm, usali_subcategory, usali_department)
FULL OUTER JOIN ly     l USING (period_yyyymm, usali_subcategory, usali_department)
FULL OUTER JOIN fcast  f USING (period_yyyymm, usali_subcategory, usali_department);

GRANT SELECT ON gl.v_scenario_stack TO anon, service_role;