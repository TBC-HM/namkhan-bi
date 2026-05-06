-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503170210
-- Name:    budget_view_fix_signs_and_depts
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

DROP VIEW IF EXISTS gl.v_budget_vs_actual CASCADE;
DROP VIEW IF EXISTS gl.v_budget_lines CASCADE;

-- Map plan.account_map.usali_dept → gl.classes.usali_department vocabulary used by mv_usali_pl_monthly
CREATE OR REPLACE FUNCTION gl.normalize_plan_dept(p_dept text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_dept IN ('Rooms','F&B','Spa','Activities','Mekong Cruise') THEN p_dept
    WHEN p_dept IN ('Other Operated','Other Operated Departments','Retail','Transport') THEN 'Other Operated'
    WHEN p_dept IS NULL OR p_dept = '' THEN 'Undistributed'
    ELSE 'Undistributed'  -- A&G, S&M, POM, Utilities, Mgmt Fees, Property Maintenance, Non-Operating, Tax, Depreciation, Interest, FX
  END;
$$;
GRANT EXECUTE ON FUNCTION gl.normalize_plan_dept(text) TO anon, service_role;

CREATE VIEW gl.v_budget_lines AS
SELECT
  (l.period_year::text || '-' || lpad(l.period_month::text, 2, '0')) AS period_yyyymm,
  a.usali_subcategory,
  gl.normalize_plan_dept(m.usali_dept) AS usali_department,
  l.amount_usd
FROM plan.lines l
JOIN plan.scenarios s ON s.scenario_id = l.scenario_id
LEFT JOIN gl.accounts a ON a.account_id = l.account_code
LEFT JOIN plan.account_map m ON m.account_code = l.account_code
WHERE s.name = 'Budget 2026 v1'
  AND a.usali_subcategory IS NOT NULL
  AND COALESCE(m.usali_dept, '') <> 'Balance Sheet';

GRANT SELECT ON gl.v_budget_lines TO anon, service_role;

-- Budget vs Actual view, with revenue sign aligned (positive on both sides)
CREATE VIEW gl.v_budget_vs_actual AS
WITH budget AS (
  SELECT period_yyyymm, usali_subcategory, usali_department,
         sum(amount_usd) AS budget_usd
  FROM gl.v_budget_lines
  GROUP BY period_yyyymm, usali_subcategory, usali_department
),
actuals AS (
  SELECT period_yyyymm,
         usali_subcategory,
         COALESCE(usali_department, 'Undistributed') AS usali_department,
         -- Revenue is stored as negative (credit) in gl_entries — flip sign so
         -- both sides use the convention "Revenue ≥ 0".
         CASE WHEN usali_subcategory = 'Revenue' THEN -sum(amount_usd) ELSE sum(amount_usd) END AS actual_usd
  FROM gl.mv_usali_pl_monthly
  GROUP BY period_yyyymm, usali_subcategory, COALESCE(usali_department, 'Undistributed')
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