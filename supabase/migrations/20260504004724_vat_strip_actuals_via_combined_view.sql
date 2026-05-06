-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504004724
-- Name:    vat_strip_actuals_via_combined_view
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Apply gl.vat_rates to actuals (where applies_to IN 'actual','both').
-- Default seed has every rate as 'budget' or 'none' so this is a no-op unless
-- the user explicitly switches a subcat to 'actual' or 'both' from /settings/vat-rates.
DROP VIEW IF EXISTS gl.v_scenario_stack CASCADE;
DROP VIEW IF EXISTS gl.v_budget_vs_actual CASCADE;
DROP VIEW IF EXISTS gl.v_actuals_with_manual CASCADE;
DROP VIEW IF EXISTS gl.v_usali_house_summary CASCADE;
DROP VIEW IF EXISTS gl.v_usali_dept_summary CASCADE;
DROP VIEW IF EXISTS gl.v_usali_undistributed CASCADE;
DROP VIEW IF EXISTS gl.v_pl_monthly_combined CASCADE;

CREATE VIEW gl.v_pl_monthly_combined AS
SELECT
  mv.period_yyyymm,
  mv.fiscal_year,
  mv.usali_section,
  mv.usali_department,
  mv.usali_subcategory,
  mv.usali_line_code,
  mv.usali_line_label,
  mv.account_id,
  mv.account_name,
  -- VAT-strip actual when applies_to IN (actual, both); else passthrough
  ROUND(
    mv.amount_usd / (1 + COALESCE(v.vat_rate_pct, 0) / 100.0),
    4
  )::numeric(18,4) AS amount_usd
FROM gl.mv_usali_pl_monthly mv
LEFT JOIN gl.vat_rates v
  ON v.usali_subcategory = mv.usali_subcategory
 AND v.applies_to IN ('actual','both')
UNION ALL
SELECT
  me.period_yyyymm,
  CAST(SUBSTRING(me.period_yyyymm, 1, 4) AS integer) AS fiscal_year,
  CASE
    WHEN me.usali_subcategory IN ('A&G','Sales & Marketing','POM','Utilities','Mgmt Fees',
                                  'Depreciation','Interest','Income Tax','FX Gain/Loss','Non-Operating')
      THEN 'Undistributed'
    ELSE 'Operated'
  END AS usali_section,
  me.usali_department,
  me.usali_subcategory,
  'MANUAL'::text AS usali_line_code,
  COALESCE(me.notes, 'Manual ' || me.kind) AS usali_line_label,
  'MANUAL'::text AS account_id,
  'Manual entry'::text AS account_name,
  -- Manual entries also follow vat_rates if applies_to IN (actual, both)
  ROUND(
    me.amount_usd / (1 + COALESCE(v.vat_rate_pct, 0) / 100.0),
    4
  )::numeric(18,4) AS amount_usd
FROM gl.manual_entries me
LEFT JOIN gl.vat_rates v
  ON v.usali_subcategory = me.usali_subcategory
 AND v.applies_to IN ('actual','both');

COMMENT ON VIEW gl.v_pl_monthly_combined IS
'QB matview actuals + manual_entries combined. VAT-applied when gl.vat_rates.applies_to IN (actual,both). Source for v_usali_*, v_budget_vs_actual, v_scenario_stack.';

-- Recreate downstream views (same definitions as previous migration)
CREATE VIEW gl.v_usali_dept_summary AS
WITH agg AS (
  SELECT period_yyyymm, fiscal_year, usali_department,
    SUM(CASE WHEN usali_subcategory='Revenue' THEN -amount_usd ELSE 0 END) AS revenue,
    SUM(CASE WHEN usali_subcategory='Cost of Sales' THEN amount_usd ELSE 0 END) AS cost_of_sales,
    SUM(CASE WHEN usali_subcategory='Payroll & Related' THEN amount_usd ELSE 0 END) AS payroll,
    SUM(CASE WHEN usali_subcategory='Other Operating Expenses' THEN amount_usd ELSE 0 END) AS other_op_exp
  FROM gl.v_pl_monthly_combined
  WHERE usali_department IS NOT NULL AND usali_department <> 'Undistributed'
  GROUP BY 1,2,3
)
SELECT period_yyyymm, fiscal_year, usali_department, revenue, cost_of_sales, payroll, other_op_exp,
       revenue - cost_of_sales AS gross_profit,
       revenue - cost_of_sales - payroll - other_op_exp AS departmental_profit,
       CASE WHEN revenue <> 0 THEN (revenue - cost_of_sales - payroll - other_op_exp) / revenue ELSE NULL END AS dept_profit_margin
FROM agg;

CREATE VIEW gl.v_usali_house_summary AS
WITH dept AS (
  SELECT period_yyyymm, fiscal_year,
    SUM(revenue) AS total_revenue, SUM(cost_of_sales) AS total_cost_of_sales,
    SUM(payroll) AS total_dept_payroll, SUM(other_op_exp) AS total_dept_other_op_exp,
    SUM(departmental_profit) AS total_dept_profit
  FROM gl.v_usali_dept_summary GROUP BY 1,2
), undist AS (
  SELECT period_yyyymm,
    SUM(CASE WHEN usali_subcategory='A&G' THEN amount_usd ELSE 0 END) AS ag,
    SUM(CASE WHEN usali_subcategory='Sales & Marketing' THEN amount_usd ELSE 0 END) AS sm,
    SUM(CASE WHEN usali_subcategory='POM' THEN amount_usd ELSE 0 END) AS pom,
    SUM(CASE WHEN usali_subcategory='Utilities' THEN amount_usd ELSE 0 END) AS utilities,
    SUM(CASE WHEN usali_subcategory='Mgmt Fees' THEN amount_usd ELSE 0 END) AS mgmt_fees,
    SUM(CASE WHEN usali_subcategory='Payroll & Related' THEN amount_usd ELSE 0 END) AS undist_payroll,
    SUM(CASE WHEN usali_subcategory='Other Operating Expenses' THEN amount_usd ELSE 0 END) AS undist_other
  FROM gl.v_pl_monthly_combined
  WHERE usali_section='Undistributed' OR usali_department='Undistributed'
  GROUP BY 1
), fixed AS (
  SELECT period_yyyymm,
    SUM(CASE WHEN usali_subcategory='Depreciation' THEN amount_usd ELSE 0 END) AS depreciation,
    SUM(CASE WHEN usali_subcategory='Interest' THEN amount_usd ELSE 0 END) AS interest,
    SUM(CASE WHEN usali_subcategory='Income Tax' THEN amount_usd ELSE 0 END) AS income_tax,
    SUM(CASE WHEN usali_subcategory='FX Gain/Loss' THEN amount_usd ELSE 0 END) AS fx_pnl,
    SUM(CASE WHEN usali_subcategory='Non-Operating' THEN amount_usd ELSE 0 END) AS non_op
  FROM gl.v_pl_monthly_combined GROUP BY 1
)
SELECT d.period_yyyymm, d.fiscal_year, d.total_revenue, d.total_cost_of_sales,
  d.total_dept_payroll, d.total_dept_other_op_exp, d.total_dept_profit,
  COALESCE(u.ag,0)+COALESCE(u.undist_payroll,0)+COALESCE(u.undist_other,0) AS ag_total,
  COALESCE(u.sm,0) AS sales_marketing, COALESCE(u.pom,0) AS pom,
  COALESCE(u.utilities,0) AS utilities, COALESCE(u.mgmt_fees,0) AS mgmt_fees,
  d.total_dept_profit
    - COALESCE(u.ag,0) - COALESCE(u.undist_payroll,0) - COALESCE(u.undist_other,0)
    - COALESCE(u.sm,0) - COALESCE(u.pom,0) - COALESCE(u.utilities,0) - COALESCE(u.mgmt_fees,0) AS gop,
  COALESCE(f.depreciation,0) AS depreciation, COALESCE(f.interest,0) AS interest,
  COALESCE(f.income_tax,0) AS income_tax, COALESCE(f.fx_pnl,0) AS fx_pnl,
  COALESCE(f.non_op,0) AS non_operating,
  d.total_dept_profit
    - COALESCE(u.ag,0) - COALESCE(u.undist_payroll,0) - COALESCE(u.undist_other,0)
    - COALESCE(u.sm,0) - COALESCE(u.pom,0) - COALESCE(u.utilities,0) - COALESCE(u.mgmt_fees,0)
    - COALESCE(f.depreciation,0) - COALESCE(f.interest,0) - COALESCE(f.income_tax,0)
    - COALESCE(f.fx_pnl,0) - COALESCE(f.non_op,0) AS net_income
FROM dept d LEFT JOIN undist u USING (period_yyyymm) LEFT JOIN fixed f USING (period_yyyymm);

CREATE VIEW gl.v_usali_undistributed AS
SELECT period_yyyymm, fiscal_year, usali_subcategory, SUM(amount_usd) AS amount_usd
FROM gl.v_pl_monthly_combined
WHERE usali_section='Undistributed' OR usali_department='Undistributed'
GROUP BY 1,2,3;

CREATE VIEW gl.v_actuals_with_manual AS
SELECT period_yyyymm, usali_subcategory,
       COALESCE(usali_department,'Undistributed') AS usali_department,
       CASE WHEN usali_subcategory='Revenue' THEN -SUM(amount_usd) ELSE SUM(amount_usd) END AS amount_usd,
       CASE WHEN account_id='MANUAL' THEN 'manual' ELSE 'qb' END AS source
FROM gl.v_pl_monthly_combined
GROUP BY 1,2,3, CASE WHEN account_id='MANUAL' THEN 'manual' ELSE 'qb' END;

CREATE VIEW gl.v_budget_vs_actual AS
WITH budget AS (
  SELECT period_yyyymm, usali_subcategory, usali_department, SUM(amount_usd) AS budget_usd
  FROM gl.v_budget_lines GROUP BY 1,2,3
), actuals AS (
  SELECT period_yyyymm, usali_subcategory,
         COALESCE(usali_department,'Undistributed') AS usali_department,
         CASE WHEN usali_subcategory='Revenue' THEN -SUM(amount_usd) ELSE SUM(amount_usd) END AS actual_usd
  FROM gl.v_pl_monthly_combined GROUP BY 1,2,3
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
  FROM gl.v_pl_monthly_combined GROUP BY 1,2,3
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

GRANT SELECT ON gl.v_pl_monthly_combined,
                gl.v_usali_dept_summary,
                gl.v_usali_house_summary,
                gl.v_usali_undistributed,
                gl.v_actuals_with_manual,
                gl.v_budget_vs_actual,
                gl.v_scenario_stack
  TO authenticated, anon, service_role;
