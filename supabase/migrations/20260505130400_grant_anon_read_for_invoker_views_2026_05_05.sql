-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505130400
-- Name:    grant_anon_read_for_invoker_views_2026_05_05
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Audit finding 2026-05-05 follow-up: After flipping 214 views to security_invoker,
-- the anon role lost access to views in schemas where prior `grant_anon_read` migrations
-- had not been applied (kpi, fa, inv, proc, suppliers, catalog, parts of dq).
-- The dashboard authenticates as anon (NEXT_PUBLIC_SUPABASE_ANON_KEY) and accesses
-- multiple schemas via PostgREST `.schema()` calls.
--
-- This restores read access for analytical schemas. RLS still applies on underlying
-- tables — if those tables are restrictive, anon will still be blocked. For now most
-- public.* tables have open RLS so the practical effect is: dashboard keeps working.
--
-- Reversal: REVOKE USAGE/SELECT on each schema/sequence/view from anon.

DO $$
DECLARE
  s TEXT;
  schemas TEXT[] := ARRAY['kpi','fa','inv','proc','suppliers','catalog','dq','revenue'];
BEGIN
  FOREACH s IN ARRAY schemas LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO anon, authenticated', s);
    EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA %I TO anon, authenticated', s);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT ON TABLES TO anon, authenticated', s);
  END LOOP;
END $$;

-- Reload PostgREST so it picks up new grants
NOTIFY pgrst, 'reload config';
