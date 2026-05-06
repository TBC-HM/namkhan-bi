-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260429212954
-- Name:    phase1_08_docs_metadata_extras
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- =====================================================================
-- Phase 1.8 — Docs metadata extras (keywords, project, parties, summary, period, cost_center)
-- Plus: extend search_tsv to include keywords + parties for find-by-name search
-- =====================================================================

ALTER TABLE docs.documents
  ADD COLUMN IF NOT EXISTS keywords        text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS project         text,
  ADD COLUMN IF NOT EXISTS parties         jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS external_party  text,                    -- quick lookup: lawyer / vendor / counterparty name
  ADD COLUMN IF NOT EXISTS summary         text,                    -- one-line summary for list views
  ADD COLUMN IF NOT EXISTS period_year     int,
  ADD COLUMN IF NOT EXISTS cost_center     text,
  ADD COLUMN IF NOT EXISTS reference_number text,                   -- contract no, license no, policy no
  ADD COLUMN IF NOT EXISTS amount          numeric,                  -- contract value / premium / fee
  ADD COLUMN IF NOT EXISTS amount_currency text;

CREATE INDEX IF NOT EXISTS idx_docs_keywords     ON docs.documents USING gin(keywords);
CREATE INDEX IF NOT EXISTS idx_docs_project      ON docs.documents(project);
CREATE INDEX IF NOT EXISTS idx_docs_external_party ON docs.documents(external_party);
CREATE INDEX IF NOT EXISTS idx_docs_period_year  ON docs.documents(period_year);
CREATE INDEX IF NOT EXISTS idx_docs_parties      ON docs.documents USING gin(parties);

-- Update search_tsv to include keywords + external_party + project + summary
CREATE OR REPLACE FUNCTION docs.documents_search_tsv() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_tsv :=
       setweight(to_tsvector('simple', coalesce(NEW.title,'')),                    'A')
    || setweight(to_tsvector('simple', coalesce(NEW.title_lo,'')),                  'A')
    || setweight(to_tsvector('simple', coalesce(NEW.title_fr,'')),                  'A')
    || setweight(to_tsvector('simple', array_to_string(NEW.keywords,' ')),          'A')
    || setweight(to_tsvector('simple', coalesce(NEW.external_party,'')),            'B')
    || setweight(to_tsvector('simple', coalesce(NEW.project,'')),                   'B')
    || setweight(to_tsvector('simple', array_to_string(NEW.tags,' ')),              'B')
    || setweight(to_tsvector('simple', coalesce(NEW.summary,'')),                   'C')
    || setweight(to_tsvector('simple', coalesce(NEW.doc_subtype,'')),               'C')
    || setweight(to_tsvector('simple', coalesce(NEW.reference_number,'')),          'C')
    || setweight(to_tsvector('simple', coalesce(NEW.body_markdown,'')),             'D');
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Re-trigger to backfill search_tsv on existing rows
UPDATE docs.documents SET updated_at = updated_at;

COMMENT ON COLUMN docs.documents.keywords IS 'Free-form searchable keywords. Tags = categorical, keywords = open vocabulary.';
COMMENT ON COLUMN docs.documents.parties IS 'jsonb: {from:{}, to:[], cc:[], signed_by:[]} — names, roles, emails of parties involved.';
COMMENT ON COLUMN docs.documents.external_party IS 'Single denormalized counterparty name for fast filter (lawyer firm, vendor, OTA, authority).';
