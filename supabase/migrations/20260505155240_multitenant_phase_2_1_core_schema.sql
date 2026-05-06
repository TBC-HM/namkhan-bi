-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505155240
-- Name:    multitenant_phase_2_1_core_schema
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- =====================================================================
-- PHASE 2.1 — core schema, properties registry, user_properties, pms_credentials
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS core;
GRANT USAGE ON SCHEMA core TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- core.properties — single source of truth for tenants
-- ---------------------------------------------------------------------
CREATE TABLE core.properties (
  property_id     BIGINT PRIMARY KEY,
  code            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  pms_provider    TEXT NOT NULL CHECK (pms_provider IN ('cloudbeds','mews','none')),
  pms_property_id TEXT,
  base_currency   TEXT NOT NULL,
  timezone        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','prospect')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX properties_pms_provider_idx ON core.properties(pms_provider);
CREATE INDEX properties_status_idx       ON core.properties(status);

ALTER TABLE core.properties ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- core.user_properties — which user can access which property
-- ---------------------------------------------------------------------
CREATE TABLE core.user_properties (
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id     BIGINT NOT NULL REFERENCES core.properties(property_id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('owner','manager','staff','readonly')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, property_id)
);

CREATE INDEX user_properties_property_idx ON core.user_properties(property_id);
CREATE INDEX user_properties_role_idx     ON core.user_properties(role);

ALTER TABLE core.user_properties ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- core.pms_credentials — non-secret PMS connection metadata
-- (Actual secrets must live in Supabase Vault and be referenced by *_ref)
-- ---------------------------------------------------------------------
CREATE TABLE core.pms_credentials (
  property_id        BIGINT PRIMARY KEY REFERENCES core.properties(property_id) ON DELETE CASCADE,
  provider           TEXT NOT NULL,
  client_id          TEXT,
  api_key_ref        TEXT,
  webhook_secret_ref TEXT,
  refreshed_at       TIMESTAMPTZ,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE core.pms_credentials ENABLE ROW LEVEL SECURITY;

-- Lock pms_credentials to service_role only — never exposed to authenticated
REVOKE ALL ON core.pms_credentials FROM PUBLIC, anon, authenticated;
GRANT  ALL ON core.pms_credentials TO service_role;

-- ---------------------------------------------------------------------
-- Seed Namkhan
-- ---------------------------------------------------------------------
INSERT INTO core.properties
  (property_id, code, name, pms_provider, pms_property_id, base_currency, timezone, status)
VALUES
  (260955, 'namkhan', 'The Namkhan', 'cloudbeds', '260955', 'LAK', 'Asia/Vientiane', 'active');

-- Seed Donna as a prospect (placeholder, no credentials yet)
INSERT INTO core.properties
  (property_id, code, name, pms_provider, pms_property_id, base_currency, timezone, status)
VALUES
  (1000001, 'donna', 'Donna Portals', 'mews', NULL, 'USD', 'Asia/Vientiane', 'prospect');

-- ---------------------------------------------------------------------
-- Seed pms_credentials placeholder for Namkhan (refs only)
-- ---------------------------------------------------------------------
INSERT INTO core.pms_credentials (property_id, provider, notes)
VALUES (260955, 'cloudbeds', 'Existing Cloudbeds connection — secrets in Vault, ref keys TBD');

INSERT INTO core.pms_credentials (property_id, provider, notes)
VALUES (1000001, 'mews', 'Donna Portals — Mews credentials not yet configured');

-- ---------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

CREATE TRIGGER properties_set_updated_at
  BEFORE UPDATE ON core.properties
  FOR EACH ROW EXECUTE FUNCTION core.tg_set_updated_at();

CREATE TRIGGER pms_credentials_set_updated_at
  BEFORE UPDATE ON core.pms_credentials
  FOR EACH ROW EXECUTE FUNCTION core.tg_set_updated_at();

-- ---------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------
COMMENT ON TABLE core.properties IS 'Tenant registry — one row per hotel/property. property_id matches Cloudbeds for legacy properties; new properties (e.g. Mews) get >= 1000001.';
COMMENT ON TABLE core.user_properties IS 'Which auth.users can access which property. Drives JWT property_ids[] claim and RLS.';
COMMENT ON TABLE core.pms_credentials IS 'Non-secret PMS connection metadata. Real secrets live in Supabase Vault, referenced via *_ref columns.';
