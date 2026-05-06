-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260430171634
-- Name:    phase1_15_dept_labour
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- phase1_15_dept_labour.sql
-- Gap 1 — Department labour-cost time series. View references public.transactions.

CREATE TABLE IF NOT EXISTS ops.payroll_daily (
  service_date  date          NOT NULL,
  property_id   bigint        NOT NULL DEFAULT 260955,
  dept_code     text          NOT NULL,
  hours         numeric(10,2) NOT NULL,
  cost_lak      bigint        NOT NULL,
  cost_usd      numeric(12,2) GENERATED ALWAYS AS (cost_lak / 21800.0) STORED,
  source        text          NOT NULL,
  PRIMARY KEY (service_date, property_id, dept_code)
);
CREATE INDEX IF NOT EXISTS idx_payroll_daily_dept_date ON ops.payroll_daily (dept_code, service_date);

ALTER TABLE ops.payroll_daily ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payroll_daily_read ON ops.payroll_daily;
CREATE POLICY payroll_daily_read ON ops.payroll_daily FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS payroll_daily_write ON ops.payroll_daily;
CREATE POLICY payroll_daily_write ON ops.payroll_daily FOR ALL TO authenticated USING (app.is_top_level()) WITH CHECK (app.is_top_level());

-- View: labour ratio against public.transactions revenue
CREATE OR REPLACE VIEW kpi.v_dept_labour_ratio_daily AS
SELECT p.service_date,
       p.dept_code,
       p.cost_usd AS labour_cost,
       r.dept_revenue,
       100.0 * p.cost_usd / NULLIF(r.dept_revenue, 0) AS labour_pct
FROM ops.payroll_daily p
LEFT JOIN LATERAL (
  SELECT SUM(t.amount) AS dept_revenue
  FROM public.transactions t
  WHERE t.service_date = p.service_date
    AND t.usali_dept   = p.dept_code
    AND t.transaction_type = 'debit'
) r ON true;

-- Function: control band detection for Margin Leak Sentinel
CREATE OR REPLACE FUNCTION kpi.dept_labour_band_breach(
  p_dept text, p_from date, p_to date, p_band_low numeric, p_band_high numeric
) RETURNS TABLE(service_date date, labour_pct numeric, breach text)
LANGUAGE sql STABLE AS $$
  SELECT v.service_date, v.labour_pct,
         CASE WHEN v.labour_pct > p_band_high THEN 'high'
              WHEN v.labour_pct < p_band_low  THEN 'low'
              ELSE 'ok' END AS breach
  FROM kpi.v_dept_labour_ratio_daily v
  WHERE v.dept_code = p_dept
    AND v.service_date BETWEEN p_from AND p_to;
$$;

COMMENT ON TABLE ops.payroll_daily IS 'Phase1_15 — Gap 1: daily payroll by department. Manual CSV upload until HRIS feed.';

-- DOWN:
-- DROP FUNCTION IF EXISTS kpi.dept_labour_band_breach(text,date,date,numeric,numeric);
-- DROP VIEW IF EXISTS kpi.v_dept_labour_ratio_daily;
-- DROP TABLE IF EXISTS ops.payroll_daily;