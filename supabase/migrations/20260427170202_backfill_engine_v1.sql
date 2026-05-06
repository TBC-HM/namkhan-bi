-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427170202
-- Name:    backfill_engine_v1
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ============================================================================
-- BACKFILL ENGINE — pure pg_net + Postgres
-- ============================================================================

-- Helper: get auth header
CREATE OR REPLACE FUNCTION cb_auth_header() RETURNS jsonb AS $$
  SELECT jsonb_build_object(
    'Authorization', 'Bearer ' || decrypted_secret
  )
  FROM vault.decrypted_secrets WHERE name = 'CLOUDBEDS_API_KEY';
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper: trigger a Cloudbeds GET request via pg_net, return request_id
CREATE OR REPLACE FUNCTION cb_get(p_url text)
RETURNS bigint AS $$
DECLARE
  rid bigint;
BEGIN
  SELECT net.http_get(
    url := p_url,
    headers := cb_auth_header(),
    timeout_milliseconds := 60000
  ) INTO rid;
  RETURN rid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: poll for response (up to 30s)
CREATE OR REPLACE FUNCTION cb_get_response(p_request_id bigint, p_timeout_s int DEFAULT 30)
RETURNS jsonb AS $$
DECLARE
  resp jsonb;
  waited int := 0;
BEGIN
  WHILE waited < p_timeout_s LOOP
    SELECT content::jsonb INTO resp 
    FROM net._http_response 
    WHERE id = p_request_id AND status_code IS NOT NULL;
    
    IF resp IS NOT NULL THEN
      RETURN resp;
    END IF;
    
    PERFORM pg_sleep(1);
    waited := waited + 1;
  END LOOP;
  RAISE EXCEPTION 'Timeout waiting for request %', p_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: synchronous GET (fire + wait)
CREATE OR REPLACE FUNCTION cb_call(p_url text)
RETURNS jsonb AS $$
DECLARE
  rid bigint;
BEGIN
  rid := cb_get(p_url);
  RETURN cb_get_response(rid, 60);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
