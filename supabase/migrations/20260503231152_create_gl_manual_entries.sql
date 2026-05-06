-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503231152
-- Name:    create_gl_manual_entries
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


CREATE TABLE IF NOT EXISTS gl.manual_entries (
  id              bigserial PRIMARY KEY,
  period_yyyymm   text NOT NULL CHECK (period_yyyymm ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  usali_subcategory text NOT NULL,
  usali_department text NOT NULL DEFAULT 'Undistributed',
  amount_usd      numeric(18,4) NOT NULL,
  kind            text NOT NULL DEFAULT 'manual'
                  CHECK (kind IN ('manual','accrual','estimate','override')),
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  created_by      text DEFAULT 'PBS'
);

CREATE INDEX IF NOT EXISTS idx_manual_entries_period ON gl.manual_entries (period_yyyymm);
CREATE INDEX IF NOT EXISTS idx_manual_entries_subcat ON gl.manual_entries (usali_subcategory);

COMMENT ON TABLE gl.manual_entries IS
'Manual P&L entries for periods/subcats QuickBooks does not track (Mgmt Fees, Depreciation, Interest, Income Tax, FX, accruals). Aggregated into actuals via gl.v_actuals_with_manual. Edit via /settings/manual-entries.';

GRANT SELECT, INSERT, UPDATE, DELETE ON gl.manual_entries TO service_role;
GRANT SELECT ON gl.manual_entries TO authenticated, anon;
GRANT USAGE, SELECT ON SEQUENCE gl.manual_entries_id_seq TO service_role;

-- Combined-actuals view: QB mv_usali_pl_monthly + gl.manual_entries
DROP VIEW IF EXISTS gl.v_actuals_with_manual CASCADE;
CREATE VIEW gl.v_actuals_with_manual AS
SELECT
  period_yyyymm,
  usali_subcategory,
  COALESCE(usali_department,'Undistributed') AS usali_department,
  CASE WHEN usali_subcategory='Revenue' THEN -SUM(amount_usd) ELSE SUM(amount_usd) END AS amount_usd,
  'qb'::text AS source
FROM gl.mv_usali_pl_monthly
GROUP BY period_yyyymm, usali_subcategory, COALESCE(usali_department,'Undistributed')
UNION ALL
SELECT
  period_yyyymm,
  usali_subcategory,
  COALESCE(usali_department,'Undistributed') AS usali_department,
  SUM(amount_usd) AS amount_usd,
  'manual'::text AS source
FROM gl.manual_entries
GROUP BY period_yyyymm, usali_subcategory, COALESCE(usali_department,'Undistributed');
