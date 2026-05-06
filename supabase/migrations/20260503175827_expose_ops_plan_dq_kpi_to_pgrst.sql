-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503175827
-- Name:    expose_ops_plan_dq_kpi_to_pgrst
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Merge (never overwrite) — add ops + plan + dq + kpi alongside existing schemas
ALTER ROLE authenticator SET pgrst.db_schemas TO 'public, graphql_public, marketing, governance, guest, gl, suppliers, fa, inv, proc, sales, ops, plan, dq, kpi';
NOTIFY pgrst, 'reload config';

-- Build a single view in gl that gives ops snapshot in one shot (so the page
-- can do one round-trip)
CREATE OR REPLACE VIEW gl.v_ops_snapshot AS
WITH dq AS (
  SELECT count(*) FILTER (WHERE resolved_at IS NULL AND severity='CRITICAL') AS dq_critical,
         count(*) FILTER (WHERE resolved_at IS NULL AND severity='WARNING')  AS dq_warning,
         count(*) FILTER (WHERE resolved_at IS NULL)                         AS dq_total_open
  FROM dq.violations
),
tasks AS (
  SELECT count(*) AS tasks_due_7d FROM ops.v_tasks_due_next_7d
),
maint AS (
  SELECT count(*) AS maint_open FROM ops.maintenance_tickets WHERE closed_at IS NULL
),
staff AS (
  SELECT count(*) AS staff_active
  FROM ops.staff_employment
  WHERE end_date IS NULL OR end_date >= CURRENT_DATE
),
shifts7 AS (
  SELECT count(*) AS shifts_last_7d FROM ops.shifts WHERE shift_date >= CURRENT_DATE - 7
),
decisions AS (
  SELECT count(*) FILTER (WHERE status='pending') AS ops_decisions_pending
  FROM governance.decision_queue
  WHERE scope_section ILIKE '%ops%' OR source_agent ILIKE '%ops%' OR source_agent ILIKE '%roster%' OR source_agent ILIKE '%maint%' OR source_agent ILIKE '%proc%'
)
SELECT * FROM dq, tasks, maint, staff, shifts7, decisions;

GRANT SELECT ON gl.v_ops_snapshot TO anon, service_role;