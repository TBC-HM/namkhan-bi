-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260501203918
-- Name:    phase2_01_dmc_reservation_mapping_minimal
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Minimal mapping table to back the Reconciliation Confirm flow.
-- Matches a Cloudbeds reservation_id to a governance.dmc_contracts.contract_id.
-- Full hint-learning flow comes later from migration-draft.sql.

CREATE TABLE IF NOT EXISTS governance.dmc_reservation_mapping (
  reservation_id   text PRIMARY KEY,
  contract_id      uuid NOT NULL REFERENCES governance.dmc_contracts(contract_id) ON DELETE CASCADE,
  mapping_status   text NOT NULL DEFAULT 'mapped_human' CHECK (mapping_status IN ('mapped_human','mapped_auto','rejected_not_dmc')),
  mapping_method   text DEFAULT 'manual',
  source_name      text,
  rate_plan        text,
  total_amount     numeric,
  check_in_date    date,
  notes            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dmc_mapping_contract ON governance.dmc_reservation_mapping(contract_id);

-- Public-schema views for REST API
CREATE OR REPLACE VIEW public.v_dmc_reservation_mapping AS
SELECT * FROM governance.dmc_reservation_mapping;

-- Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON governance.dmc_reservation_mapping TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.v_dmc_reservation_mapping TO anon, authenticated;

-- RLS: demo-phase permissive — tighten with auth.role checks once auth is wired
ALTER TABLE governance.dmc_reservation_mapping ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dmc_mapping_read ON governance.dmc_reservation_mapping;
DROP POLICY IF EXISTS dmc_mapping_write ON governance.dmc_reservation_mapping;
CREATE POLICY dmc_mapping_read ON governance.dmc_reservation_mapping FOR SELECT USING (true);
CREATE POLICY dmc_mapping_write ON governance.dmc_reservation_mapping FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE governance.dmc_reservation_mapping IS 'Minimal demo-phase mapping. Permissive RLS — tighten before multi-tenant.';