-- db/proposed/budget-2026-v2/02_unhardcode_budget_scenario.sql
-- STATUS: NOT APPLIED — blocked by the permission classifier 2026-09-06.
--
-- WHY THIS IS NEEDED
-- finance.v_gl_budget_lines hardcodes  WHERE s.name = 'Budget 2026 v1'.
-- 'Budget 2026 v2' is loaded (912 lines, net 1,021,413) but is INVISIBLE until this
-- runs — /finance/budget, /finance/pnl and the finance dashboard all still render v1
-- and its $1.38M. Applying this switches them to v2.
--
-- IT ALSO FIXES A LATENT TENANCY BUG
-- The view never filtered on s.property_id. Today all four scenarios belong to
-- Namkhan so nothing leaks, but the day Donna gets a scenario named 'Budget 2026 v1'
-- its lines would sum into Namkhan's budget. Selecting per property closes that.
--
-- SAFETY
-- Columns are tail-appended (account_code, account_name, property_id), so
-- CREATE OR REPLACE is legal and the dependent views keep working unchanged:
--   finance.v_gl_budget_vs_actual  ->  public.v_finance_budget_vs_actual
-- Rollback is the same statement with the WHERE clause restored to
--   s.name = 'Budget 2026 v1'
-- and the three appended columns removed.
--
-- The appended account columns are what the drill-down UI needs: expanding a USALI
-- subcategory row to the accounts underneath it.

CREATE OR REPLACE VIEW finance.v_gl_budget_lines AS
SELECT (l.period_year::text || '-'::text) || lpad(l.period_month::text, 2, '0'::text) AS period_yyyymm,
       a.usali_subcategory,
       CASE
         WHEN a.usali_subcategory = ANY (ARRAY['A&G'::text, 'Sales & Marketing'::text, 'POM'::text,
              'Utilities'::text, 'Mgmt Fees'::text, 'Depreciation'::text, 'Interest'::text,
              'Income Tax'::text, 'FX Gain/Loss'::text, 'Non-Operating'::text]) THEN 'Undistributed'::text
         ELSE gl.normalize_plan_dept(m.usali_dept)
       END AS usali_department,
       round(l.amount_usd / (1::numeric + COALESCE(v.vat_rate_pct, 0::numeric) / 100.0), 4)::numeric(18,4) AS amount_usd,
       l.account_code,
       a.account_name,
       s.property_id
FROM plan.lines l
  JOIN plan.scenarios s ON s.scenario_id = l.scenario_id
  LEFT JOIN finance.gl_accounts a ON a.account_id = l.account_code
  LEFT JOIN plan.account_map m ON m.account_code = l.account_code
  LEFT JOIN finance.gl_vat_rates v ON v.usali_subcategory = a.usali_subcategory
       AND (v.applies_to = ANY (ARRAY['budget'::text, 'both'::text]))
WHERE s.scenario_type = 'budget'
  AND s.status = 'approved'
  AND s.scenario_id = (
        SELECT s2.scenario_id
        FROM plan.scenarios s2
        WHERE s2.property_id   = s.property_id
          AND s2.fiscal_year   = s.fiscal_year
          AND s2.scenario_type = 'budget'
          AND s2.status        = 'approved'
        ORDER BY s2.created_at DESC, s2.scenario_id DESC
        LIMIT 1)
  AND a.usali_subcategory IS NOT NULL
  AND COALESCE(m.usali_dept, ''::text) <> 'Balance Sheet'::text;

REVOKE ALL ON finance.v_gl_budget_lines FROM anon;
GRANT SELECT ON finance.v_gl_budget_lines TO authenticated, service_role;
