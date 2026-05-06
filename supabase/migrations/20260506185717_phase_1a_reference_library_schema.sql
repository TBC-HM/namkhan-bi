-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260506185717
-- Name:    phase_1a_reference_library_schema
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Phase 1A — reference_library schema (3 tables + RLS).
-- Purpose: external system docs pillar (Cloudbeds, Make, Supabase, GitHub, Vercel, Anthropic, etc).
-- Author: PBS via Claude (Cowork) · 2026-05-06.

-- Enums (drop if exist for idempotency)
DO $$ BEGIN
  CREATE TYPE public.reference_category_enum AS ENUM ('pms','automation','infra','ai','devtool','finance','ota','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.reference_source_type_enum AS ENUM ('official_docs','api_reference','blog','forum','video','internal_note');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.reference_status_enum AS ENUM ('active','deprecated','replaced','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. reference_sources
CREATE TABLE IF NOT EXISTS public.reference_sources (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_name                 TEXT NOT NULL,
  category                    public.reference_category_enum NOT NULL,
  canonical_url               TEXT NOT NULL,
  source_type                 public.reference_source_type_enum NOT NULL DEFAULT 'official_docs',
  is_official                 BOOLEAN NOT NULL DEFAULT TRUE,
  subscription_tier           TEXT,
  credentials_location        TEXT,
  owner_agent                 TEXT,
  added_by                    TEXT NOT NULL,
  added_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_verified_at            TIMESTAMPTZ,
  staleness_days_threshold    INT NOT NULL DEFAULT 90,
  status                      public.reference_status_enum NOT NULL DEFAULT 'active',
  replaced_by_id              UUID REFERENCES public.reference_sources(id),
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reference_sources_system_name_key UNIQUE (system_name)
);

CREATE INDEX IF NOT EXISTS idx_reference_sources_category ON public.reference_sources(category);
CREATE INDEX IF NOT EXISTS idx_reference_sources_status ON public.reference_sources(status);
CREATE INDEX IF NOT EXISTS idx_reference_sources_stale ON public.reference_sources(last_verified_at) WHERE status = 'active';

-- 2. reference_entries
CREATE TABLE IF NOT EXISTS public.reference_entries (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id                   UUID NOT NULL REFERENCES public.reference_sources(id) ON DELETE CASCADE,
  topic                       TEXT NOT NULL,
  url                         TEXT NOT NULL,
  summary                     TEXT,
  key_facts                   JSONB DEFAULT '{}'::jsonb,
  last_fetched_at             TIMESTAMPTZ,
  last_verified_at            TIMESTAMPTZ,
  verified_by                 TEXT,
  content_snapshot            TEXT,
  tags                        TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reference_entries_source ON public.reference_entries(source_id);
CREATE INDEX IF NOT EXISTS idx_reference_entries_tags ON public.reference_entries USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_reference_entries_topic ON public.reference_entries(topic);

-- 3. reference_audit_log
CREATE TABLE IF NOT EXISTS public.reference_audit_log (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type                 TEXT NOT NULL,
  source_id                   UUID REFERENCES public.reference_sources(id) ON DELETE SET NULL,
  entry_id                    UUID REFERENCES public.reference_entries(id) ON DELETE SET NULL,
  agent                       TEXT NOT NULL,
  timestamp                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  details                     JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_reference_audit_timestamp ON public.reference_audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_reference_audit_agent ON public.reference_audit_log(agent);

-- RLS
ALTER TABLE public.reference_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_audit_log ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS by Postgres default — explicit policies for anon/auth.
-- ai_agent role doesn't exist as a DB role today (deferred per ADR 0004); for now,
-- service_role is the only writer. RLS denies all by default — that's the desired posture.

-- Allow authenticated SELECT (cockpit page reads)
CREATE POLICY "ref_sources_select_auth" ON public.reference_sources FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "ref_entries_select_auth" ON public.reference_entries FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "ref_audit_select_auth"   ON public.reference_audit_log FOR SELECT TO authenticated USING (TRUE);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS tg_reference_sources_updated_at ON public.reference_sources;
CREATE TRIGGER tg_reference_sources_updated_at BEFORE UPDATE ON public.reference_sources
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS tg_reference_entries_updated_at ON public.reference_entries;
CREATE TRIGGER tg_reference_entries_updated_at BEFORE UPDATE ON public.reference_entries
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- DELETE prevention trigger (per spec — "DELETE forbidden — use status flip")
CREATE OR REPLACE FUNCTION public.tg_prevent_reference_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
BEGIN
  IF current_setting('role', TRUE) NOT IN ('postgres','supabase_admin','service_role') THEN
    RAISE EXCEPTION 'Hard DELETE forbidden on %. Use status flip (deprecated/replaced/archived).', TG_TABLE_NAME;
  END IF;
  RETURN OLD;
END
$fn$;

DROP TRIGGER IF EXISTS tg_reference_sources_no_delete ON public.reference_sources;
CREATE TRIGGER tg_reference_sources_no_delete BEFORE DELETE ON public.reference_sources
  FOR EACH ROW EXECUTE FUNCTION public.tg_prevent_reference_delete();

DROP TRIGGER IF EXISTS tg_reference_entries_no_delete ON public.reference_entries;
CREATE TRIGGER tg_reference_entries_no_delete BEFORE DELETE ON public.reference_entries
  FOR EACH ROW EXECUTE FUNCTION public.tg_prevent_reference_delete();