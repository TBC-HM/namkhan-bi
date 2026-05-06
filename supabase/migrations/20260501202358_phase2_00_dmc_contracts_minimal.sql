-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260501202358
-- Name:    phase2_00_dmc_contracts_minimal
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Minimal DMC contracts table to unblock /sales/b2b wiring.
-- Full reconciliation/hints/triggers can be layered on later from migration-draft.sql.

CREATE TABLE IF NOT EXISTS governance.dmc_contracts (
  contract_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_short_name   text NOT NULL,
  partner_legal_name   text,
  partner_type         text CHECK (partner_type IN ('DMC','TO','OTA')) DEFAULT 'DMC',
  country              text,
  country_flag         text,
  vat_number           text,
  address              text,
  contact_name         text,
  contact_role         text,
  contact_email        text,
  contact_phone        text,
  effective_date       date,
  expiry_date          date,
  signed_date          date,
  status               text CHECK (status IN ('active','expiring','expired','draft','suspended')) DEFAULT 'draft',
  auto_renew           boolean DEFAULT false,
  pricing_model        text DEFAULT 'NETT',
  group_surcharge_pct  numeric(5,2) DEFAULT 20,
  group_threshold      int DEFAULT 6,
  extra_bed_usd        numeric(10,2),
  anti_publication_clause text,
  termination_clause   text,
  cancellation_policy  text,
  notes                text,
  pdf_storage_path     text,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dmc_contracts_status ON governance.dmc_contracts(status);
CREATE INDEX IF NOT EXISTS idx_dmc_contracts_expiry ON governance.dmc_contracts(expiry_date);

COMMENT ON TABLE governance.dmc_contracts IS 'Leisure Partnership Agreements (LPAs) and tour-operator contracts. Phase 2 minimal — extends per docs/specs/sales-b2b-dmc/migration-draft.sql.';

ALTER TABLE governance.dmc_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY dmc_contracts_read ON governance.dmc_contracts FOR SELECT TO authenticated USING (true);

-- Seed 5 known DMC partners
INSERT INTO governance.dmc_contracts
  (partner_short_name, partner_legal_name, partner_type, country, country_flag, contact_name, contact_role, contact_email, contact_phone, effective_date, expiry_date, status, auto_renew, address, vat_number)
VALUES
  ('Asian Trails Laos', 'Asian Trails Laos Co. Ltd', 'DMC', 'Laos', E'\U0001F1F1\U0001F1E6', 'Mr. Santixay Vongsanghane', 'Inbound Manager', 'santixay@asiantrailslaos.com', '+856 21 410444', '2026-10-01', '2027-09-30', 'active', false, '4th Floor, Premier Building, Vientiane', '569983920900'),
  ('Laos Autrement',    'Laos Autrement SARL',       'DMC', 'Laos', E'\U0001F1F1\U0001F1E6', 'Sandrine Roman',           'Director',        'sandrine@laosautrement.com', '+856 71 252154', '2026-04-01', '2027-03-31', 'active', true,  'Ban Mano Phang, Luang Prabang',         NULL),
  ('Tiger Trail Travel','Tiger Trail Travel & Tours','DMC', 'Laos', E'\U0001F1F1\U0001F1E6', 'Khamphay Soulinthone',     'GM',              'khamphay@tigertrail-laos.com', '+856 71 252655', '2025-08-01', '2026-07-31', 'expiring', false, 'Sisavangvong Rd, Luang Prabang',        NULL),
  ('Exotissimo Travel', 'Exo Travel (Laos)',         'DMC', 'Laos', E'\U0001F1F1\U0001F1E6', 'Vilavanh Sayasenh',         'Sales Manager',   'vilavanh@exotravel.com',     '+856 21 219121', '2026-01-01', '2026-12-31', 'active', true,  'Lane Xang Avenue, Vientiane',           NULL),
  ('Diethelm Travel',   'Diethelm Travel (Laos) Ltd','DMC', 'Laos', E'\U0001F1F1\U0001F1E6', 'Soukphavanh Phoumavong',    'Sales Director',  'soukphavanh@diethelmtravel.com','+856 21 215920', '2026-04-01', '2027-03-31', 'active', false, 'Setthathirath Rd, Vientiane',           NULL);

-- Convenience view: active contracts with computed days_to_expiry
CREATE OR REPLACE VIEW governance.v_dmc_contracts_listing AS
SELECT
  c.*,
  (c.expiry_date - CURRENT_DATE) AS days_to_expiry,
  CASE
    WHEN c.expiry_date < CURRENT_DATE THEN 'expired'
    WHEN c.expiry_date - CURRENT_DATE <= 90 THEN 'expiring'
    ELSE c.status
  END AS computed_status
FROM governance.dmc_contracts c;