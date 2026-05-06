-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260430171614
-- Name:    phase1_14_materiality
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- phase1_14_materiality.sql
-- Gap 3 — Materiality thresholds with global default seed (5% AND $1,000).

CREATE TABLE IF NOT EXISTS gl.materiality_thresholds (
  property_id       bigint       NOT NULL DEFAULT 260955,
  scope             text         NOT NULL,
  scope_value       text,
  pct_threshold     numeric(5,2) NOT NULL,
  abs_threshold_usd numeric(12,2) NOT NULL,
  PRIMARY KEY (property_id, scope, scope_value)
);

ALTER TABLE gl.materiality_thresholds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS materiality_read ON gl.materiality_thresholds;
CREATE POLICY materiality_read ON gl.materiality_thresholds FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS materiality_write ON gl.materiality_thresholds;
CREATE POLICY materiality_write ON gl.materiality_thresholds FOR ALL TO authenticated USING (app.is_top_level()) WITH CHECK (app.is_top_level());

-- Seed: global default 5% AND $1,000
INSERT INTO gl.materiality_thresholds (property_id, scope, scope_value, pct_threshold, abs_threshold_usd)
VALUES (260955, 'global', '__global__', 5.00, 1000.00)
ON CONFLICT (property_id, scope, scope_value) DO NOTHING;

COMMENT ON TABLE gl.materiality_thresholds IS 'Phase1_14 — Gap 3: variance materiality thresholds. Global default 5%/$1k, override per dept or GL line.';

-- DOWN:
-- DROP TABLE IF EXISTS gl.materiality_thresholds;