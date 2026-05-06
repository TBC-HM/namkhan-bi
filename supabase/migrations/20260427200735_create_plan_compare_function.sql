-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427200735
-- Name:    create_plan_compare_function
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- ─────────────────────────────────────────────────────────────────
-- plan.compare(year, granularity)
-- Returns Fairmas-style table: USALI dept × month × Budget × Actual × STLY × Variance
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION plan.compare(
  p_year int,
  p_scenario_name text DEFAULT 'Budget 2026 v1',
  p_granularity text DEFAULT 'month'  -- 'month' | 'quarter' | 'year' | 'dept'
)
RETURNS TABLE (
  period_label   text,
  usali_dept     text,
  usali_subdept  text,
  account_type   text,
  budget_usd     numeric,
  actual_usd     numeric,
  stly_usd       numeric,
  variance_usd   numeric,
  variance_pct   numeric,
  vs_stly_usd    numeric,
  vs_stly_pct    numeric
)
LANGUAGE sql
STABLE
AS $$
WITH 
  scenario AS (
    SELECT scenario_id 
    FROM plan.scenarios 
    WHERE name = p_scenario_name AND fiscal_year = p_year
    LIMIT 1
  ),
  
  -- Budget by month × USALI dept
  budget AS (
    SELECT 
      pl.period_year,
      pl.period_month,
      m.usali_dept,
      m.usali_subdept,
      m.usali_account_type AS account_type,
      SUM(pl.amount_usd) AS amount_usd
    FROM plan.lines pl
    JOIN plan.account_map m ON m.account_code = pl.account_code
    WHERE pl.scenario_id = (SELECT scenario_id FROM scenario)
      AND pl.period_year = p_year
    GROUP BY 1, 2, 3, 4, 5
  ),
  
  -- Actual from gl.pnl_snapshot (current year)
  actual AS (
    SELECT 
      ps.period_year,
      ps.period_month,
      m.usali_dept,
      m.usali_subdept,
      m.usali_account_type AS account_type,
      SUM(ps.amount_usd) AS amount_usd
    FROM gl.pnl_snapshot ps
    JOIN plan.account_map m ON m.account_code = ps.account_code
    WHERE ps.period_year = p_year
    GROUP BY 1, 2, 3, 4, 5
  ),
  
  -- STLY = Same Time Last Year from gl.pnl_snapshot
  stly AS (
    SELECT 
      ps.period_month,
      m.usali_dept,
      m.usali_subdept,
      m.usali_account_type AS account_type,
      SUM(ps.amount_usd) AS amount_usd
    FROM gl.pnl_snapshot ps
    JOIN plan.account_map m ON m.account_code = ps.account_code
    WHERE ps.period_year = p_year - 1
    GROUP BY 1, 2, 3, 4
  ),
  
  -- All combinations
  base AS (
    SELECT period_year, period_month, usali_dept, usali_subdept, account_type FROM budget
    UNION
    SELECT period_year, period_month, usali_dept, usali_subdept, account_type FROM actual
    UNION
    SELECT p_year AS period_year, period_month, usali_dept, usali_subdept, account_type FROM stly
  )

SELECT 
  CASE p_granularity
    WHEN 'month' THEN to_char(make_date(b.period_year, b.period_month, 1), 'YYYY-MM')
    WHEN 'quarter' THEN b.period_year::text || '-Q' || ((b.period_month - 1) / 3 + 1)::text
    WHEN 'year' THEN b.period_year::text
    WHEN 'dept' THEN b.usali_dept || COALESCE(' / ' || b.usali_subdept, '')
    ELSE to_char(make_date(b.period_year, b.period_month, 1), 'YYYY-MM')
  END AS period_label,
  b.usali_dept,
  b.usali_subdept,
  b.account_type,
  ROUND(COALESCE(SUM(bg.amount_usd), 0), 2) AS budget_usd,
  ROUND(COALESCE(SUM(ac.amount_usd), 0), 2) AS actual_usd,
  ROUND(COALESCE(SUM(sl.amount_usd), 0), 2) AS stly_usd,
  ROUND(COALESCE(SUM(ac.amount_usd), 0) - COALESCE(SUM(bg.amount_usd), 0), 2) AS variance_usd,
  CASE 
    WHEN COALESCE(SUM(bg.amount_usd), 0) = 0 THEN NULL
    ELSE ROUND((COALESCE(SUM(ac.amount_usd), 0) - COALESCE(SUM(bg.amount_usd), 0)) / SUM(bg.amount_usd) * 100, 2)
  END AS variance_pct,
  ROUND(COALESCE(SUM(ac.amount_usd), 0) - COALESCE(SUM(sl.amount_usd), 0), 2) AS vs_stly_usd,
  CASE 
    WHEN COALESCE(SUM(sl.amount_usd), 0) = 0 THEN NULL
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
$$;

-- ─────────────────────────────────────────────────────────────────
-- plan.snapshot(scenario_id) - 13-row P&L summary 
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION plan.snapshot(
  p_year int,
  p_scenario_name text DEFAULT 'Budget 2026 v1'
)
RETURNS TABLE (
  line_no    int,
  pl_section text,
  budget_usd numeric,
  actual_usd numeric,
  stly_usd   numeric,
  var_pct    numeric,
  vs_stly_pct numeric
)
LANGUAGE sql
STABLE
AS $$
WITH cmp AS (
  SELECT * FROM plan.compare(p_year, p_scenario_name, 'year')
),
agg AS (
  SELECT
    1 AS line_no, 'Rooms Revenue' AS pl_section,
    SUM(budget_usd) FILTER (WHERE usali_dept='Rooms' AND account_type='Revenue') AS budget_usd,
    SUM(actual_usd) FILTER (WHERE usali_dept='Rooms' AND account_type='Revenue') AS actual_usd,
    SUM(stly_usd)   FILTER (WHERE usali_dept='Rooms' AND account_type='Revenue') AS stly_usd
  FROM cmp
  UNION ALL
  SELECT
    2, 'F&B Revenue',
    SUM(budget_usd) FILTER (WHERE usali_dept='F&B' AND account_type='Revenue'),
    SUM(actual_usd) FILTER (WHERE usali_dept='F&B' AND account_type='Revenue'),
    SUM(stly_usd)   FILTER (WHERE usali_dept='F&B' AND account_type='Revenue')
  FROM cmp
  UNION ALL
  SELECT
    3, 'Other Operated Revenue',
    SUM(budget_usd) FILTER (WHERE usali_dept='Other Operated' AND account_type='Revenue'),
    SUM(actual_usd) FILTER (WHERE usali_dept='Other Operated' AND account_type='Revenue'),
    SUM(stly_usd)   FILTER (WHERE usali_dept='Other Operated' AND account_type='Revenue')
  FROM cmp
  UNION ALL
  SELECT
    4, 'TOTAL REVENUE',
    SUM(budget_usd) FILTER (WHERE account_type='Revenue'),
    SUM(actual_usd) FILTER (WHERE account_type='Revenue'),
    SUM(stly_usd)   FILTER (WHERE account_type='Revenue')
  FROM cmp
  UNION ALL
  SELECT
    5, 'COGS',
    SUM(budget_usd) FILTER (WHERE account_type='COGS'),
    SUM(actual_usd) FILTER (WHERE account_type='COGS'),
    SUM(stly_usd)   FILTER (WHERE account_type='COGS')
  FROM cmp
  UNION ALL
  SELECT
    6, 'GROSS PROFIT',
    SUM(budget_usd) FILTER (WHERE account_type='Revenue') - SUM(budget_usd) FILTER (WHERE account_type='COGS'),
    SUM(actual_usd) FILTER (WHERE account_type='Revenue') - SUM(actual_usd) FILTER (WHERE account_type='COGS'),
    SUM(stly_usd)   FILTER (WHERE account_type='Revenue') - SUM(stly_usd)   FILTER (WHERE account_type='COGS')
  FROM cmp
  UNION ALL
  SELECT
    7, 'Wages & Benefits',
    SUM(budget_usd) FILTER (WHERE account_type='Wages'),
    SUM(actual_usd) FILTER (WHERE account_type='Wages'),
    SUM(stly_usd)   FILTER (WHERE account_type='Wages')
  FROM cmp
  UNION ALL
  SELECT
    8, 'Other Operating Expenses',
    SUM(budget_usd) FILTER (WHERE account_type='Other Expense'),
    SUM(actual_usd) FILTER (WHERE account_type='Other Expense'),
    SUM(stly_usd)   FILTER (WHERE account_type='Other Expense')
  FROM cmp
  UNION ALL
  SELECT
    9, 'TOTAL OPEX',
    SUM(budget_usd) FILTER (WHERE account_type IN ('Wages','Other Expense')),
    SUM(actual_usd) FILTER (WHERE account_type IN ('Wages','Other Expense')),
    SUM(stly_usd)   FILTER (WHERE account_type IN ('Wages','Other Expense'))
  FROM cmp
  UNION ALL
  SELECT
    10, 'GOP (Gross Operating Profit)',
    SUM(budget_usd) FILTER (WHERE account_type='Revenue') 
      - SUM(budget_usd) FILTER (WHERE account_type IN ('COGS','Wages','Other Expense')),
    SUM(actual_usd) FILTER (WHERE account_type='Revenue') 
      - SUM(actual_usd) FILTER (WHERE account_type IN ('COGS','Wages','Other Expense')),
    SUM(stly_usd) FILTER (WHERE account_type='Revenue') 
      - SUM(stly_usd) FILTER (WHERE account_type IN ('COGS','Wages','Other Expense'))
  FROM cmp
  UNION ALL
  SELECT
    11, 'Fixed Charges',
    SUM(budget_usd) FILTER (WHERE account_type='Fixed Charge'),
    SUM(actual_usd) FILTER (WHERE account_type='Fixed Charge'),
    SUM(stly_usd)   FILTER (WHERE account_type='Fixed Charge')
  FROM cmp
  UNION ALL
  SELECT
    12, 'Income Tax',
    SUM(budget_usd) FILTER (WHERE account_type='Tax'),
    SUM(actual_usd) FILTER (WHERE account_type='Tax'),
    SUM(stly_usd)   FILTER (WHERE account_type='Tax')
  FROM cmp
  UNION ALL
  SELECT
    13, 'NET INCOME',
    SUM(budget_usd) FILTER (WHERE account_type='Revenue') 
      - SUM(budget_usd) FILTER (WHERE account_type IN ('COGS','Wages','Other Expense','Fixed Charge','Tax')),
    SUM(actual_usd) FILTER (WHERE account_type='Revenue') 
      - SUM(actual_usd) FILTER (WHERE account_type IN ('COGS','Wages','Other Expense','Fixed Charge','Tax')),
    SUM(stly_usd) FILTER (WHERE account_type='Revenue') 
      - SUM(stly_usd) FILTER (WHERE account_type IN ('COGS','Wages','Other Expense','Fixed Charge','Tax'))
  FROM cmp
)
SELECT
  line_no,
  pl_section,
  ROUND(COALESCE(budget_usd, 0), 2) AS budget_usd,
  ROUND(COALESCE(actual_usd, 0), 2) AS actual_usd,
  ROUND(COALESCE(stly_usd, 0), 2) AS stly_usd,
  CASE WHEN COALESCE(budget_usd, 0) = 0 THEN NULL
       ELSE ROUND((COALESCE(actual_usd, 0) - COALESCE(budget_usd, 0)) / budget_usd * 100, 2) END AS var_pct,
  CASE WHEN COALESCE(stly_usd, 0) = 0 THEN NULL
       ELSE ROUND((COALESCE(actual_usd, 0) - COALESCE(stly_usd, 0)) / stly_usd * 100, 2) END AS vs_stly_pct
FROM agg
ORDER BY line_no;
$$;