-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260430171758
-- Name:    phase1_19_cash_forecast
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- phase1_19_cash_forecast.sql
-- Gap 4 — 13-week cash forecast.

CREATE TABLE IF NOT EXISTS gl.cash_forecast_weekly (
  week_start_date  date          NOT NULL,
  property_id      bigint        NOT NULL DEFAULT 260955,
  opening_cash_usd numeric(14,2) NOT NULL,
  inflow_usd       numeric(14,2) NOT NULL,
  outflow_usd      numeric(14,2) NOT NULL,
  closing_cash_usd numeric(14,2) GENERATED ALWAYS AS (opening_cash_usd + inflow_usd - outflow_usd) STORED,
  source           text          NOT NULL,
  PRIMARY KEY (week_start_date, property_id)
);

ALTER TABLE gl.cash_forecast_weekly ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cash_forecast_read ON gl.cash_forecast_weekly;
CREATE POLICY cash_forecast_read ON gl.cash_forecast_weekly FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS cash_forecast_write ON gl.cash_forecast_weekly;
CREATE POLICY cash_forecast_write ON gl.cash_forecast_weekly FOR ALL TO authenticated USING (app.is_top_level()) WITH CHECK (app.is_top_level());

-- Runway view: weeks of cash from current position
CREATE OR REPLACE VIEW kpi.v_cash_runway_weeks AS
SELECT
  c.week_start_date,
  c.closing_cash_usd,
  c.outflow_usd,
  CASE WHEN c.outflow_usd > 0 THEN c.closing_cash_usd / c.outflow_usd END AS weeks_runway
FROM gl.cash_forecast_weekly c
ORDER BY c.week_start_date;

COMMENT ON TABLE gl.cash_forecast_weekly IS 'Phase1_19 — Gap 4: 13-week rolling cash forecast. Manual + Cashflow Agent derived.';

-- DOWN:
-- DROP VIEW IF EXISTS kpi.v_cash_runway_weeks;
-- DROP TABLE IF EXISTS gl.cash_forecast_weekly;