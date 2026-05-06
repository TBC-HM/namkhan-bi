-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260429213808
-- Name:    phase1_09_docs_filename
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- =====================================================================
-- Phase 1.9 — Add explicit file_name + file_url + checksum + page_count
-- =====================================================================

ALTER TABLE docs.documents
  ADD COLUMN IF NOT EXISTS file_name      text,            -- original filename: "lao_business_license_2026.pdf"
  ADD COLUMN IF NOT EXISTS file_url       text,            -- public or signed URL (cached; null when private + no signed url generated)
  ADD COLUMN IF NOT EXISTS file_checksum  text,            -- sha256 to detect duplicates / tampering
  ADD COLUMN IF NOT EXISTS page_count     int,             -- for PDFs
  ADD COLUMN IF NOT EXISTS thumbnail_path text;            -- preview image in same/another bucket

-- A doc must end up either pointing somewhere or being inline markdown
ALTER TABLE docs.documents
  ADD CONSTRAINT chk_doc_has_content
  CHECK (
       storage_path  IS NOT NULL
    OR external_url  IS NOT NULL
    OR body_markdown IS NOT NULL
  ) NOT VALID;   -- NOT VALID = won't fail on existing rows; new inserts must comply

-- Helper view: every doc with its computed download URL
-- For public buckets: /storage/v1/object/public/{bucket}/{path}
-- For private: frontend must generate a signed URL via Supabase JS client
CREATE OR REPLACE VIEW docs.v_documents_resolved AS
SELECT
  d.*,
  CASE
    WHEN d.external_url IS NOT NULL THEN d.external_url
    WHEN d.storage_bucket IS NOT NULL AND d.storage_path IS NOT NULL AND b.public = true
      THEN 'https://kpenyneooigsyuuomgct.supabase.co/storage/v1/object/public/' || d.storage_bucket || '/' || d.storage_path
    WHEN d.storage_bucket IS NOT NULL AND d.storage_path IS NOT NULL AND b.public = false
      THEN '[private:signed-url-required]'
    ELSE NULL
  END AS resolved_url,
  b.public AS bucket_is_public
FROM docs.documents d
LEFT JOIN storage.buckets b ON b.id = d.storage_bucket;

GRANT SELECT ON docs.v_documents_resolved TO authenticated, anon;

-- Update search_tsv to include file_name as well
CREATE OR REPLACE FUNCTION docs.documents_search_tsv() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_tsv :=
       setweight(to_tsvector('simple', coalesce(NEW.title,'')),                    'A')
    || setweight(to_tsvector('simple', coalesce(NEW.title_lo,'')),                  'A')
    || setweight(to_tsvector('simple', coalesce(NEW.title_fr,'')),                  'A')
    || setweight(to_tsvector('simple', array_to_string(NEW.keywords,' ')),          'A')
    || setweight(to_tsvector('simple', coalesce(NEW.file_name,'')),                 'A')
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

CREATE INDEX IF NOT EXISTS idx_docs_file_name ON docs.documents(file_name);
CREATE INDEX IF NOT EXISTS idx_docs_checksum  ON docs.documents(file_checksum) WHERE file_checksum IS NOT NULL;

COMMENT ON COLUMN docs.documents.file_name IS 'Original uploaded filename (e.g., business_license_2026.pdf). Searchable.';
COMMENT ON COLUMN docs.documents.storage_bucket IS 'Supabase Storage bucket id (one of: documents-public/internal/confidential/restricted).';
COMMENT ON COLUMN docs.documents.storage_path IS 'Path within bucket. Convention: {property_id}/{doc_type}/{year}/{file_name}';
COMMENT ON COLUMN docs.documents.file_url IS 'Cached public or signed URL. Regenerate signed URLs as needed.';
COMMENT ON COLUMN docs.documents.external_url IS 'Use when file lives in Drive / Dropbox / external host. Mutually exclusive with storage_path in practice.';
COMMENT ON COLUMN docs.documents.file_checksum IS 'sha256 of file. Detects duplicates and tampering.';
COMMENT ON VIEW docs.v_documents_resolved IS 'Documents with computed download URL. Public buckets resolve directly; private require signed URL from frontend.';
