-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503203205
-- Name:    fix_v_budget_lines_force_undistributed
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Force usali_department='Undistributed' for undistributed subcats (regardless of legacy plan.account_map dept tag).
-- Root cause: plan.account_map tagged OTA commissions (subcat=Sales & Marketing) with dept='Rooms', and POM rows with dept='Other Operated'.
-- Page keys these as `${subcat}||` (empty dept) so misclassified rows were excluded → undercounted budget for S&M ($10.1k → $4.2k) and POM ($4.0k → $3.0k).
CREATE OR REPLACE VIEW gl.v_budget_lines AS
SELECT
  (l.period_year::text || '-') || lpad(l.period_month::text, 2, '0') AS period_yyyymm,
  a.usali_subcategory,
  CASE
    WHEN a.usali_subcategory IN ('A&G','Sales & Marketing','POM','Utilities','Mgmt Fees',
                                 'Depreciation','Interest','Income Tax','FX Gain/Loss','Non-Operating')
      THEN 'Undistributed'
    ELSE gl.normalize_plan_dept(m.usali_dept)
  END AS usali_department,
  l.amount_usd
FROM plan.lines l
JOIN plan.scenarios s ON s.scenario_id = l.scenario_id
LEFT JOIN gl.accounts a ON a.account_id = l.account_code
LEFT JOIN plan.account_map m ON m.account_code = l.account_code
WHERE s.name = 'Budget 2026 v1'
  AND a.usali_subcategory IS NOT NULL
  AND COALESCE(m.usali_dept,'') <> 'Balance Sheet';

COMMENT ON VIEW gl.v_budget_lines IS
'Budget 2026 v1 lines exposed for /finance/pnl. Patched 2026-05-03 to force usali_department=Undistributed for above-the-line subcats (S&M, POM, A&G, Utilities, Mgmt Fees, Depreciation, Interest, Income Tax, FX Gain/Loss, Non-Operating). Fixes budget under-count caused by plan.account_map mis-tagging OTA commissions as Rooms and vehicle maintenance as Other Operated.';
