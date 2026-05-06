-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503225732
-- Name:    vat_strip_budget_lines_v3
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


DROP VIEW IF EXISTS gl.v_scenario_stack CASCADE;
DROP VIEW IF EXISTS gl.v_budget_vs_actual CASCADE;
DROP VIEW IF EXISTS gl.v_budget_lines CASCADE;

CREATE VIEW gl.v_budget_lines AS
SELECT
  (l.period_year::text || '-') || lpad(l.period_month::text, 2, '0') AS period_yyyymm,
  a.usali_subcategory,
  CASE
    WHEN a.usali_subcategory IN ('A&G','Sales & Marketing','POM','Utilities','Mgmt Fees',
                                 'Depreciation','Interest','Income Tax','FX Gain/Loss','Non-Operating')
      THEN 'Undistributed'
    ELSE gl.normalize_plan_dept(m.usali_dept)
  END AS usali_department,
  CASE
    WHEN a.usali_subcategory IN ('Revenue','Cost of Sales','Other Operating Expenses',
                                 'A&G','Sales & Marketing','POM','Utilities','Mgmt Fees')
      THEN ROUND(l.amount_usd / 1.10, 4)::numeric(18,4)
    ELSE l.amount_usd::numeric(18,4)
  END AS amount_usd
FROM plan.lines l
JOIN plan.scenarios s ON s.scenario_id = l.scenario_id
LEFT JOIN gl.accounts a ON a.account_id = l.account_code
LEFT JOIN plan.account_map m ON m.account_code = l.account_code
WHERE s.name = 'Budget 2026 v1'
  AND a.usali_subcategory IS NOT NULL
  AND COALESCE(m.usali_dept,'') <> 'Balance Sheet';

COMMENT ON VIEW gl.v_budget_lines IS
'Budget 2026 v1 lines for /finance/pnl. Patched 2026-05-03: force Undistributed dept for above-the-line subcats; strip Lao 10% VAT from Revenue/CoS/OOE/A&G/S&M/POM/Utilities/Mgmt Fees vs gross plan.lines. Payroll/Depreciation/Interest/Tax/FX/Non-Op preserved gross.';

CREATE VIEW gl.v_budget_vs_actual AS
WITH budget AS (
  SELECT period_yyyymm, usali_subcategory, usali_department, SUM(amount_usd) AS budget_usd
  FROM gl.v_budget_lines GROUP BY 1,2,3
), actuals AS (
  SELECT period_yyyymm, usali_subcategory,
         COALESCE(usali_department,'Undistributed') AS usali_department,
         CASE WHEN usali_subcategory='Revenue' THEN -SUM(amount_usd) ELSE SUM(amount_usd) END AS actual_usd
  FROM gl.mv_usali_pl_monthly GROUP BY 1,2,3
)
SELECT
  COALESCE(a.period_yyyymm, b.period_yyyymm) AS period_yyyymm,
  COALESCE(a.usali_subcategory, b.usali_subcategory) AS usali_subcategory,
  COALESCE(a.usali_department, b.usali_department) AS usali_department,
  COALESCE(a.actual_usd, 0) AS actual_usd,
  COALESCE(b.budget_usd, 0) AS budget_usd,
  COALESCE(a.actual_usd, 0) - COALESCE(b.budget_usd, 0) AS variance_usd,
  CASE WHEN COALESCE(b.budget_usd,0) <> 0
       THEN (COALESCE(a.actual_usd,0) - b.budget_usd) / abs(b.budget_usd) * 100
       ELSE NULL END AS variance_pct
FROM actuals a FULL JOIN budget b USING (period_yyyymm, usali_subcategory, usali_department);

CREATE VIEW gl.v_scenario_stack AS
WITH actual AS (
  SELECT period_yyyymm, usali_subcategory, COALESCE(usali_department,'Undistributed') AS usali_department,
    CASE WHEN usali_subcategory='Revenue' THEN -SUM(amount_usd) ELSE SUM(amount_usd) END AS amt
  FROM gl.mv_usali_pl_monthly GROUP BY 1,2,3
), budget AS (
  SELECT period_yyyymm, usali_subcategory, usali_department, SUM(amount_usd) AS amt
  FROM gl.v_budget_lines GROUP BY 1,2,3
), ly AS (
  SELECT period_yyyymm, usali_subcategory, usali_department, SUM(amount_usd) AS amt
  FROM gl.v_ly_lines GROUP BY 1,2,3
), fcast AS (
  SELECT period_yyyymm, usali_subcategory, usali_department, SUM(amount_usd) AS amt
  FROM gl.v_forecast_lines GROUP BY 1,2,3
)
SELECT
  COALESCE(a.period_yyyymm, b.period_yyyymm, l.period_yyyymm, f.period_yyyymm) AS period_yyyymm,
  COALESCE(a.usali_subcategory, b.usali_subcategory, l.usali_subcategory, f.usali_subcategory) AS usali_subcategory,
  COALESCE(a.usali_department, b.usali_department, l.usali_department, f.usali_department) AS usali_department,
  COALESCE(a.amt, 0) AS actual_usd,
  COALESCE(b.amt, 0) AS budget_usd,
  COALESCE(l.amt, 0) AS ly_usd,
  COALESCE(f.amt, 0) AS forecast_usd
FROM actual a FULL JOIN budget b USING (period_yyyymm, usali_subcategory, usali_department)
              FULL JOIN ly l       USING (period_yyyymm, usali_subcategory, usali_department)
              FULL JOIN fcast f    USING (period_yyyymm, usali_subcategory, usali_department);
