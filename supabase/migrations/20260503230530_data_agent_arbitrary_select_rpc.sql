-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503230530
-- Name:    data_agent_arbitrary_select_rpc
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- RPC for the data agent: executes an arbitrary SELECT and returns rows as jsonb.
-- SECURITY DEFINER so the agent (called by service-role from /api/data/ask) can
-- read across schemas. SQL safety is enforced in /lib/data/sqlGuard.ts before
-- this is ever called. This RPC is NOT granted to anon/authenticated.

CREATE OR REPLACE FUNCTION public.docs_data_query(sql_text text)
RETURNS SETOF jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trimmed text;
BEGIN
  trimmed := lower(btrim(sql_text));
  -- Belt-and-braces: even though /lib/data/sqlGuard.ts already filters,
  -- enforce SELECT-only here too. Reject everything else outright.
  IF NOT (trimmed LIKE 'select%' OR trimmed LIKE 'with%') THEN
    RAISE EXCEPTION 'docs_data_query: SELECT/WITH only';
  END IF;
  IF position(';' in trimmed) > 0 THEN
    RAISE EXCEPTION 'docs_data_query: no semicolons allowed';
  END IF;
  -- Block obvious DDL/DML keywords (case-insensitive)
  IF trimmed ~* '\m(insert|update|delete|drop|truncate|alter|create|grant|revoke|copy|vacuum|analyze|reindex|cluster|reset|do|lock|comment|execute|call)\M' THEN
    RAISE EXCEPTION 'docs_data_query: forbidden keyword detected';
  END IF;

  -- Execute the query and stream rows as jsonb
  RETURN QUERY EXECUTE 'SELECT to_jsonb(t.*) FROM (' || sql_text || ') t';
END $$;

-- Lock down: only service_role may call (NOT exposed to anon/authenticated)
REVOKE ALL ON FUNCTION public.docs_data_query(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.docs_data_query(text) TO service_role;

COMMENT ON FUNCTION public.docs_data_query IS
  'Data agent SELECT executor. Called only by /api/data/ask via service-role. JS-side guard in lib/data/sqlGuard.ts is the primary filter; this is belt-and-braces.';
