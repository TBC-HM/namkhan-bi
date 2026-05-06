-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503170058
-- Name:    budget_view_uses_plan_2026_05_03
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Grant read access on plan.* so the gl-exposed view can resolve them
GRANT USAGE ON SCHEMA plan TO anon, service_role;
GRANT SELECT ON plan.scenarios, plan.lines, plan.drivers, plan.account_map TO anon, service_role;

-- Rebuild gl.v_budget_vs_actual to source budgets from plan.lines
-- (Budget 2026 v1 scenario, by default) and actuals from mv_usali_pl_monthly.
DROP VIEW IF EXISTS gl.v_budget_vs_actual CASCADE;

CREATE VIEW gl.v_budget_vs_actual AS
WITH budget AS (
  -- Aggregate Budget 2026 v1 lines per period × subcategory × dept.
  -- Map account_code → usali_subcategory via gl.accounts (the QB chart)
  -- and account_code → usali_dept via plan.account_map.
  SELECT
    (l.period_year::text || '-' || lpad(l.period_month::text, 2, '0')) AS period_yyyymm,
    a.usali_subcategory,
    -- plan.account_map.usali_dept uses different vocabulary than gl.classes.
    -- Map plan dept names to gl dept names so they line up with the actuals side.
    CASE
      WHEN m.usali_dept IN ('Rooms', 'F&B', 'Spa', 'Activities')        THEN m.usali_dept
      WHEN m.usali_dept = 'Mekong Cruise'                                THEN 'Mekong Cruise'
      WHEN m.usali_dept IN ('Other Operated Departments','Other Operated','Retail','Transport') THEN 'Other Operated'
      WHEN m.usali_dept IN ('A&G','Sales & Marketing','POM','Utilities','Mgmt Fees','Undistributed') THEN ''
      WHEN m.usali_dept IN ('Non-Operating','Below GOP','Tax','Depreciation','Interest','FX')        THEN ''
      WHEN m.usali_dept = 'Balance Sheet' THEN NULL  -- exclude balance sheet from P&L view
      ELSE COALESCE(m.usali_dept, '')
    END AS usali_department,
    sum(l.amount_usd) AS budget_usd
  FROM plan.lines l
  JOIN plan.scenarios s ON s.scenario_id = l.scenario_id
  LEFT JOIN gl.accounts a ON a.account_id = l.account_code
  LEFT JOIN plan.account_map m ON m.account_code = l.account_code
  WHERE s.name = 'Budget 2026 v1'
    AND a.usali_subcategory IS NOT NULL
    AND (m.usali_dept IS NULL OR m.usali_dept <> 'Balance Sheet')
  GROUP BY 1, 2, 3
),
actuals AS (
  SELECT period_yyyymm,
         usali_subcategory,
         COALESCE(usali_department, '') AS usali_department,
         sum(amount_usd) AS actual_usd
  FROM gl.mv_usali_pl_monthly
  GROUP BY period_yyyymm, usali_subcategory, COALESCE(usali_department, '')
)
SELECT COALESCE(a.period_yyyymm,    b.period_yyyymm)    AS period_yyyymm,
       COALESCE(a.usali_subcategory, b.usali_subcategory) AS usali_subcategory,
       COALESCE(a.usali_department,  b.usali_department)  AS usali_department,
       COALESCE(a.actual_usd, 0) AS actual_usd,
       COALESCE(b.budget_usd, 0) AS budget_usd,
       (COALESCE(a.actual_usd, 0) - COALESCE(b.budget_usd, 0)) AS variance_usd,
       CASE WHEN COALESCE(b.budget_usd, 0) <> 0
            THEN ((COALESCE(a.actual_usd, 0) - b.budget_usd) / abs(b.budget_usd)) * 100
            ELSE NULL
       END AS variance_pct
FROM actuals a
FULL OUTER JOIN budget b
  ON a.period_yyyymm = b.period_yyyymm
 AND a.usali_subcategory = b.usali_subcategory
 AND a.usali_department = b.usali_department;

GRANT SELECT ON gl.v_budget_vs_actual TO anon, service_role;

-- Mirror view: budget rows only — used by /finance/pnl getBudgetByPeriod()
-- so the existing gl.budgets-based query in app code keeps working as a passthrough.
CREATE OR REPLACE VIEW gl.v_budget_lines AS
SELECT
  (l.period_year::text || '-' || lpad(l.period_month::text, 2, '0')) AS period_yyyymm,
  a.usali_subcategory,
  CASE
    WHEN m.usali_dept IN ('Rooms', 'F&B', 'Spa', 'Activities')        THEN m.usali_dept
    WHEN m.usali_dept = 'Mekong Cruise'                                THEN 'Mekong Cruise'
    WHEN m.usali_dept IN ('Other Operated Departments','Other Operated','Retail','Transport') THEN 'Other Operated'
    WHEN m.usali_dept IN ('A&G','Sales & Marketing','POM','Utilities','Mgmt Fees','Undistributed') THEN ''
    WHEN m.usali_dept IN ('Non-Operating','Below GOP','Tax','Depreciation','Interest','FX')        THEN ''
    ELSE COALESCE(m.usali_dept, '')
  END AS usali_department,
  l.amount_usd
FROM plan.lines l
JOIN plan.scenarios s ON s.scenario_id = l.scenario_id
LEFT JOIN gl.accounts a ON a.account_id = l.account_code
LEFT JOIN plan.account_map m ON m.account_code = l.account_code
WHERE s.name = 'Budget 2026 v1'
  AND a.usali_subcategory IS NOT NULL
  AND (m.usali_dept IS NULL OR m.usali_dept <> 'Balance Sheet');

GRANT SELECT ON gl.v_budget_lines TO anon, service_role;