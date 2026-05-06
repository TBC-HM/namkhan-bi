-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502191258
-- Name:    gl_phase2_05_pl_summary
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


CREATE TABLE IF NOT EXISTS gl.pl_monthly (
  period_yyyymm text NOT NULL,
  account_id    text NOT NULL REFERENCES gl.accounts(account_id),
  amount_usd    numeric NOT NULL DEFAULT 0,
  upload_id     uuid REFERENCES gl.uploads(upload_id),
  uploaded_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (period_yyyymm, account_id)
);
CREATE INDEX IF NOT EXISTS ix_plmo_period ON gl.pl_monthly(period_yyyymm);

CREATE TABLE IF NOT EXISTS gl.pl_section_monthly (
  period_yyyymm text NOT NULL,
  section       text NOT NULL CHECK (section IN ('income','cost_of_sales','gross_profit','expenses','other_expenses','net_earnings')),
  amount_usd    numeric NOT NULL DEFAULT 0,
  upload_id     uuid REFERENCES gl.uploads(upload_id),
  uploaded_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (period_yyyymm, section)
);

CREATE OR REPLACE VIEW gl.v_pl_monthly_usali AS
SELECT m.period_yyyymm, m.account_id, a.account_name, a.qb_type,
       a.usali_subcategory, a.usali_line_code, a.usali_line_label, m.amount_usd
FROM gl.pl_monthly m JOIN gl.accounts a ON a.account_id = m.account_id;
