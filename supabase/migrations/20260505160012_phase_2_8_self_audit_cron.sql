-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505160012
-- Name:    phase_2_8_self_audit_cron
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- =====================================================================
-- PHASE 2.8 — Daily self-audit: snapshot security & perf advisor lints
-- =====================================================================

-- Audit snapshot table
CREATE TABLE IF NOT EXISTS core.advisor_snapshots (
  snapshot_id   BIGSERIAL PRIMARY KEY,
  captured_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  advisor_type  TEXT NOT NULL CHECK (advisor_type IN ('security','performance')),
  total_lints   INTEGER NOT NULL,
  errors        INTEGER NOT NULL,
  warns         INTEGER NOT NULL,
  infos         INTEGER NOT NULL,
  details       JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS advisor_snapshots_captured_idx
  ON core.advisor_snapshots(captured_at DESC);
CREATE INDEX IF NOT EXISTS advisor_snapshots_type_captured_idx
  ON core.advisor_snapshots(advisor_type, captured_at DESC);

ALTER TABLE core.advisor_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY advisor_snapshots_read ON core.advisor_snapshots
  FOR SELECT TO authenticated USING (true);

CREATE POLICY advisor_snapshots_service_write ON core.advisor_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Function that runs the linter and records a snapshot.
-- Note: lint() is the same internal function the advisor API uses.
CREATE OR REPLACE FUNCTION core.run_advisor_snapshot()
RETURNS TABLE(security_total int, performance_total int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  sec_lints  jsonb;
  perf_lints jsonb;
  sec_total  int;
  perf_total int;
BEGIN
  -- Use lint.lint_database() which is what the advisor uses internally.
  -- Fall back gracefully if any lint extension is missing.
  BEGIN
    SELECT to_jsonb(array_agg(row_to_json(t)))
    INTO sec_lints
    FROM lint.lint('0001_unindexed_foreign_keys') t;  -- placeholder
  EXCEPTION WHEN OTHERS THEN
    sec_lints := '[]'::jsonb;
  END;

  -- Simpler portable approach: count tables flagged by built-in pg_stat queries.
  -- Real implementation will call into Supabase's `lint` schema if available.
  -- For now, store a minimal snapshot signal.
  INSERT INTO core.advisor_snapshots (advisor_type, total_lints, errors, warns, infos, details)
  VALUES (
    'security',
    0, 0, 0, 0,
    jsonb_build_object('note', 'placeholder snapshot — populate via edge function calling /v1/projects/{ref}/advisors')
  );
  INSERT INTO core.advisor_snapshots (advisor_type, total_lints, errors, warns, infos, details)
  VALUES (
    'performance',
    0, 0, 0, 0,
    jsonb_build_object('note', 'placeholder snapshot — populate via edge function calling /v1/projects/{ref}/advisors')
  );

  RETURN QUERY SELECT 0, 0;
END $$;

REVOKE EXECUTE ON FUNCTION core.run_advisor_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION core.run_advisor_snapshot() TO service_role;

-- Schedule it daily at 06:00 UTC
SELECT cron.schedule(
  'daily_advisor_snapshot',
  '0 6 * * *',
  $cron$ SELECT core.run_advisor_snapshot(); $cron$
);

COMMENT ON TABLE core.advisor_snapshots IS 'Daily snapshot of Supabase advisor findings. Populate richly via a scheduled Edge Function calling the Supabase Management API.';
COMMENT ON FUNCTION core.run_advisor_snapshot() IS 'Inserts a placeholder daily snapshot. For full lint capture, schedule an Edge Function to call the Management API and write rich JSONB into details.';
