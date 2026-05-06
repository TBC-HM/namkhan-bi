-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503155714
-- Name:    gl_budgets_2026_05_03
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE TABLE IF NOT EXISTS gl.budgets (
  period_yyyymm      text NOT NULL,
  usali_subcategory  text NOT NULL,
  usali_department   text NOT NULL DEFAULT '',
  amount_usd         numeric NOT NULL DEFAULT 0,
  uploaded_at        timestamptz NOT NULL DEFAULT now(),
  uploaded_by        text,
  source_file        text,
  PRIMARY KEY (period_yyyymm, usali_subcategory, usali_department)
);

COMMENT ON TABLE gl.budgets IS
  'Owner-provided annual budget. Composite key period × subcategory × dept (empty string when undistributed). Drives /finance/pnl budget columns + 12-month bottom panel.';

CREATE INDEX IF NOT EXISTS idx_budgets_period ON gl.budgets(period_yyyymm);
CREATE INDEX IF NOT EXISTS idx_budgets_subcat ON gl.budgets(usali_subcategory);

GRANT SELECT ON gl.budgets TO anon, service_role;
GRANT INSERT, UPDATE, DELETE ON gl.budgets TO service_role;

CREATE OR REPLACE FUNCTION gl.upsert_budget_rows(
  p_rows        jsonb,
  p_uploaded_by text DEFAULT 'accountant',
  p_source_file text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = gl, public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a JSON array';
  END IF;

  INSERT INTO gl.budgets(period_yyyymm, usali_subcategory, usali_department, amount_usd, uploaded_at, uploaded_by, source_file)
  SELECT
    (r->>'period_yyyymm')::text,
    (r->>'usali_subcategory')::text,
    COALESCE(NULLIF((r->>'usali_department')::text, ''), ''),
    COALESCE((r->>'amount_usd')::numeric, 0),
    now(),
    p_uploaded_by,
    p_source_file
  FROM jsonb_array_elements(p_rows) r
  WHERE r ? 'period_yyyymm' AND r ? 'usali_subcategory'
  ON CONFLICT (period_yyyymm, usali_subcategory, usali_department) DO UPDATE
    SET amount_usd  = EXCLUDED.amount_usd,
        uploaded_at = now(),
        uploaded_by = EXCLUDED.uploaded_by,
        source_file = EXCLUDED.source_file;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION gl.upsert_budget_rows(jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gl.upsert_budget_rows(jsonb, text, text) TO service_role;

CREATE OR REPLACE VIEW gl.v_budget_vs_actual AS
WITH actuals AS (
  SELECT period_yyyymm,
         usali_subcategory,
         COALESCE(usali_department, '') AS usali_department,
         sum(amount_usd) AS actual_usd
  FROM gl.mv_usali_pl_monthly
  GROUP BY period_yyyymm, usali_subcategory, COALESCE(usali_department, '')
),
budgets AS (
  SELECT period_yyyymm, usali_subcategory, usali_department,
         sum(amount_usd) AS budget_usd
  FROM gl.budgets
  GROUP BY period_yyyymm, usali_subcategory, usali_department
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
FROM actuals a FULL OUTER JOIN budgets b
  ON a.period_yyyymm = b.period_yyyymm
 AND a.usali_subcategory = b.usali_subcategory
 AND a.usali_department = b.usali_department;

GRANT SELECT ON gl.v_budget_vs_actual TO anon, service_role;