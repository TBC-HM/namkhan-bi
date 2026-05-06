-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505125843
-- Name:    drop_duplicate_indexes_docs_documents_2026_05_05
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Audit finding 2026-05-05: docs.documents has 6 pairs of byte-identical indexes.
-- The idx_docs_* set is redundant (older naming); the docs_* set is canonical.
-- Verified definitions match exactly via pg_indexes.indexdef before drop.
-- Reversal: re-create using the same DDL captured in the audit report.

DROP INDEX IF EXISTS docs.idx_docs_external_party;
DROP INDEX IF EXISTS docs.idx_docs_checksum;
DROP INDEX IF EXISTS docs.idx_docs_valid_until;
DROP INDEX IF EXISTS docs.idx_docs_keywords;
DROP INDEX IF EXISTS docs.idx_docs_search;
DROP INDEX IF EXISTS docs.idx_docs_tags;
