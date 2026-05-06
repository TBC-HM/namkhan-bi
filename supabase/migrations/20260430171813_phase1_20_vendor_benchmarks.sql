-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260430171813
-- Name:    phase1_20_vendor_benchmarks
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- phase1_20_vendor_benchmarks.sql
-- Gap 6 — Vendor cost benchmarks (Procurement Agent input).

CREATE TABLE IF NOT EXISTS ops.vendor_benchmarks (
  sku            text          NOT NULL,
  category       text          NOT NULL,
  vendor         text          NOT NULL,
  unit_cost_usd  numeric(12,4) NOT NULL,
  effective_from date          NOT NULL,
  effective_to   date,
  source         text          NOT NULL,
  PRIMARY KEY (sku, vendor, effective_from)
);

ALTER TABLE ops.vendor_benchmarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vendor_benchmarks_read ON ops.vendor_benchmarks;
CREATE POLICY vendor_benchmarks_read ON ops.vendor_benchmarks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS vendor_benchmarks_write ON ops.vendor_benchmarks;
CREATE POLICY vendor_benchmarks_write ON ops.vendor_benchmarks FOR ALL TO authenticated USING (app.is_top_level()) WITH CHECK (app.is_top_level());

CREATE OR REPLACE VIEW ops.v_vendor_cost_drift AS
SELECT b.sku, b.category, b.vendor,
       b.unit_cost_usd            AS current_cost,
       prev.unit_cost_usd         AS prior_cost,
       100.0 * (b.unit_cost_usd - prev.unit_cost_usd) / NULLIF(prev.unit_cost_usd, 0) AS pct_change
FROM ops.vendor_benchmarks b
LEFT JOIN LATERAL (
  SELECT unit_cost_usd FROM ops.vendor_benchmarks
  WHERE sku=b.sku AND vendor=b.vendor AND effective_from < b.effective_from
  ORDER BY effective_from DESC LIMIT 1
) prev ON true
WHERE b.effective_to IS NULL OR b.effective_to >= CURRENT_DATE;

COMMENT ON TABLE ops.vendor_benchmarks IS 'Phase1_20 — Gap 6: vendor unit-cost benchmarks for Procurement Agent drift detection.';

-- DOWN:
-- DROP VIEW IF EXISTS ops.v_vendor_cost_drift;
-- DROP TABLE IF EXISTS ops.vendor_benchmarks;