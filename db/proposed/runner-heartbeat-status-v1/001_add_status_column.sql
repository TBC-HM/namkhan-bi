-- db/proposed/runner-heartbeat-status-v1/001_add_status_column.sql
-- APPLIED 2026-09-06 as migration `cockpit_runner_heartbeat_add_status_column`.
-- Approved by PBS in chat ("fix the aditive coloumn"). Audit copy only.
--
-- WHY -----------------------------------------------------------------------
-- scripts/runner-v3.ts writes `status` on its heartbeat insert and on every update
-- (lines 102, 121, 131), but the column did not exist. The runner died on its FIRST
-- statement:
--
--   HEARTBEAT START FAILED: Could not find the 'status' column of
--   'cockpit_runner_heartbeat' in the schema cache
--
-- so the scheduled agent-runner workflow failed on every run without ever picking up a
-- ticket. The last heartbeat row before this fix was 2026-08-14 — roughly three weeks
-- of a completely dead platform runner, reported by nothing.
--
-- public.cockpit_runner_heartbeat is a VIEW over cockpit.exec_runner_heartbeat, and the
-- runner writes THROUGH it via PostgREST, so the column has to exist in both.
--
-- ADDITIVE ONLY. No drop, no rename, no change to existing columns. The view is rebuilt
-- with `status` appended LAST — CREATE OR REPLACE VIEW cannot drop or reorder columns,
-- so a tail append is the one safe edit.
--
-- Existing rows get 'unknown', not a guessed terminal state: those runs predate the
-- column and how they ended is genuinely not known.

ALTER TABLE cockpit.exec_runner_heartbeat
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'unknown';

ALTER TABLE cockpit.exec_runner_heartbeat
  DROP CONSTRAINT IF EXISTS exec_runner_heartbeat_status_chk;

ALTER TABLE cockpit.exec_runner_heartbeat
  ADD CONSTRAINT exec_runner_heartbeat_status_chk
  CHECK (status IN ('running', 'done', 'error', 'unknown'));

COMMENT ON COLUMN cockpit.exec_runner_heartbeat.status IS
  'Runner lifecycle: running on start, done/error on finish (scripts/runner-v3.ts). '
  '''unknown'' marks rows created before this column existed (added 2026-09-06).';

CREATE INDEX IF NOT EXISTS exec_runner_heartbeat_status_started_idx
  ON cockpit.exec_runner_heartbeat (status, started_at DESC);

CREATE OR REPLACE VIEW public.cockpit_runner_heartbeat AS
  SELECT id, runner_name, started_at, ended_at, tickets_picked, tickets_processed,
         prs_opened, abort_count, errors, github_run_id, exit_code, notes,
         status
    FROM cockpit.exec_runner_heartbeat;

REVOKE ALL ON public.cockpit_runner_heartbeat FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.cockpit_runner_heartbeat TO authenticated, service_role;

-- VERIFIED 2026-09-06: replayed the runner's exact insert through PostgREST -> 201.
-- Then dispatched the workflow: run 34058953191 SUCCEEDED, first green agent-runner in
-- weeks, and wrote heartbeat row 1149 (runner_v3, status='running').
--
-- FOLLOW-UP, not fixed here: row 1149 is still 'running' with ended_at NULL after the
-- run completed. The empty-queue path appears not to set a terminal status, so a stale
-- 'running' row does not by itself mean a stuck runner yet. Worth tightening in
-- runner-v3 before anyone alerts on it.
