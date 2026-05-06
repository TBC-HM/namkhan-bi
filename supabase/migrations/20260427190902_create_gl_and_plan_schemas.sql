-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427190902
-- Name:    create_gl_and_plan_schemas
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE SCHEMA IF NOT EXISTS gl;
CREATE SCHEMA IF NOT EXISTS plan;

CREATE TABLE IF NOT EXISTS gl.accounts (
  account_code         text PRIMARY KEY,
  account_name         text NOT NULL,
  account_full         text NOT NULL,
  account_class        text,
  account_type         text,
  parent_code          text REFERENCES gl.accounts(account_code) ON DELETE SET NULL,
  currency_native      text NOT NULL DEFAULT 'USD',
  is_active            boolean NOT NULL DEFAULT true,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gl_accounts_class ON gl.accounts(account_class);

CREATE TABLE IF NOT EXISTS gl.fx_rates (
  rate_date            date NOT NULL,
  from_currency        text NOT NULL,
  to_currency          text NOT NULL,
  rate                 numeric(18,8) NOT NULL,
  source               text,
  PRIMARY KEY (rate_date, from_currency, to_currency)
);

CREATE TABLE IF NOT EXISTS gl.transactions (
  txn_id               bigserial PRIMARY KEY,
  txn_date             date NOT NULL,
  txn_type             text NOT NULL,
  txn_number           text,
  posting              boolean NOT NULL DEFAULT true,
  section_account      text REFERENCES gl.accounts(account_code),
  line_account         text REFERENCES gl.accounts(account_code),
  party_name           text,
  location             text,
  class                text,
  description          text,
  amount_native        numeric(18,4) NOT NULL,
  currency_native      text NOT NULL DEFAULT 'USD',
  fx_rate              numeric(18,8),
  amount_usd           numeric(18,4),
  source_file          text,
  source_row           int,
  imported_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (txn_date, txn_type, txn_number, section_account, line_account, amount_native, source_row)
);
CREATE INDEX IF NOT EXISTS idx_gl_txn_date ON gl.transactions(txn_date);
CREATE INDEX IF NOT EXISTS idx_gl_txn_section ON gl.transactions(section_account);
CREATE INDEX IF NOT EXISTS idx_gl_txn_line ON gl.transactions(line_account);
CREATE INDEX IF NOT EXISTS idx_gl_txn_type ON gl.transactions(txn_type);

CREATE TABLE IF NOT EXISTS gl.pnl_snapshot (
  id                   bigserial PRIMARY KEY,
  period_year          int NOT NULL,
  period_month         int NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  account_code         text NOT NULL REFERENCES gl.accounts(account_code),
  amount_usd           numeric(18,4) NOT NULL DEFAULT 0,
  is_partial_month     boolean NOT NULL DEFAULT false,
  partial_month_end_day int,
  source_file          text,
  imported_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_year, period_month, account_code, source_file)
);
CREATE INDEX IF NOT EXISTS idx_gl_pnl_period ON gl.pnl_snapshot(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_gl_pnl_account ON gl.pnl_snapshot(account_code);

CREATE TABLE IF NOT EXISTS plan.account_map (
  account_code         text PRIMARY KEY REFERENCES gl.accounts(account_code),
  usali_dept           text NOT NULL,
  usali_subdept        text,
  usali_account_type   text NOT NULL,
  cloudbeds_subdept    text,
  service_charge_pool  boolean NOT NULL DEFAULT false,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plan_map_dept ON plan.account_map(usali_dept);
CREATE INDEX IF NOT EXISTS idx_plan_map_type ON plan.account_map(usali_account_type);

CREATE TABLE IF NOT EXISTS plan.scenarios (
  scenario_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id          int NOT NULL,
  name                 text NOT NULL,
  scenario_type        text NOT NULL CHECK (scenario_type IN ('budget','forecast','actual','simulation','last_year')),
  fiscal_year          int NOT NULL,
  status               text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','archived')),
  parent_scenario_id   uuid REFERENCES plan.scenarios(scenario_id),
  created_by           text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  approved_at          timestamptz,
  notes                text,
  UNIQUE (property_id, name, fiscal_year)
);
CREATE INDEX IF NOT EXISTS idx_plan_scen_year_type ON plan.scenarios(fiscal_year, scenario_type);

CREATE TABLE IF NOT EXISTS plan.lines (
  id                   bigserial PRIMARY KEY,
  scenario_id          uuid NOT NULL REFERENCES plan.scenarios(scenario_id) ON DELETE CASCADE,
  period_year          int NOT NULL,
  period_month         int NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  account_code         text NOT NULL REFERENCES gl.accounts(account_code),
  amount_usd           numeric(18,4) NOT NULL DEFAULT 0,
  notes                text,
  UNIQUE (scenario_id, period_year, period_month, account_code)
);
CREATE INDEX IF NOT EXISTS idx_plan_lines_scen ON plan.lines(scenario_id);
CREATE INDEX IF NOT EXISTS idx_plan_lines_period ON plan.lines(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_plan_lines_account ON plan.lines(account_code);

CREATE TABLE IF NOT EXISTS plan.drivers (
  id                   bigserial PRIMARY KEY,
  scenario_id          uuid NOT NULL REFERENCES plan.scenarios(scenario_id) ON DELETE CASCADE,
  period_year          int NOT NULL,
  period_month         int NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  room_type_id         text,
  driver_key           text NOT NULL,
  value_numeric        numeric(18,6) NOT NULL,
  notes                text,
  UNIQUE (scenario_id, period_year, period_month, room_type_id, driver_key)
);
CREATE INDEX IF NOT EXISTS idx_plan_driv_scen ON plan.drivers(scenario_id);
CREATE INDEX IF NOT EXISTS idx_plan_driv_key ON plan.drivers(driver_key);