-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503153708
-- Name:    agent_secrets_storage_location_columns
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Extend agent_secrets to track non-Vault storage locations (Edge Function Secrets, Vercel env, etc.)
ALTER TABLE governance.agent_secrets
  ADD COLUMN IF NOT EXISTS storage_location text 
    DEFAULT 'vault',
  ADD COLUMN IF NOT EXISTS secret_name text,
  ADD COLUMN IF NOT EXISTS rotation_due_at date,
  ADD COLUMN IF NOT EXISTS last_rotated_at date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agent_secrets_storage_location_check'
  ) THEN
    ALTER TABLE governance.agent_secrets
      ADD CONSTRAINT agent_secrets_storage_location_check
      CHECK (storage_location IN ('vault', 'edge_function_secret', 'vercel_env', 'external'));
  END IF;
END$$;

COMMENT ON COLUMN governance.agent_secrets.storage_location IS 'Where the actual secret value lives. vault_secret_id is null when storage_location != vault.';
COMMENT ON COLUMN governance.agent_secrets.secret_name IS 'Name of the secret in its storage location (e.g. NIMBLE_API_KEY for edge_function_secret).';
COMMENT ON COLUMN governance.agent_secrets.rotation_due_at IS 'Date by which this secret should be rotated. Used by governance reminders.';
