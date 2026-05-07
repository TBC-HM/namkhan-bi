-- =============================================================
-- Migration: Immediate ticket processing via DB trigger
-- Ticket: cockpit_chat request (high urgency)
-- Purpose: Eliminate up-to-60s TRIAGING delay by invoking the
--          runner edge-function immediately on ticket INSERT,
--          with idempotency guard and advisory-lock debounce.
-- =============================================================

-- ──────────────────────────────────────────────────────────────
-- ASSUMPTIONS (document in PR review if any differ):
--   1. pg_net extension is enabled (required for http_post).
--      If not, run: CREATE EXTENSION IF NOT EXISTS pg_net;
--   2. Runner is a Supabase Edge Function named "cockpit-runner".
--      Update RUNNER_URL constant below if path differs.
--   3. SUPABASE_SERVICE_ROLE_KEY is stored in vault.secrets
--      as 'service_role_key'. Adjust vault.decrypted_secrets
--      reference if secret name differs.
--   4. Advisory-lock strategy chosen over runner_lock table
--      (lighter weight; no GC needed). Lock key = 55555 (arbitrary).
--   5. Concurrency ceiling of 5-per-tick is enforced by the
--      runner itself; the trigger is fire-and-forget.
--   6. Statuses that qualify for immediate dispatch: 'new' only.
--      Runner must re-check status before acting (idempotency).
-- ──────────────────────────────────────────────────────────────

-- 1. Enable pg_net if not already present
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- 2. Trigger function: invoke runner via pg_net HTTP POST
CREATE OR REPLACE FUNCTION public.trg_fn_notify_runner_on_ticket_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _runner_url  TEXT := current_setting('app.runner_edge_function_url', TRUE);
  _secret      TEXT;
  _lock_key    BIGINT := 55555;
  _lock_taken  BOOLEAN;
BEGIN
  -- Guard: only dispatch for freshly inserted tickets in 'new' status
  IF NEW.status IS DISTINCT FROM 'new' THEN
    RETURN NEW;
  END IF;

  -- Advisory lock: try to acquire a non-blocking session lock.
  -- If another trigger call already holds it (rapid burst), skip —
  -- the cron will catch up within 60s, or the lock holder fires first.
  _lock_taken := pg_try_advisory_xact_lock(_lock_key);
  IF NOT _lock_taken THEN
    -- Lock busy → another concurrent trigger is already dispatching.
    -- Do nothing; idempotency in the runner handles the rest.
    RETURN NEW;
  END IF;

  -- Resolve runner URL: prefer app.runner_edge_function_url GUC,
  -- fall back to constructed Supabase Edge Function URL.
  IF _runner_url IS NULL OR _runner_url = '' THEN
    _runner_url := format(
      'https://%s.functions.supabase.co/cockpit-runner',
      current_setting('app.supabase_project_ref', TRUE)
    );
  END IF;

  -- Fetch service-role key from vault (safe, never exposed in logs)
  BEGIN
    SELECT decrypted_secret
      INTO _secret
      FROM vault.decrypted_secrets
     WHERE name = 'service_role_key'
     LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    -- Vault unavailable → skip HTTP call, cron will cover it
    RAISE WARNING 'trg_fn_notify_runner: vault lookup failed, skipping HTTP dispatch for ticket %', NEW.id;
    RETURN NEW;
  END;

  IF _secret IS NULL THEN
    RAISE WARNING 'trg_fn_notify_runner: service_role_key not found in vault, skipping HTTP dispatch for ticket %', NEW.id;
    RETURN NEW;
  END IF;

  -- Fire-and-forget HTTP POST to runner edge function
  PERFORM extensions.http_post(
    url     := _runner_url,
    body    := json_build_object('ticket_id', NEW.id, 'source', 'db_trigger')::text,
    headers := json_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || _secret
    )::jsonb
  );

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Never let trigger failure block the INSERT
  RAISE WARNING 'trg_fn_notify_runner: unhandled error for ticket %, continuing: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- 3. Attach trigger to cockpit_tickets
DROP TRIGGER IF EXISTS trg_notify_runner_on_ticket_insert ON public.cockpit_tickets;

CREATE TRIGGER trg_notify_runner_on_ticket_insert
  AFTER INSERT ON public.cockpit_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_notify_runner_on_ticket_insert();

-- 4. App GUC defaults (set via ALTER DATABASE or Supabase dashboard)
--    These are documented here; they must be configured manually:
--
--    ALTER DATABASE postgres
--      SET app.runner_edge_function_url = 'https://<ref>.functions.supabase.co/cockpit-runner';
--    ALTER DATABASE postgres
--      SET app.supabase_project_ref = '<your-project-ref>';
--
--    Alternatively, set them in the Supabase dashboard under
--    Project Settings → Database → Connection Pooling → Extra Config.

-- 5. Grant execute to postgres role (service role uses postgres internally)
GRANT EXECUTE ON FUNCTION public.trg_fn_notify_runner_on_ticket_insert() TO postgres;

-- ──────────────────────────────────────────────────────────────
-- IDEMPOTENCY NOTE FOR RUNNER (cockpit-runner edge function):
--   The runner MUST re-fetch ticket status at the start of each
--   invocation and skip processing if status != 'new'.
--   This prevents double-execution when trigger + cron fire close
--   together. Example guard (TypeScript / Deno):
--
--     const { data } = await supabase
--       .from('cockpit_tickets')
--       .select('status')
--       .eq('id', ticketId)
--       .single();
--     if (!data || data.status !== 'new') return; // already handled
--
-- ──────────────────────────────────────────────────────────────

-- Verify trigger registered (informational, non-blocking)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
     WHERE trigger_name = 'trg_notify_runner_on_ticket_insert'
       AND event_object_table = 'cockpit_tickets'
  ) THEN
    RAISE WARNING 'trg_notify_runner_on_ticket_insert was NOT found after creation — review migration output.';
  ELSE
    RAISE NOTICE 'trg_notify_runner_on_ticket_insert registered successfully on cockpit_tickets.';
  END IF;
END;
$$;
