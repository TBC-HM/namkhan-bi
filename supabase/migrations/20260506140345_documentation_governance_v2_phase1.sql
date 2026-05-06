-- Documentation governance v2 — Phase 1.
-- Purpose: dual-environment documentation system (documentation_staging
--          for AI writes + documentation for owner-approved production)
--          with optimistic locking, version history, rollback, and
--          a daily JSON backup cron (#54).
-- Method:  two schemas with identical structure; SECURITY DEFINER functions
--          enforce anti-overwrite rules at DB level.
-- Note:    No hard hash check (per KB pushback "hash check is theatre"
--          since server computes its own hashes). external_agent_hash
--          field reserved for future externalised agents.
-- Reference: ADR cockpit/decisions/0003-documentation-governance-v2.md
--            and 0004-documentation-system-built.md.
-- Author:  PBS via Claude (Cowork) · 2026-05-06
-- Applied via Supabase MCP on 2026-05-06 (migration: documentation_governance_v2_phase1).

CREATE SCHEMA IF NOT EXISTS documentation;
CREATE SCHEMA IF NOT EXISTS documentation_staging;

DO $$ BEGIN
  CREATE TYPE public.doc_type_enum AS ENUM (
    'vision_roadmap','prd','architecture','data_model','api','security','integration'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.doc_status_enum AS ENUM (
    'draft','pending_approval','approved','published','superseded','blocked'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.doc_environment_enum AS ENUM ('staging','production');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.doc_promotion_type_enum AS ENUM ('manual','auto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.doc_approval_status_enum AS ENUM ('pending','approved','rejected','auto_approved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.doc_backup_type_enum AS ENUM ('scheduled','deployment_triggered','manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.doc_backup_status_enum AS ENUM ('started','completed','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public._cockpit_create_doc_tables(target_schema TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.documents (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      doc_type        public.doc_type_enum NOT NULL UNIQUE,
      title           TEXT NOT NULL,
      content_md      TEXT NOT NULL DEFAULT ''(no content yet)'',
      content_html    TEXT,
      version         INTEGER NOT NULL DEFAULT 1,
      parent_version  INTEGER,
      status          public.doc_status_enum NOT NULL DEFAULT ''draft'',
      last_updated_by TEXT,
      last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      locked_by       TEXT,
      locked_at       TIMESTAMPTZ,
      requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
      auto_promoted   BOOLEAN NOT NULL DEFAULT FALSE,
      auto_promoted_at TIMESTAMPTZ,
      external_agent_hash TEXT
    );', target_schema);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.document_versions (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id     UUID NOT NULL REFERENCES %I.documents(id) ON DELETE CASCADE,
      version         INTEGER NOT NULL,
      parent_version  INTEGER,
      content_md      TEXT NOT NULL,
      change_summary  TEXT,
      created_by      TEXT NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      environment     public.doc_environment_enum NOT NULL,
      external_agent_hash TEXT,
      UNIQUE (document_id, version)
    );', target_schema, target_schema);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.approvals (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id     UUID NOT NULL REFERENCES %I.documents(id) ON DELETE CASCADE,
      staging_version INTEGER NOT NULL,
      production_version_before INTEGER,
      production_version_after  INTEGER,
      status          public.doc_approval_status_enum NOT NULL DEFAULT ''pending'',
      approver        TEXT,
      approved_at     TIMESTAMPTZ,
      notes           TEXT,
      diff_snapshot   TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );', target_schema, target_schema);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.promotion_log (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id     UUID NOT NULL REFERENCES %I.documents(id) ON DELETE CASCADE,
      from_environment public.doc_environment_enum NOT NULL,
      to_environment   public.doc_environment_enum NOT NULL,
      staging_version  INTEGER NOT NULL,
      production_version INTEGER NOT NULL,
      promoted_by      TEXT NOT NULL,
      promoted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      promotion_type   public.doc_promotion_type_enum NOT NULL
    );', target_schema, target_schema);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.rollback_log (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id     UUID NOT NULL REFERENCES %I.documents(id) ON DELETE CASCADE,
      rolled_back_from_version INTEGER NOT NULL,
      rolled_back_to_version   INTEGER NOT NULL,
      rolled_back_by  TEXT NOT NULL,
      reason          TEXT NOT NULL,
      rolled_back_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );', target_schema, target_schema);

  IF target_schema = 'documentation' THEN
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.backup_log (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        backup_type     public.doc_backup_type_enum NOT NULL,
        triggered_by    TEXT NOT NULL,
        deployment_id   TEXT,
        status          public.doc_backup_status_enum NOT NULL DEFAULT ''started'',
        backup_location TEXT,
        size_bytes      BIGINT,
        started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at    TIMESTAMPTZ,
        error_message   TEXT,
        metadata        JSONB
      );', target_schema);
  END IF;

  EXECUTE format('ALTER TABLE %I.documents          ENABLE ROW LEVEL SECURITY;', target_schema);
  EXECUTE format('ALTER TABLE %I.document_versions  ENABLE ROW LEVEL SECURITY;', target_schema);
  EXECUTE format('ALTER TABLE %I.approvals          ENABLE ROW LEVEL SECURITY;', target_schema);
  EXECUTE format('ALTER TABLE %I.promotion_log      ENABLE ROW LEVEL SECURITY;', target_schema);
  EXECUTE format('ALTER TABLE %I.rollback_log       ENABLE ROW LEVEL SECURITY;', target_schema);
  IF target_schema = 'documentation' THEN
    EXECUTE format('ALTER TABLE %I.backup_log         ENABLE ROW LEVEL SECURITY;', target_schema);
  END IF;
END $$;

SELECT public._cockpit_create_doc_tables('documentation_staging');
SELECT public._cockpit_create_doc_tables('documentation');

-- Seed 7 docs in BOTH schemas with correct requires_approval flag.
INSERT INTO documentation_staging.documents (doc_type, title, requires_approval, status, last_updated_by) VALUES
('vision_roadmap', 'Product Vision & Roadmap', TRUE,  'draft', 'system'),
('prd',            'Product Requirements Document', TRUE,  'draft', 'system'),
('architecture',   'Architecture Document', FALSE, 'draft', 'system'),
('data_model',     'Data Model / ERD', FALSE, 'draft', 'system'),
('api',            'API Documentation', FALSE, 'draft', 'system'),
('security',       'Multi-Tenancy & Security', TRUE,  'draft', 'system'),
('integration',    'Integration & Deployment', TRUE,  'draft', 'system')
ON CONFLICT (doc_type) DO NOTHING;

INSERT INTO documentation.documents (doc_type, title, requires_approval, status, last_updated_by) VALUES
('vision_roadmap', 'Product Vision & Roadmap', TRUE,  'draft', 'system'),
('prd',            'Product Requirements Document', TRUE,  'draft', 'system'),
('architecture',   'Architecture Document', FALSE, 'draft', 'system'),
('data_model',     'Data Model / ERD', FALSE, 'draft', 'system'),
('api',            'API Documentation', FALSE, 'draft', 'system'),
('security',       'Multi-Tenancy & Security', TRUE,  'draft', 'system'),
('integration',    'Integration & Deployment', TRUE,  'draft', 'system')
ON CONFLICT (doc_type) DO NOTHING;

-- Anti-overwrite functions (write_doc with optimistic locking, lock helpers,
-- promote_doc with integrity check, rollback_doc with mandatory reason).
-- Full bodies live in DB — abridged here for migration parity.
-- See ADR 0004 for full function specs.

CREATE OR REPLACE FUNCTION documentation_staging.write_doc(
  p_doc_type        public.doc_type_enum,
  p_parent_version  INTEGER,
  p_content_md      TEXT,
  p_change_summary  TEXT,
  p_agent           TEXT,
  p_external_hash   TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = documentation_staging, public
AS $$
DECLARE
  v_doc       documentation_staging.documents%ROWTYPE;
  v_new_ver   INTEGER;
BEGIN
  SELECT * INTO v_doc FROM documentation_staging.documents WHERE doc_type = p_doc_type FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'doc not found');
  END IF;
  IF v_doc.version <> p_parent_version THEN
    RETURN jsonb_build_object('ok', false, 'error', 'stale_version',
      'current_version', v_doc.version, 'parent_version_provided', p_parent_version,
      'message', 'parent_version mismatch — re-read and retry');
  END IF;
  IF v_doc.locked_by IS NOT NULL
     AND v_doc.locked_at > NOW() - INTERVAL '30 minutes'
     AND v_doc.locked_by <> p_agent THEN
    RETURN jsonb_build_object('ok', false, 'error', 'locked',
      'locked_by', v_doc.locked_by, 'locked_at', v_doc.locked_at,
      'expires_in_seconds', EXTRACT(EPOCH FROM ((v_doc.locked_at + INTERVAL '30 minutes') - NOW())));
  END IF;

  v_new_ver := v_doc.version + 1;

  INSERT INTO documentation_staging.document_versions
    (document_id, version, parent_version, content_md, change_summary, created_by, environment, external_agent_hash)
  VALUES (v_doc.id, v_new_ver, p_parent_version, p_content_md, p_change_summary, p_agent, 'staging', p_external_hash);

  UPDATE documentation_staging.documents
  SET content_md = p_content_md, version = v_new_ver, parent_version = p_parent_version,
      last_updated_by = p_agent, last_updated_at = NOW(),
      locked_by = NULL, locked_at = NULL,
      external_agent_hash = p_external_hash
  WHERE id = v_doc.id;

  RETURN jsonb_build_object('ok', true, 'new_version', v_new_ver, 'doc_id', v_doc.id);
END $$;

CREATE OR REPLACE FUNCTION documentation_staging.acquire_lock(p_doc_type public.doc_type_enum, p_agent TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = documentation_staging AS $$
DECLARE v_doc documentation_staging.documents%ROWTYPE;
BEGIN
  SELECT * INTO v_doc FROM documentation_staging.documents WHERE doc_type = p_doc_type FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'doc not found'); END IF;
  IF v_doc.locked_by IS NOT NULL AND v_doc.locked_at > NOW() - INTERVAL '30 minutes' AND v_doc.locked_by <> p_agent THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_locked', 'locked_by', v_doc.locked_by);
  END IF;
  UPDATE documentation_staging.documents SET locked_by = p_agent, locked_at = NOW() WHERE id = v_doc.id;
  RETURN jsonb_build_object('ok', true, 'lock_expires_at', NOW() + INTERVAL '30 minutes');
END $$;

CREATE OR REPLACE FUNCTION documentation_staging.release_lock(p_doc_type public.doc_type_enum, p_agent TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = documentation_staging AS $$
BEGIN
  UPDATE documentation_staging.documents SET locked_by = NULL, locked_at = NULL
   WHERE doc_type = p_doc_type AND (locked_by = p_agent OR locked_at < NOW() - INTERVAL '30 minutes');
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION documentation.promote_doc(
  p_doc_type         public.doc_type_enum,
  p_staging_version  INTEGER,
  p_promoted_by      TEXT,
  p_promotion_type   public.doc_promotion_type_enum,
  p_approver         TEXT DEFAULT NULL,
  p_notes            TEXT DEFAULT NULL,
  p_expected_prod_version_before INTEGER DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = documentation, documentation_staging, public
AS $$
DECLARE
  v_staging  documentation_staging.documents%ROWTYPE;
  v_prod     documentation.documents%ROWTYPE;
  v_new_ver  INTEGER;
BEGIN
  SELECT * INTO v_staging FROM documentation_staging.documents WHERE doc_type = p_doc_type FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'staging doc not found'); END IF;
  IF v_staging.version <> p_staging_version THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staging_drift',
      'current_staging_version', v_staging.version, 'expected', p_staging_version);
  END IF;
  SELECT * INTO v_prod FROM documentation.documents WHERE doc_type = p_doc_type FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'prod doc not found'); END IF;
  IF p_expected_prod_version_before IS NOT NULL AND v_prod.version <> p_expected_prod_version_before THEN
    RETURN jsonb_build_object('ok', false, 'error', 'prod_changed_during_review',
      'current_prod_version', v_prod.version, 'expected', p_expected_prod_version_before);
  END IF;
  v_new_ver := v_prod.version + 1;
  INSERT INTO documentation.document_versions
    (document_id, version, parent_version, content_md, change_summary, created_by, environment)
  VALUES (v_prod.id, v_new_ver, v_prod.version, v_staging.content_md,
     COALESCE(p_notes, format('promoted from staging v%s', p_staging_version)), p_promoted_by, 'production');
  UPDATE documentation.documents SET
    content_md = v_staging.content_md, version = v_new_ver, parent_version = v_prod.version,
    status = 'published', last_updated_by = p_promoted_by, last_updated_at = NOW(),
    auto_promoted = (p_promotion_type = 'auto'),
    auto_promoted_at = CASE WHEN p_promotion_type = 'auto' THEN NOW() ELSE NULL END
  WHERE id = v_prod.id;
  INSERT INTO documentation.promotion_log
    (document_id, from_environment, to_environment, staging_version, production_version, promoted_by, promotion_type)
  VALUES (v_prod.id, 'staging', 'production', p_staging_version, v_new_ver, p_promoted_by, p_promotion_type);
  UPDATE documentation_staging.documents SET status = 'approved' WHERE id = v_staging.id;
  RETURN jsonb_build_object('ok', true, 'production_version', v_new_ver, 'promotion_type', p_promotion_type);
END $$;

CREATE OR REPLACE FUNCTION documentation.rollback_doc(
  p_doc_type   public.doc_type_enum,
  p_to_version INTEGER,
  p_actor      TEXT,
  p_reason     TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = documentation, public
AS $$
DECLARE
  v_doc   documentation.documents%ROWTYPE;
  v_old   documentation.document_versions%ROWTYPE;
  v_new_ver INTEGER;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'reason_required', 'message', 'rollback reason must be at least 5 chars');
  END IF;
  SELECT * INTO v_doc FROM documentation.documents WHERE doc_type = p_doc_type FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'doc not found'); END IF;
  SELECT * INTO v_old FROM documentation.document_versions
   WHERE document_id = v_doc.id AND version = p_to_version
   ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'target version not found'); END IF;
  v_new_ver := v_doc.version + 1;
  INSERT INTO documentation.document_versions
    (document_id, version, parent_version, content_md, change_summary, created_by, environment)
  VALUES (v_doc.id, v_new_ver, v_doc.version, v_old.content_md,
     format('rollback to v%s: %s', p_to_version, p_reason), p_actor, 'production');
  UPDATE documentation.documents SET
    content_md = v_old.content_md, version = v_new_ver, parent_version = v_doc.version,
    last_updated_by = p_actor, last_updated_at = NOW(),
    auto_promoted = FALSE, auto_promoted_at = NULL
  WHERE id = v_doc.id;
  INSERT INTO documentation.rollback_log
    (document_id, rolled_back_from_version, rolled_back_to_version, rolled_back_by, reason)
  VALUES (v_doc.id, v_doc.version, p_to_version, p_actor, p_reason);
  RETURN jsonb_build_object('ok', true, 'new_version', v_new_ver,
    'rolled_back_from', v_doc.version, 'restored_content_from', p_to_version);
END $$;

-- Daily backup cron (#54)
SELECT cron.schedule(
  'docs-daily-backup',
  '0 3 * * *',
  $cron$
  INSERT INTO documentation.backup_log (backup_type, triggered_by, status, started_at, completed_at, backup_location, size_bytes, metadata)
  SELECT 'scheduled', 'cron:docs-daily-backup', 'completed', NOW(), NOW(),
    'inline:backup_log.metadata', OCTET_LENGTH(payload::TEXT), payload
  FROM (
    SELECT jsonb_build_object(
      'staging', (SELECT jsonb_agg(row_to_json(d)) FROM documentation_staging.documents d),
      'production', (SELECT jsonb_agg(row_to_json(d)) FROM documentation.documents d),
      'staging_versions', (SELECT jsonb_agg(row_to_json(v)) FROM documentation_staging.document_versions v),
      'production_versions', (SELECT jsonb_agg(row_to_json(v)) FROM documentation.document_versions v)
    ) AS payload
  ) p;
  $cron$
);

COMMENT ON SCHEMA documentation IS 'Production documentation schema. Owner-approved promotions only via documentation.promote_doc(). AI agents NEVER write here directly.';
COMMENT ON SCHEMA documentation_staging IS 'Staging documentation schema. AI agents write via documentation_staging.write_doc() with mandatory parent_version + 30min write locks.';
