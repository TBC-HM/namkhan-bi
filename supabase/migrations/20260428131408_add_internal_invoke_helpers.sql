-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260428131408
-- Name:    add_internal_invoke_helpers
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Store project URL + anon key in vault so we can call edge function from pg_cron
-- (Service role isn't safe to put here; anon key + verify_jwt=false on edge func is sufficient)

-- These need to be inserted by the user with the actual values via Supabase dashboard
-- For now, create them as empty entries that need to be set
DO $$
BEGIN
  -- Project URL
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'SUPABASE_PROJECT_URL') THEN
    PERFORM vault.create_secret('https://kpenyneooigsyuuomgct.supabase.co', 'SUPABASE_PROJECT_URL', 'Project URL for self-invocation');
  END IF;
END $$;

-- Helper function to invoke the sync-cloudbeds edge function with a given scope
CREATE OR REPLACE FUNCTION public.invoke_sync(p_scope text DEFAULT 'all', p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_url text;
  v_key text;
  v_request_id bigint;
  v_body jsonb;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_PROJECT_URL';
  IF v_url IS NULL THEN
    RAISE EXCEPTION 'SUPABASE_PROJECT_URL not set in vault';
  END IF;
  
  v_body := jsonb_build_object('scope', p_scope) || COALESCE(p_payload, '{}'::jsonb);
  
  SELECT net.http_post(
    url := v_url || '/functions/v1/sync-cloudbeds',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := v_body,
    timeout_milliseconds := 150000
  ) INTO v_request_id;
  
  RETURN v_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.invoke_sync(text, jsonb) TO postgres, service_role;
