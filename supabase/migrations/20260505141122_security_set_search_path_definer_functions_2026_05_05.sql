-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505141122
-- Name:    security_set_search_path_definer_functions_2026_05_05
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Lock down search_path on SECURITY DEFINER functions to prevent search_path
-- injection attacks. Without this, an attacker who can create objects in any
-- schema reachable via search_path could shadow built-in functions and
-- trick the SECURITY DEFINER function into calling their malicious version.

-- These three are auth/role checks - most critical
ALTER FUNCTION app.has_role(text[]) SET search_path = pg_catalog, public;
ALTER FUNCTION app.is_top_level() SET search_path = pg_catalog, public;
ALTER FUNCTION app.my_dept_codes() SET search_path = pg_catalog, public;

-- Web capture functions
ALTER FUNCTION web.capture_lead(text, text, text, uuid, text[], text, text, jsonb) 
  SET search_path = pg_catalog, public, web;
ALTER FUNCTION web.track_event(text, text, uuid, uuid, uuid, numeric, jsonb, text, text, text, text) 
  SET search_path = pg_catalog, public, web;
