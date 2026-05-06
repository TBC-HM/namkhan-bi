-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502192023
-- Name:    phase2_01_qb_master
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE SCHEMA IF NOT EXISTS qb;

CREATE TABLE qb.classes (
  class_id           text PRIMARY KEY,
  qb_class_name      text NOT NULL UNIQUE,
  usali_section      text NOT NULL
                     CHECK (usali_section IN ('Operated Department','Undistributed','DQ Bucket')),
  usali_department   text,
  is_revenue_center  boolean NOT NULL DEFAULT false,
  is_active          boolean NOT NULL DEFAULT true,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE qb.classes IS
  'QuickBooks Class dimension. Maps directly to USALI Operated Departments. Seed list maintained manually.';

INSERT INTO qb.classes (class_id, qb_class_name, usali_section, usali_department, is_revenue_center, notes)
VALUES
  ('rooms','Rooms','Operated Department','Rooms',true,'Reconcile to Cloudbeds rooms revenue ±2%'),
  ('fb','F&B','Operated Department','F&B',true,'Food + Beverage. Reconcile to Poster POS when live.'),
  ('spa','Spa','Operated Department','Spa',true,''),
  ('activities','Activities','Operated Department','Activities',true,''),
  ('imekong','IMekong','Operated Department','Mekong Cruise',true,'Boat cruise — separate operated department per CoA structure'),
  ('retail','Retail','Operated Department','Other Operated',true,'Retail shop revenue + COGS'),
  ('transport','Transport','Operated Department','Other Operated',true,'Guest transfer revenue net of cost'),
  ('undistributed','Undistributed','Undistributed','Undistributed',false,'A&G + S&M + POM + Utilities. Subcategory split by qb.accounts.usali_subcategory.'),
  ('not_specified','Not specified','DQ Bucket',NULL,false,'Transactions with NULL class. Always a DQ exception.');

CREATE TABLE qb.accounts (
  account_id           text PRIMARY KEY,
  qb_account_number    text,
  account_name         text NOT NULL,
  qb_type              text NOT NULL,
  qb_detail_type       text,
  description          text,
  currency             text NOT NULL DEFAULT 'USD',
  total_balance_raw    numeric,
  is_pl                boolean GENERATED ALWAYS AS (
    qb_type IN ('Income','Cost of Goods Sold','Expenses','Other Income','Other Expense')
  ) STORED,
  is_active            boolean NOT NULL DEFAULT true,
  usali_subcategory    text
                       CHECK (usali_subcategory IS NULL OR usali_subcategory IN (
                         'Revenue','Cost of Sales','Payroll & Related','Other Operating Expenses',
                         'Utilities','POM','A&G','Sales & Marketing','Mgmt Fees','Depreciation',
                         'Interest','Income Tax','FX Gain/Loss','Non-Operating','Balance Sheet'
                       )),
  usali_line_code      text,
  usali_line_label     text,
  mapping_status       text NOT NULL DEFAULT 'unmapped'
                       CHECK (mapping_status IN ('unmapped','mapped','review','duplicate','deprecated')),
  mapping_notes        text,
  mapped_at            timestamptz,
  mapped_by            uuid,
  cloudbeds_category   text,
  source_file          text,
  source_row_hash      text,
  uploaded_at          timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_accounts_qb_type        ON qb.accounts(qb_type);
CREATE INDEX ix_accounts_subcategory    ON qb.accounts(usali_subcategory) WHERE is_pl;
CREATE INDEX ix_accounts_mapping_status ON qb.accounts(mapping_status);
CREATE INDEX ix_accounts_active         ON qb.accounts(is_active);

COMMENT ON TABLE qb.accounts IS
  'QuickBooks Chart of Accounts mirror. Garbage-in-garbage-out by design.';

CREATE TABLE qb.vendors (
  vendor_id        text PRIMARY KEY,
  vendor_name      text NOT NULL,
  display_name     text,
  is_active        boolean NOT NULL DEFAULT true,
  terms            text,
  email            text,
  phone            text,
  category         text,
  currency         text DEFAULT 'USD',
  source_file      text,
  uploaded_at      timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_vendors_active ON qb.vendors(is_active);
CREATE INDEX ix_vendors_name   ON qb.vendors USING gin (to_tsvector('simple', vendor_name));

CREATE TABLE qb.uploads (
  upload_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_kind        text NOT NULL
                     CHECK (upload_kind IN ('coa','transactions','pl_by_class','pl_summary','vendors')),
  filename           text NOT NULL,
  file_hash          text,
  file_size_bytes    bigint,
  storage_path       text,
  period_start       date,
  period_end         date,
  row_count_input    integer,
  row_count_loaded   integer,
  row_count_rejected integer,
  status             text NOT NULL DEFAULT 'received'
                     CHECK (status IN ('received','validating','validated','loaded','failed','rolled_back')),
  validation_summary jsonb,
  uploaded_by        uuid,
  uploaded_at        timestamptz NOT NULL DEFAULT now(),
  loaded_at          timestamptz,
  notes              text
);

CREATE INDEX ix_uploads_kind     ON qb.uploads(upload_kind, uploaded_at DESC);
CREATE INDEX ix_uploads_status   ON qb.uploads(status);
CREATE INDEX ix_uploads_period   ON qb.uploads(period_start, period_end);

CREATE TABLE qb.gl_entries (
  entry_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id         uuid NOT NULL REFERENCES qb.uploads(upload_id) ON DELETE RESTRICT,
  qb_txn_id         text,
  qb_txn_type       text,
  qb_txn_number     text,
  txn_date          date NOT NULL,
  period_yyyymm     text NOT NULL,
  fiscal_year       integer NOT NULL,
  account_id        text NOT NULL REFERENCES qb.accounts(account_id),
  class_id          text NOT NULL REFERENCES qb.classes(class_id),
  vendor_id         text REFERENCES qb.vendors(vendor_id),
  customer_name     text,
  memo              text,
  debit_usd         numeric NOT NULL DEFAULT 0,
  credit_usd        numeric NOT NULL DEFAULT 0,
  amount_usd        numeric GENERATED ALWAYS AS (debit_usd - credit_usd) STORED,
  txn_currency      text NOT NULL DEFAULT 'USD',
  txn_amount_native numeric,
  fx_rate_used      numeric,
  amount_lak        numeric,
  source_row_index  integer,
  source_row_hash   text,
  has_class         boolean GENERATED ALWAYS AS (class_id <> 'not_specified') STORED,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_gle_period       ON qb.gl_entries(period_yyyymm);
CREATE INDEX ix_gle_account      ON qb.gl_entries(account_id, period_yyyymm);
CREATE INDEX ix_gle_class        ON qb.gl_entries(class_id, period_yyyymm);
CREATE INDEX ix_gle_vendor       ON qb.gl_entries(vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX ix_gle_txn_date     ON qb.gl_entries(txn_date);
CREATE INDEX ix_gle_qb_txn       ON qb.gl_entries(qb_txn_id) WHERE qb_txn_id IS NOT NULL;
CREATE INDEX ix_gle_upload       ON qb.gl_entries(upload_id);
CREATE INDEX ix_gle_no_class     ON qb.gl_entries(period_yyyymm) WHERE has_class = false;

COMMENT ON TABLE qb.gl_entries IS
  'Transaction-level journal entries from QuickBooks. Source of truth for USALI P&L.';

CREATE TABLE qb.pl_summary_monthly (
  period_yyyymm    text NOT NULL,
  account_id       text NOT NULL REFERENCES qb.accounts(account_id),
  class_id         text NOT NULL REFERENCES qb.classes(class_id),
  amount_usd       numeric NOT NULL DEFAULT 0,
  upload_id        uuid REFERENCES qb.uploads(upload_id),
  uploaded_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (period_yyyymm, account_id, class_id)
);

CREATE INDEX ix_pls_period ON qb.pl_summary_monthly(period_yyyymm);
CREATE INDEX ix_pls_class  ON qb.pl_summary_monthly(class_id, period_yyyymm);

CREATE OR REPLACE FUNCTION qb.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_classes_updated_at  BEFORE UPDATE ON qb.classes  FOR EACH ROW EXECUTE FUNCTION qb.tg_set_updated_at();
CREATE TRIGGER trg_accounts_updated_at BEFORE UPDATE ON qb.accounts FOR EACH ROW EXECUTE FUNCTION qb.tg_set_updated_at();
CREATE TRIGGER trg_vendors_updated_at  BEFORE UPDATE ON qb.vendors  FOR EACH ROW EXECUTE FUNCTION qb.tg_set_updated_at();