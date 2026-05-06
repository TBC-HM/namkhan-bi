-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260429210220
-- Name:    phase1_01_docs
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- =====================================================================
-- Phase 1.1 — `docs` schema
-- Universal documents: legal, compliance, insurance, sops, brand,
-- templates, meeting notes, markdown, KB, vendor, HR, guest, financial.
-- One core table + typed extensions + cross-cutting tables.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS docs;
COMMENT ON SCHEMA docs IS 'Universal document store with typed extensions and full-text search';

-- ---------------------------------------------------------------------
-- 1. CORE: docs.documents
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS docs.documents (
  doc_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id         bigint REFERENCES public.hotels(property_id),
  doc_type            text NOT NULL CHECK (doc_type IN (
                          'legal','compliance','insurance','sop','brand',
                          'template','meeting_note','markdown','kb_article',
                          'vendor_doc','hr_doc','guest_doc','financial',
                          'recipe_doc','training_material','audit','external_feed','other')),
  doc_subtype         text,
  title               text NOT NULL,
  title_lo            text,
  title_fr            text,
  body_markdown       text,
  storage_bucket      text,
  storage_path        text,
  external_url        text,
  mime                text,
  file_size_bytes     bigint,
  language            text DEFAULT 'en' CHECK (language IN ('lo','en','fr','th','vi','multi')),
  status              text DEFAULT 'draft' CHECK (status IN ('draft','in_review','approved','active','expired','retired','archived')),
  version             int DEFAULT 1,
  is_current_version  boolean DEFAULT true,
  parent_doc_id       uuid REFERENCES docs.documents(doc_id),
  valid_from          date,
  valid_until         date,
  signed              boolean DEFAULT false,
  signed_at           timestamptz,
  sensitivity         text DEFAULT 'internal' CHECK (sensitivity IN ('public','internal','confidential','restricted')),
  retention_until     date,
  raw                 jsonb DEFAULT '{}'::jsonb,
  tags                text[] DEFAULT '{}'::text[],
  search_tsv          tsvector,
  owner_user_id       uuid REFERENCES auth.users(id),
  approved_by         uuid REFERENCES auth.users(id),
  approved_at         timestamptz,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  created_by          uuid REFERENCES auth.users(id),
  updated_by          uuid REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS idx_docs_type        ON docs.documents(doc_type, doc_subtype);
CREATE INDEX IF NOT EXISTS idx_docs_status      ON docs.documents(status) WHERE status NOT IN ('retired','archived');
CREATE INDEX IF NOT EXISTS idx_docs_valid_until ON docs.documents(valid_until) WHERE valid_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_docs_owner       ON docs.documents(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_docs_tags        ON docs.documents USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_docs_search      ON docs.documents USING gin(search_tsv);
CREATE INDEX IF NOT EXISTS idx_docs_parent      ON docs.documents(parent_doc_id);
CREATE INDEX IF NOT EXISTS idx_docs_property    ON docs.documents(property_id);

-- search_tsv trigger
CREATE OR REPLACE FUNCTION docs.documents_search_tsv() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_tsv :=
       setweight(to_tsvector('simple', coalesce(NEW.title,'')),         'A')
    || setweight(to_tsvector('simple', coalesce(NEW.title_lo,'')),       'A')
    || setweight(to_tsvector('simple', coalesce(NEW.title_fr,'')),       'A')
    || setweight(to_tsvector('simple', array_to_string(NEW.tags,' ')),   'B')
    || setweight(to_tsvector('simple', coalesce(NEW.doc_subtype,'')),    'C')
    || setweight(to_tsvector('simple', coalesce(NEW.body_markdown,'')),  'D');
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_docs_search_tsv ON docs.documents;
CREATE TRIGGER trg_docs_search_tsv BEFORE INSERT OR UPDATE ON docs.documents
  FOR EACH ROW EXECUTE FUNCTION docs.documents_search_tsv();

-- ---------------------------------------------------------------------
-- 2. EXTENSION TABLES (typed metadata per doc_type)
-- ---------------------------------------------------------------------

-- Legal
CREATE TABLE IF NOT EXISTS docs.legal_meta (
  doc_id          uuid PRIMARY KEY REFERENCES docs.documents(doc_id) ON DELETE CASCADE,
  counterparty    text,
  counterparty_country text,
  contract_type   text,                       -- nda | msa | employment | lease | partnership | sla | other
  auto_renews     boolean DEFAULT false,
  notice_days     int,
  governing_law   text,
  value_amount    numeric,
  value_currency  text,
  signed_pdf_doc_id uuid REFERENCES docs.documents(doc_id),
  notes           text
);

-- Compliance / licenses / permits / certs
CREATE TABLE IF NOT EXISTS docs.compliance_meta (
  doc_id              uuid PRIMARY KEY REFERENCES docs.documents(doc_id) ON DELETE CASCADE,
  authority           text,                   -- e.g. Lao Ministry of Tourism
  cert_number         text,
  scope               text,
  inspection_required boolean DEFAULT false,
  next_inspection_at  date,
  renewal_lead_days   int DEFAULT 60,
  notes               text
);

-- Insurance
CREATE TABLE IF NOT EXISTS docs.insurance_meta (
  doc_id           uuid PRIMARY KEY REFERENCES docs.documents(doc_id) ON DELETE CASCADE,
  insurer          text,
  policy_number    text,
  coverage_type    text,                      -- property | liability | workers_comp | vehicle | cyber | other
  coverage_amount  numeric,
  coverage_currency text,
  deductible       numeric,
  premium_amount   numeric,
  claims_count     int DEFAULT 0,
  notes            text
);

-- Meeting notes
CREATE TABLE IF NOT EXISTS docs.meeting_notes (
  doc_id           uuid PRIMARY KEY REFERENCES docs.documents(doc_id) ON DELETE CASCADE,
  meeting_type     text,                      -- daily_standup | hod_weekly | pl_review | ownership | adhoc
  held_at          timestamptz,
  duration_min     int,
  attendees        uuid[] DEFAULT '{}'::uuid[],
  external_attendees text[] DEFAULT '{}'::text[],
  decisions        jsonb DEFAULT '[]'::jsonb,
  action_items_count int DEFAULT 0,
  recording_url    text,
  notes            text
);

-- Templates
CREATE TABLE IF NOT EXISTS docs.templates (
  doc_id           uuid PRIMARY KEY REFERENCES docs.documents(doc_id) ON DELETE CASCADE,
  template_kind    text NOT NULL,             -- email | reply | contract | quote | beo | menu_card | sms | whatsapp
  variables        jsonb DEFAULT '[]'::jsonb, -- [{name, type, required, default}]
  engine           text DEFAULT 'liquid' CHECK (engine IN ('liquid','handlebars','jinja','none')),
  times_used       int DEFAULT 0,
  last_used_at     timestamptz
);

-- KB articles
CREATE TABLE IF NOT EXISTS docs.kb_articles (
  doc_id          uuid PRIMARY KEY REFERENCES docs.documents(doc_id) ON DELETE CASCADE,
  kb_category     text,
  audience        text[] DEFAULT '{}'::text[],-- staff | guest | partner | agent
  helpful_count   int DEFAULT 0,
  not_helpful_count int DEFAULT 0,
  view_count      int DEFAULT 0,
  last_viewed_at  timestamptz
);

-- HR docs
CREATE TABLE IF NOT EXISTS docs.hr_docs (
  doc_id           uuid PRIMARY KEY REFERENCES docs.documents(doc_id) ON DELETE CASCADE,
  staff_user_id    uuid REFERENCES auth.users(id),
  hr_doc_kind      text,                       -- cv | contract | probation | review | disciplinary | training_cert | medical | exit | other
  is_sensitive     boolean DEFAULT true,
  notes            text
);

-- Guest docs
CREATE TABLE IF NOT EXISTS docs.guest_docs (
  doc_id          uuid PRIMARY KEY REFERENCES docs.documents(doc_id) ON DELETE CASCADE,
  reservation_id  text,                        -- soft FK to public.reservations.reservation_id
  guest_id        text,                        -- soft FK to public.guests.guest_id
  kind            text,                        -- id_scan | passport | reg_card | waiver | comp_auth | folio_pdf | invoice | other
  is_pii          boolean DEFAULT true,
  notes           text
);
CREATE INDEX IF NOT EXISTS idx_guest_docs_res ON docs.guest_docs(reservation_id);
CREATE INDEX IF NOT EXISTS idx_guest_docs_gst ON docs.guest_docs(guest_id);

-- Vendor docs
CREATE TABLE IF NOT EXISTS docs.vendor_docs (
  doc_id           uuid PRIMARY KEY REFERENCES docs.documents(doc_id) ON DELETE CASCADE,
  vendor_id        uuid,                       -- soft FK to ops.vendors (next migration)
  vendor_doc_kind  text,                       -- quote | po | invoice | delivery_note | cert | msa | catalog | other
  reference_number text,
  amount           numeric,
  currency         text,
  notes            text
);

-- Financial docs
CREATE TABLE IF NOT EXISTS docs.financial_docs (
  doc_id        uuid PRIMARY KEY REFERENCES docs.documents(doc_id) ON DELETE CASCADE,
  fin_kind      text,                          -- bank_statement | pl | balance_sheet | cashflow | audit_report | board_pack | usali_workings | tax_filing
  period_year   int,
  period_month  int CHECK (period_month BETWEEN 1 AND 12),
  is_locked     boolean DEFAULT false,
  notes         text
);
CREATE INDEX IF NOT EXISTS idx_fin_docs_period ON docs.financial_docs(period_year, period_month);

-- ---------------------------------------------------------------------
-- 3. CROSS-CUTTING
-- ---------------------------------------------------------------------

-- Versions (immutable history)
CREATE TABLE IF NOT EXISTS docs.versions (
  id              bigserial PRIMARY KEY,
  doc_id          uuid NOT NULL REFERENCES docs.documents(doc_id) ON DELETE CASCADE,
  version         int NOT NULL,
  storage_bucket  text,
  storage_path    text,
  external_url    text,
  body_markdown   text,
  file_size_bytes bigint,
  change_note     text,
  diff_summary    text,
  uploaded_by     uuid REFERENCES auth.users(id),
  uploaded_at     timestamptz DEFAULT now(),
  UNIQUE (doc_id, version)
);

-- Acknowledgments (read receipt / training proof)
CREATE TABLE IF NOT EXISTS docs.acknowledgments (
  id              bigserial PRIMARY KEY,
  doc_id          uuid NOT NULL REFERENCES docs.documents(doc_id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_version     int,
  acknowledged_at timestamptz DEFAULT now(),
  quiz_score      numeric,
  ip              inet,
  UNIQUE (doc_id, user_id, doc_version)
);

-- Signatures
CREATE TABLE IF NOT EXISTS docs.signatures (
  id                bigserial PRIMARY KEY,
  doc_id            uuid NOT NULL REFERENCES docs.documents(doc_id) ON DELETE CASCADE,
  signer_user_id    uuid REFERENCES auth.users(id),
  signer_email      text,
  signer_name       text,
  signed_at         timestamptz DEFAULT now(),
  ip                inet,
  signature_method  text,                          -- docusign | drawn | typed | clickwrap | wet_then_scan
  signature_payload jsonb,
  external_envelope_id text                        -- DocuSign / SignWell envelope ID
);

-- Expiry alerts
CREATE TABLE IF NOT EXISTS docs.expiry_alerts (
  id                  bigserial PRIMARY KEY,
  doc_id              uuid NOT NULL REFERENCES docs.documents(doc_id) ON DELETE CASCADE,
  alert_at            date NOT NULL,
  days_before_expiry  int,
  recipients          uuid[] DEFAULT '{}'::uuid[],
  status              text DEFAULT 'pending' CHECK (status IN ('pending','sent','acknowledged','cancelled')),
  sent_at             timestamptz,
  notes               text
);
CREATE INDEX IF NOT EXISTS idx_expiry_pending ON docs.expiry_alerts(alert_at) WHERE status = 'pending';

-- Polymorphic links (one doc → many entities)
CREATE TABLE IF NOT EXISTS docs.links (
  id           bigserial PRIMARY KEY,
  doc_id       uuid NOT NULL REFERENCES docs.documents(doc_id) ON DELETE CASCADE,
  entity_type  text NOT NULL,                      -- reservation | guest | room | vendor | dept | sop | proposal | task | etc
  entity_id    text NOT NULL,                      -- text to accommodate Cloudbeds string IDs and uuids
  relation     text DEFAULT 'related',             -- related | source | evidence | parent | child
  created_at   timestamptz DEFAULT now(),
  UNIQUE (doc_id, entity_type, entity_id, relation)
);
CREATE INDEX IF NOT EXISTS idx_doc_links_entity ON docs.links(entity_type, entity_id);

-- Access log (sensitive doc audit)
CREATE TABLE IF NOT EXISTS docs.access_log (
  id          bigserial PRIMARY KEY,
  doc_id      uuid NOT NULL REFERENCES docs.documents(doc_id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id),
  action      text NOT NULL CHECK (action IN ('view','download','print','share','copy_link')),
  at          timestamptz DEFAULT now(),
  ip          inet,
  user_agent  text
);
CREATE INDEX IF NOT EXISTS idx_doc_access_at ON docs.access_log(doc_id, at DESC);

-- External shares (magic link)
CREATE TABLE IF NOT EXISTS docs.shares (
  id                bigserial PRIMARY KEY,
  doc_id            uuid NOT NULL REFERENCES docs.documents(doc_id) ON DELETE CASCADE,
  shared_with_email text,
  magic_token       text UNIQUE NOT NULL,
  permissions       text[] DEFAULT '{view}'::text[],
  expires_at        timestamptz,
  used_at           timestamptz,
  used_count        int DEFAULT 0,
  revoked_at        timestamptz,
  created_by        uuid REFERENCES auth.users(id),
  created_at        timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_doc_shares_token ON docs.shares(magic_token) WHERE revoked_at IS NULL;

-- Collections / folders
CREATE TABLE IF NOT EXISTS docs.collections (
  collection_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id    bigint REFERENCES public.hotels(property_id),
  name           text NOT NULL,
  description    text,
  parent_collection_id uuid REFERENCES docs.collections(collection_id),
  is_smart       boolean DEFAULT false,            -- if true, populated by query
  smart_query    jsonb,
  owner_user_id  uuid REFERENCES auth.users(id),
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS docs.collection_items (
  collection_id uuid NOT NULL REFERENCES docs.collections(collection_id) ON DELETE CASCADE,
  doc_id        uuid NOT NULL REFERENCES docs.documents(doc_id) ON DELETE CASCADE,
  sort_order    int DEFAULT 100,
  added_by      uuid REFERENCES auth.users(id),
  added_at      timestamptz DEFAULT now(),
  PRIMARY KEY (collection_id, doc_id)
);

-- Controlled vocabulary tags (optional layer above text[] tags)
CREATE TABLE IF NOT EXISTS docs.tag_catalog (
  tag_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text UNIQUE NOT NULL,
  name        text NOT NULL,
  name_lo     text,
  parent_tag_id uuid REFERENCES docs.tag_catalog(tag_id),
  color       text,
  is_system   boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 4. updated_at triggers (collections)
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_collections_updated ON docs.collections;
CREATE TRIGGER trg_collections_updated BEFORE UPDATE ON docs.collections
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- ---------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------
ALTER TABLE docs.documents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs.legal_meta         ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs.compliance_meta    ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs.insurance_meta     ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs.meeting_notes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs.templates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs.kb_articles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs.hr_docs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs.guest_docs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs.vendor_docs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs.financial_docs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs.versions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs.acknowledgments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs.signatures         ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs.expiry_alerts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs.links              ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs.access_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs.shares             ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs.collections        ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs.collection_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs.tag_catalog        ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 6. Grants
-- ---------------------------------------------------------------------
GRANT USAGE ON SCHEMA docs TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA docs TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA docs TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA docs TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA docs GRANT SELECT ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA docs GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA docs GRANT ALL ON SEQUENCES TO service_role;

COMMENT ON TABLE docs.documents IS 'Universal document store. Type-specific fields live in extension tables.';
COMMENT ON TABLE docs.links IS 'Polymorphic links: one document can attach to many entities.';
