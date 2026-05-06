-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427214951
-- Name:    create_qb_import_helpers
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- ============================================================
-- QB MONTHLY IMPORT HELPERS
-- Used when PBS uploads new QB exports each month
-- ============================================================

-- Validation function: check for orphan accounts before importing
CREATE OR REPLACE FUNCTION gl.validate_qb_payload(p_payload jsonb)
RETURNS TABLE(check_name text, status text, count int, details jsonb)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  -- Check 1: rows with section_account not in chart
  RETURN QUERY
  WITH unknown_section AS (
    SELECT DISTINCT j->>'s' AS code
    FROM jsonb_array_elements(p_payload) j
    LEFT JOIN gl.accounts a ON a.account_code = j->>'s'
    WHERE a.account_code IS NULL AND (j->>'s') IS NOT NULL
  )
  SELECT 'unknown_section_accounts'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END::text,
    COUNT(*)::int,
    COALESCE(jsonb_agg(code), '[]'::jsonb)
  FROM unknown_section;

  -- Check 2: rows with line_account not in chart
  RETURN QUERY
  WITH unknown_line AS (
    SELECT DISTINCT j->>'l' AS code
    FROM jsonb_array_elements(p_payload) j
    LEFT JOIN gl.accounts a ON a.account_code = j->>'l'
    WHERE a.account_code IS NULL AND (j->>'l') IS NOT NULL AND (j->>'l') <> ''
  )
  SELECT 'unknown_line_accounts'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END::text,
    COUNT(*)::int,
    COALESCE(jsonb_agg(code), '[]'::jsonb)
  FROM unknown_line;

  -- Check 3: rows with NULL or invalid date
  RETURN QUERY
  SELECT 'invalid_dates'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END::text,
    COUNT(*)::int,
    '[]'::jsonb
  FROM jsonb_array_elements(p_payload) j
  WHERE (j->>'d') IS NULL OR (j->>'d')::date IS NULL;

  -- Check 4: rows with NULL or invalid amount
  RETURN QUERY
  SELECT 'invalid_amounts'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END::text,
    COUNT(*)::int,
    '[]'::jsonb
  FROM jsonb_array_elements(p_payload) j
  WHERE (j->>'a') IS NULL;

  -- Check 5: total rows
  RETURN QUERY
  SELECT 'total_rows'::text, 'INFO'::text, jsonb_array_length(p_payload)::int, '[]'::jsonb;
END;
$$;

-- Wrapper: import P&L with summary
CREATE OR REPLACE FUNCTION gl.import_pnl_with_summary(
  p_payload jsonb,
  p_source_file text,
  p_period_year int,
  p_period_month int,
  p_is_partial boolean DEFAULT false,
  p_partial_day int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_inserted int;
  v_revenue numeric;
  v_expenses numeric;
  v_net numeric;
  v_period text;
BEGIN
  v_period := p_period_year || '-' || lpad(p_period_month::text, 2, '0');
  
  -- Delete prior version of this period+source
  DELETE FROM gl.pnl_snapshot 
  WHERE period_year = p_period_year 
    AND period_month = p_period_month 
    AND source_file = p_source_file;
  
  -- Import
  v_inserted := gl.import_pnl_snapshot(p_payload, p_source_file);
  
  -- Compute summary
  SELECT 
    COALESCE(SUM(CASE WHEN a.account_class = 'Revenue' THEN ps.amount_usd ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN a.account_class = 'Expense' THEN ps.amount_usd ELSE 0 END), 0)
  INTO v_revenue, v_expenses
  FROM gl.pnl_snapshot ps
  JOIN gl.accounts a ON a.account_code = ps.account_code
  WHERE ps.period_year = p_period_year 
    AND ps.period_month = p_period_month
    AND ps.source_file = p_source_file;
  
  v_net := v_revenue - v_expenses;
  
  RETURN jsonb_build_object(
    'period', v_period,
    'rows_imported', v_inserted,
    'is_partial', p_is_partial,
    'partial_day', p_partial_day,
    'revenue_usd', ROUND(v_revenue, 2),
    'expenses_usd', ROUND(v_expenses, 2),
    'net_income_usd', ROUND(v_net, 2)
  );
END;
$$;

-- Replace 2026-04 partial with stale flag once full month available
CREATE OR REPLACE FUNCTION gl.mark_period_partial(
  p_year int, p_month int, p_is_partial boolean, p_partial_day int DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE gl.pnl_snapshot
  SET is_partial_month = p_is_partial,
      partial_month_end_day = p_partial_day
  WHERE period_year = p_year AND period_month = p_month;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;