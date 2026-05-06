-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503000532
-- Name:    sales_schema_base
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE SCHEMA IF NOT EXISTS sales;

DO $$ BEGIN
  CREATE TYPE sales.proposal_status AS ENUM ('draft','approved','sent','viewed','signed','won','lost','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sales.block_type AS ENUM ('room','activity','fnb','spa','transfer','note');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sales.guest_edit_action AS ENUM ('removed','restored','qty_changed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sales.template_kind AS ENUM ('fit','group','wedding','retreat','package','b2b');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS sales.inquiries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     BIGINT NOT NULL,
  source          TEXT NOT NULL,
  channel_ref     TEXT,
  guest_name      TEXT,
  guest_email     TEXT,
  guest_phone     TEXT,
  country         TEXT,
  language        TEXT NOT NULL DEFAULT 'en',
  party_adults    INT,
  party_children  INT,
  date_in         DATE,
  date_out        DATE,
  status          TEXT NOT NULL DEFAULT 'new',
  raw_payload     JSONB,
  triage_kind     sales.template_kind,
  triage_conf     NUMERIC(3,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inquiries_prop_created ON sales.inquiries (property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON sales.inquiries (status) WHERE status IN ('new','drafted');

CREATE TABLE IF NOT EXISTS sales.proposal_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     BIGINT NOT NULL,
  kind            sales.template_kind NOT NULL,
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  default_blocks  JSONB NOT NULL,
  default_email   JSONB NOT NULL,
  brand_voice_lang TEXT NOT NULL DEFAULT 'en',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales.proposals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id      UUID REFERENCES sales.inquiries(id) ON DELETE RESTRICT,
  template_id     UUID REFERENCES sales.proposal_templates(id),
  property_id     BIGINT NOT NULL,
  status          sales.proposal_status NOT NULL DEFAULT 'draft',
  public_token    TEXT UNIQUE,
  expires_at      TIMESTAMPTZ,
  rate_locked_at  TIMESTAMPTZ,
  fx_rate_lak_usd NUMERIC(10,2),
  total_lak       NUMERIC(14,2),
  total_usd       NUMERIC(12,2),
  created_by      UUID,
  sent_at         TIMESTAMPTZ,
  signed_at       TIMESTAMPTZ,
  cb_reservation_id TEXT,
  guest_name_snapshot TEXT,
  date_in_snapshot DATE,
  date_out_snapshot DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proposals_inquiry ON sales.proposals (inquiry_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON sales.proposals (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proposals_token ON sales.proposals (public_token) WHERE public_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS sales.proposal_blocks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id     UUID NOT NULL REFERENCES sales.proposals(id) ON DELETE CASCADE,
  block_type      sales.block_type NOT NULL,
  ref_table       TEXT,
  ref_id          TEXT,
  label           TEXT NOT NULL,
  note            TEXT,
  qty             INT NOT NULL DEFAULT 1,
  nights          INT NOT NULL DEFAULT 1,
  unit_price_lak  NUMERIC(12,2) NOT NULL,
  total_lak       NUMERIC(14,2) GENERATED ALWAYS AS (qty * nights * unit_price_lak) STORED,
  removable       BOOLEAN NOT NULL DEFAULT true,
  ics_url         TEXT,
  hero_asset_id   UUID REFERENCES marketing.media_assets(asset_id),
  sort_order      INT NOT NULL DEFAULT 100,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_blocks_proposal_sort ON sales.proposal_blocks (proposal_id, sort_order);

CREATE TABLE IF NOT EXISTS sales.proposal_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id     UUID NOT NULL REFERENCES sales.proposals(id) ON DELETE CASCADE,
  version         INT NOT NULL,
  snapshot        JSONB NOT NULL,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, version)
);

CREATE TABLE IF NOT EXISTS sales.proposal_emails (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id     UUID NOT NULL REFERENCES sales.proposals(id) ON DELETE CASCADE,
  version         INT NOT NULL,
  subject         TEXT NOT NULL,
  intro_md        TEXT NOT NULL,
  outro_md        TEXT NOT NULL,
  ps_md           TEXT,
  brand_voice_check_passed BOOLEAN NOT NULL DEFAULT false,
  edited_by       UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, version)
);

CREATE TABLE IF NOT EXISTS sales.proposal_view_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id     UUID NOT NULL REFERENCES sales.proposals(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_hash         TEXT,
  user_agent      TEXT,
  country         TEXT
);
CREATE INDEX IF NOT EXISTS idx_view_events_prop ON sales.proposal_view_events (proposal_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS sales.proposal_guest_edits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id     UUID NOT NULL REFERENCES sales.proposals(id) ON DELETE CASCADE,
  block_id        UUID NOT NULL REFERENCES sales.proposal_blocks(id) ON DELETE CASCADE,
  action          sales.guest_edit_action NOT NULL,
  qty_before      INT,
  qty_after       INT,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_hash         TEXT
);
CREATE INDEX IF NOT EXISTS idx_guest_edits_prop ON sales.proposal_guest_edits (proposal_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS sales.proposal_sig_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id     UUID NOT NULL REFERENCES sales.proposals(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,
  provider_doc_id TEXT,
  status          TEXT NOT NULL,
  signed_by_name  TEXT,
  signed_by_email TEXT,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_hash         TEXT
);

CREATE TABLE IF NOT EXISTS sales.ics_files (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id     UUID NOT NULL REFERENCES sales.proposals(id) ON DELETE CASCADE,
  block_id        UUID NOT NULL REFERENCES sales.proposal_blocks(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ NOT NULL,
  location        TEXT,
  description     TEXT,
  file_url        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales.agent_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id     UUID REFERENCES sales.proposals(id) ON DELETE SET NULL,
  inquiry_id      UUID REFERENCES sales.inquiries(id) ON DELETE SET NULL,
  agent_name      TEXT NOT NULL,
  model           TEXT NOT NULL,
  tokens_in       INT,
  tokens_out      INT,
  cost_eur        NUMERIC(8,4),
  status          TEXT NOT NULL,
  error           TEXT,
  duration_ms     INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_runs_created ON sales.agent_runs (created_at DESC);

CREATE TABLE IF NOT EXISTS sales.packages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     BIGINT NOT NULL,
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft',
  margin_floor_pct NUMERIC(4,1) NOT NULL DEFAULT 22.0,
  vendor_lock_required BOOLEAN NOT NULL DEFAULT false,
  hero_asset_id   UUID REFERENCES marketing.media_assets(asset_id),
  description_md  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales.package_components (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id      UUID NOT NULL REFERENCES sales.packages(id) ON DELETE CASCADE,
  block_type      sales.block_type NOT NULL,
  ref_table       TEXT NOT NULL,
  ref_id          TEXT NOT NULL,
  default_qty     INT NOT NULL DEFAULT 1,
  default_nights  INT NOT NULL DEFAULT 1,
  default_price_lak NUMERIC(12,2) NOT NULL,
  sort_order      INT NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS sales.package_costs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id      UUID NOT NULL REFERENCES sales.packages(id) ON DELETE CASCADE,
  vendor_id       UUID,
  unit_cost_lak   NUMERIC(12,2) NOT NULL,
  valid_from      DATE NOT NULL,
  valid_to        DATE
);

CREATE OR REPLACE FUNCTION sales.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $func$
BEGIN NEW.updated_at = now(); RETURN NEW; END $func$;

DROP TRIGGER IF EXISTS trg_inquiries_updated ON sales.inquiries;
CREATE TRIGGER trg_inquiries_updated BEFORE UPDATE ON sales.inquiries
  FOR EACH ROW EXECUTE FUNCTION sales.set_updated_at();

DROP TRIGGER IF EXISTS trg_proposals_updated ON sales.proposals;
CREATE TRIGGER trg_proposals_updated BEFORE UPDATE ON sales.proposals
  FOR EACH ROW EXECUTE FUNCTION sales.set_updated_at();