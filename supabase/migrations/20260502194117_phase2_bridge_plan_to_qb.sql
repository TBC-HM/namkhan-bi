-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502194117
-- Name:    phase2_bridge_plan_to_qb
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Repoint plan.* FKs from gl.accounts_legacy to qb.accounts
ALTER TABLE plan.account_map DROP CONSTRAINT IF EXISTS account_map_account_code_fkey;
ALTER TABLE plan.lines       DROP CONSTRAINT IF EXISTS lines_account_code_fkey;

ALTER TABLE plan.account_map
  ADD CONSTRAINT account_map_account_code_fkey
  FOREIGN KEY (account_code) REFERENCES qb.accounts(account_id);

ALTER TABLE plan.lines
  ADD CONSTRAINT lines_account_code_fkey
  FOREIGN KEY (account_code) REFERENCES qb.accounts(account_id);

-- Rewrite plan.compare() to read qb.pl_monthly (canonical actuals) + qb.accounts
CREATE OR REPLACE FUNCTION plan.compare(
  p_year integer,
  p_scenario_name text DEFAULT 'Budget 2026 v1',
  p_granularity text DEFAULT 'month'
) RETURNS TABLE(
  period_label text, usali_dept text, usali_subdept text, account_type text,
  budget_usd numeric, actual_usd numeric, stly_usd numeric,
  variance_usd numeric, variance_pct numeric,
  vs_stly_usd numeric, vs_stly_pct numeric
) LANGUAGE sql STABLE AS $function$
WITH
  scenario AS (
    SELECT scenario_id FROM plan.scenarios
     WHERE name = p_scenario_name AND fiscal_year = p_year LIMIT 1
  ),

  -- Budget by month × USALI dept (unchanged shape — still reads plan.lines + plan.account_map)
  budget AS (
    SELECT
      pl.period_year, pl.period_month,
      m.usali_dept, m.usali_subdept, m.usali_account_type AS account_type,
      SUM(pl.amount_usd) AS amount_usd
    FROM plan.lines pl
    JOIN plan.account_map m ON m.account_code = pl.account_code
    WHERE pl.scenario_id = (SELECT scenario_id FROM scenario)
      AND pl.period_year = p_year
    GROUP BY 1,2,3,4,5
  ),

  -- Actual: from qb.pl_monthly (Phase 2 canonical P&L). period_yyyymm text → year/month split.
  actual AS (
    SELECT
      p_year AS period_year,
      (split_part(pm.period_yyyymm, '-', 2))::int AS period_month,
      m.usali_dept, m.usali_subdept, m.usali_account_type AS account_type,
      SUM(pm.amount_usd) AS amount_usd
    FROM qb.pl_monthly pm
    JOIN plan.account_map m ON m.account_code = pm.account_id
    WHERE pm.period_yyyymm BETWEEN format('%s-01', p_year) AND format('%s-12', p_year)
    GROUP BY 2,3,4,5
  ),

  -- STLY: same months, prior year, again from qb.pl_monthly
  stly AS (
    SELECT
      (split_part(pm.period_yyyymm, '-', 2))::int AS period_month,
      m.usali_dept, m.usali_subdept, m.usali_account_type AS account_type,
      SUM(pm.amount_usd) AS amount_usd
    FROM qb.pl_monthly pm
    JOIN plan.account_map m ON m.account_code = pm.account_id
    WHERE pm.period_yyyymm BETWEEN format('%s-01', p_year - 1) AND format('%s-12', p_year - 1)
    GROUP BY 1,2,3,4
  ),

  base AS (
    SELECT period_year, period_month, usali_dept, usali_subdept, account_type FROM budget
    UNION
    SELECT period_year, period_month, usali_dept, usali_subdept, account_type FROM actual
    UNION
    SELECT p_year AS period_year, period_month, usali_dept, usali_subdept, account_type FROM stly
  )
SELECT
  CASE p_granularity
    WHEN 'month'   THEN to_char(make_date(b.period_year, b.period_month, 1), 'YYYY-MM')
    WHEN 'quarter' THEN b.period_year::text || '-Q' || ((b.period_month - 1) / 3 + 1)::text
    WHEN 'year'    THEN b.period_year::text
    WHEN 'dept'    THEN b.usali_dept || COALESCE(' / ' || b.usali_subdept, '')
    ELSE to_char(make_date(b.period_year, b.period_month, 1), 'YYYY-MM')
  END AS period_label,
  b.usali_dept, b.usali_subdept, b.account_type,
  ROUND(COALESCE(SUM(bg.amount_usd), 0), 2) AS budget_usd,
  ROUND(COALESCE(SUM(ac.amount_usd), 0), 2) AS actual_usd,
  ROUND(COALESCE(SUM(sl.amount_usd), 0), 2) AS stly_usd,
  ROUND(COALESCE(SUM(ac.amount_usd), 0) - COALESCE(SUM(bg.amount_usd), 0), 2) AS variance_usd,
  CASE WHEN COALESCE(SUM(bg.amount_usd), 0) = 0 THEN NULL
       ELSE ROUND((COALESCE(SUM(ac.amount_usd), 0) - COALESCE(SUM(bg.amount_usd), 0)) / SUM(bg.amount_usd) * 100, 2)
  END AS variance_pct,
  ROUND(COALESCE(SUM(ac.amount_usd), 0) - COALESCE(SUM(sl.amount_usd), 0), 2) AS vs_stly_usd,
  CASE WHEN COALESCE(SUM(sl.amount_usd), 0) = 0 THEN NULL
       ELSE ROUND((COALESCE(SUM(ac.amount_usd), 0) - COALESCE(SUM(sl.amount_usd), 0)) / SUM(sl.amount_usd) * 100, 2)
  END AS vs_stly_pct
FROM base b
LEFT JOIN budget bg
  ON bg.period_year = b.period_year AND bg.period_month = b.period_month
 AND bg.usali_dept = b.usali_dept
 AND COALESCE(bg.usali_subdept,'-') = COALESCE(b.usali_subdept,'-')
 AND bg.account_type = b.account_type
LEFT JOIN actual ac
  ON ac.period_year = b.period_year AND ac.period_month = b.period_month
 AND ac.usali_dept = b.usali_dept
 AND COALESCE(ac.usali_subdept,'-') = COALESCE(b.usali_subdept,'-')
 AND ac.account_type = b.account_type
LEFT JOIN stly sl
  ON sl.period_month = b.period_month
 AND sl.usali_dept = b.usali_dept
 AND COALESCE(sl.usali_subdept,'-') = COALESCE(b.usali_subdept,'-')
 AND sl.account_type = b.account_type
GROUP BY 1, b.usali_dept, b.usali_subdept, b.account_type
ORDER BY period_label, b.usali_dept, b.usali_subdept;
$function$;

COMMENT ON FUNCTION plan.compare IS
  'Budget vs Actual vs STLY variance comparison. Rewritten 2026-05-02 to read qb.pl_monthly + qb.accounts (Phase 2). Original referenced gl.pnl_snapshot which was archived.';