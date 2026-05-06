-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260430171601
-- Name:    phase1_13_usali_expense_map
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- phase1_13_usali_expense_map.sql
-- Gap 2 — Expense-side USALI mapping. Adapted: gl.entries → gl.transactions
-- (existing schema uses txn_date / line_account / amount_usd).

CREATE TABLE IF NOT EXISTS gl.usali_expense_map (
  gl_code            text         PRIMARY KEY,
  description        text         NOT NULL,
  usali_section      text         NOT NULL,
  usali_dept         text,
  usali_subdept      text,
  usali_undist_line  text,
  is_labour          boolean      NOT NULL DEFAULT false,
  notes              text,
  updated_by         uuid         REFERENCES auth.users,
  updated_at         timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_usali_expense_map_section ON gl.usali_expense_map (usali_section, usali_undist_line);

ALTER TABLE gl.usali_expense_map ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS usali_expense_map_read ON gl.usali_expense_map;
CREATE POLICY usali_expense_map_read ON gl.usali_expense_map FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS usali_expense_map_write ON gl.usali_expense_map;
CREATE POLICY usali_expense_map_write ON gl.usali_expense_map FOR ALL TO authenticated USING (app.is_top_level()) WITH CHECK (app.is_top_level());

-- View adapted to actual gl.transactions schema. Aliases posting_date/gl_code/amount for downstream consumers.
CREATE OR REPLACE VIEW gl.v_pnl_usali AS
SELECT g.txn_date         AS posting_date,
       g.line_account     AS gl_code,
       g.amount_usd       AS amount,
       COALESCE(m.usali_section, 'unassigned') AS usali_section,
       m.usali_dept,
       m.usali_subdept,
       m.usali_undist_line,
       m.is_labour
FROM gl.transactions g
LEFT JOIN gl.usali_expense_map m ON m.gl_code = g.line_account;

COMMENT ON TABLE gl.usali_expense_map IS 'Phase1_13 — Gap 2: maps GL line accounts to USALI expense lines.';

-- DOWN:
-- DROP VIEW IF EXISTS gl.v_pnl_usali;
-- DROP TABLE IF EXISTS gl.usali_expense_map;