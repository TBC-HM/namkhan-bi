-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504004821
-- Name:    docs_documents_file_checksum_index
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Speed up dedup lookup. NOT a unique constraint on its own — same file may be
-- legitimately uploaded under different titles in some workflows. We dedup at the
-- API layer (any existing row with same checksum → skip + return that row).
CREATE INDEX IF NOT EXISTS docs_documents_file_checksum_idx
  ON docs.documents (file_checksum)
  WHERE file_checksum IS NOT NULL;
