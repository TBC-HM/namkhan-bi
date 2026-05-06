-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505171540
-- Name:    b11_install_pgvector_2026_05_05
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- B11: Install pgvector extension. Knowledge agent and any future RAG/embedding work needs it.
-- Install in extensions schema (not public, per Supabase best practice)
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
COMMENT ON EXTENSION vector IS 'Vector similarity search (pgvector). Used by knowledge agent and embedding-based features.';