-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427202131
-- Name:    create_plan_compare_scenarios
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Compare two scenarios side-by-side
CREATE OR REPLACE FUNCTION plan.compare_scenarios(
  p_year int,
  p_scenario_a text,
  p_scenario_b text
)
RETURNS TABLE (
  pl_section text,
  scenario_a_usd numeric,
  scenario_b_usd numeric,
  delta_usd numeric,
  delta_pct numeric
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_a_id uuid;
  v_b_id uuid;
BEGIN
  SELECT scenario_id INTO v_a_id FROM plan.scenarios 
  WHERE name = p_scenario_a AND fiscal_year = p_year LIMIT 1;
  SELECT scenario_id INTO v_b_id FROM plan.scenarios 
  WHERE name = p_scenario_b AND fiscal_year = p_year LIMIT 1;

  RETURN QUERY
  WITH agg AS (
    SELECT 
      m.usali_dept, m.usali_account_type,
      SUM(CASE WHEN pl.scenario_id = v_a_id THEN pl.amount_usd ELSE 0 END) AS a_usd,
      SUM(CASE WHEN pl.scenario_id = v_b_id THEN pl.amount_usd ELSE 0 END) AS b_usd
    FROM plan.lines pl
    JOIN plan.account_map m ON m.account_code = pl.account_code
    WHERE pl.scenario_id IN (v_a_id, v_b_id)
      AND pl.period_year = p_year
    GROUP BY 1, 2
  ),
  totals AS (
    SELECT 1 AS line_no, 'Rooms Revenue' AS sec, 
      SUM(a_usd) FILTER (WHERE usali_dept='Rooms' AND usali_account_type='Revenue') AS a,
      SUM(b_usd) FILTER (WHERE usali_dept='Rooms' AND usali_account_type='Revenue') AS b
    FROM agg
    UNION ALL
    SELECT 2, 'F&B Revenue',
      SUM(a_usd) FILTER (WHERE usali_dept='F&B' AND usali_account_type='Revenue'),
      SUM(b_usd) FILTER (WHERE usali_dept='F&B' AND usali_account_type='Revenue')
    FROM agg
    UNION ALL
    SELECT 3, 'Other Operated Revenue',
      SUM(a_usd) FILTER (WHERE usali_dept='Other Operated' AND usali_account_type='Revenue'),
      SUM(b_usd) FILTER (WHERE usali_dept='Other Operated' AND usali_account_type='Revenue')
    FROM agg
    UNION ALL
    SELECT 4, 'TOTAL REVENUE',
      SUM(a_usd) FILTER (WHERE usali_account_type='Revenue'),
      SUM(b_usd) FILTER (WHERE usali_account_type='Revenue')
    FROM agg
    UNION ALL
    SELECT 5, 'COGS',
      SUM(a_usd) FILTER (WHERE usali_account_type='COGS'),
      SUM(b_usd) FILTER (WHERE usali_account_type='COGS')
    FROM agg
    UNION ALL
    SELECT 6, 'Wages & Benefits',
      SUM(a_usd) FILTER (WHERE usali_account_type='Wages'),
      SUM(b_usd) FILTER (WHERE usali_account_type='Wages')
    FROM agg
    UNION ALL
    SELECT 7, 'Other Opex',
      SUM(a_usd) FILTER (WHERE usali_account_type='Other Expense'),
      SUM(b_usd) FILTER (WHERE usali_account_type='Other Expense')
    FROM agg
    UNION ALL
    SELECT 8, 'GOP',
      SUM(a_usd) FILTER (WHERE usali_account_type='Revenue') 
        - SUM(a_usd) FILTER (WHERE usali_account_type IN ('COGS','Wages','Other Expense')),
      SUM(b_usd) FILTER (WHERE usali_account_type='Revenue') 
        - SUM(b_usd) FILTER (WHERE usali_account_type IN ('COGS','Wages','Other Expense'))
    FROM agg
    UNION ALL
    SELECT 9, 'Fixed Charges',
      SUM(a_usd) FILTER (WHERE usali_account_type='Fixed Charge'),
      SUM(b_usd) FILTER (WHERE usali_account_type='Fixed Charge')
    FROM agg
    UNION ALL
    SELECT 10, 'NET INCOME',
      SUM(a_usd) FILTER (WHERE usali_account_type='Revenue') 
        - SUM(a_usd) FILTER (WHERE usali_account_type IN ('COGS','Wages','Other Expense','Fixed Charge','Tax')),
      SUM(b_usd) FILTER (WHERE usali_account_type='Revenue') 
        - SUM(b_usd) FILTER (WHERE usali_account_type IN ('COGS','Wages','Other Expense','Fixed Charge','Tax'))
    FROM agg
  )
  SELECT 
    sec,
    ROUND(COALESCE(a, 0), 2),
    ROUND(COALESCE(b, 0), 2),
    ROUND(COALESCE(b, 0) - COALESCE(a, 0), 2),
    CASE WHEN COALESCE(a, 0) = 0 THEN NULL
         ELSE ROUND((COALESCE(b, 0) - COALESCE(a, 0)) / a * 100, 2) END
  FROM totals
  ORDER BY line_no;
END;
$$;