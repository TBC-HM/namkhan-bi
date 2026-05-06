-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502191030
-- Name:    gl_phase2_00_extensions
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    RAISE EXCEPTION 'pgcrypto did not install';
  END IF;
END $$;
