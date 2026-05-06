-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504133807
-- Name:    docs_language_check_extend
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Extend language allowlist to match classifier output (and common languages
-- we may legitimately encounter: Spanish for Spain rollout, German for owner,
-- Italian/Chinese for guest docs).
ALTER TABLE docs.documents DROP CONSTRAINT IF EXISTS documents_language_check;
ALTER TABLE docs.documents ADD CONSTRAINT documents_language_check
  CHECK (language IN ('lo','en','fr','th','vi','es','de','it','zh','ja','ko','multi','mixed'));
COMMENT ON CONSTRAINT documents_language_check ON docs.documents IS
  'Extended 2026-05-04: added es/de/it/zh/ja/ko/mixed alongside originals to match v1 classifier output.';
