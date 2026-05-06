-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260428132405
-- Name:    add_get_secret_rpc
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Expose a controlled way for the service role to fetch a vault secret
-- (only callable by service_role, only for the names we whitelist)
CREATE OR REPLACE FUNCTION public.get_secret(p_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
DECLARE
  v_value text;
BEGIN
  -- Whitelist
  IF p_name NOT IN ('CLOUDBEDS_API_KEY') THEN
    RAISE EXCEPTION 'Secret name not in whitelist';
  END IF;

  SELECT decrypted_secret INTO v_value
  FROM vault.decrypted_secrets
  WHERE name = p_name
  LIMIT 1;

  RETURN v_value;
END;
$$;

REVOKE ALL ON FUNCTION public.get_secret(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_secret(text) TO service_role;
