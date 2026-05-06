-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502192237
-- Name:    phase2_05_qb_pl_summary
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE TABLE qb.pl_monthly (
  period_yyyymm    text NOT NULL,
  account_id       text NOT NULL REFERENCES qb.accounts(account_id),
  amount_usd       numeric NOT NULL DEFAULT 0,
  upload_id        uuid REFERENCES qb.uploads(upload_id),
  uploaded_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (period_yyyymm, account_id)
);
CREATE INDEX ix_plmo_period ON qb.pl_monthly(period_yyyymm);

CREATE TABLE qb.pl_section_monthly (
  period_yyyymm    text NOT NULL,
  section          text NOT NULL
                   CHECK (section IN ('income','cost_of_sales','gross_profit','expenses','other_expenses','net_earnings')),
  amount_usd       numeric NOT NULL DEFAULT 0,
  upload_id        uuid REFERENCES qb.uploads(upload_id),
  uploaded_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (period_yyyymm, section)
);

CREATE OR REPLACE VIEW qb.v_pl_monthly_usali AS
SELECT m.period_yyyymm, m.account_id, a.account_name, a.qb_type,
       a.usali_subcategory, a.usali_line_code, a.usali_line_label, m.amount_usd
FROM qb.pl_monthly m
JOIN qb.accounts a ON a.account_id = m.account_id;