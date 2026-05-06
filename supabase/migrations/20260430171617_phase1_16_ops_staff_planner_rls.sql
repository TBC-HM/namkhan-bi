-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260430171617
-- Name:    phase1_16_ops_staff_planner_rls
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ============================================================
-- v1.4 part 4 — RLS on new tables (read-all, top-level write)
-- Pattern matches existing ops schema (see doc 15)
-- ============================================================

ALTER TABLE ops.staff_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.staff_attendance   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.payroll_monthly    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.skills             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.task_catalog       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.task_instances     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.plan_runs          ENABLE ROW LEVEL SECURITY;

-- staff_availability
CREATE POLICY staff_availability_read ON ops.staff_availability
  FOR SELECT TO authenticated USING (true);
CREATE POLICY staff_availability_write ON ops.staff_availability
  FOR ALL TO authenticated USING (app.is_top_level()) WITH CHECK (app.is_top_level());

-- staff_attendance
CREATE POLICY staff_attendance_read ON ops.staff_attendance
  FOR SELECT TO authenticated USING (true);
CREATE POLICY staff_attendance_write ON ops.staff_attendance
  FOR ALL TO authenticated USING (app.is_top_level()) WITH CHECK (app.is_top_level());

-- payroll_monthly — confidential — owner/finance only read
CREATE POLICY payroll_monthly_read ON ops.payroll_monthly
  FOR SELECT TO authenticated USING (app.has_role(ARRAY['owner','gm','finance','hr']));
CREATE POLICY payroll_monthly_write ON ops.payroll_monthly
  FOR ALL TO authenticated
  USING (app.has_role(ARRAY['owner','finance','hr']))
  WITH CHECK (app.has_role(ARRAY['owner','finance','hr']));

-- skills — read all, top-level write
CREATE POLICY skills_read ON ops.skills
  FOR SELECT TO authenticated USING (true);
CREATE POLICY skills_write ON ops.skills
  FOR ALL TO authenticated USING (app.is_top_level()) WITH CHECK (app.is_top_level());

-- task_catalog
CREATE POLICY task_catalog_read ON ops.task_catalog
  FOR SELECT TO authenticated USING (true);
CREATE POLICY task_catalog_write ON ops.task_catalog
  FOR ALL TO authenticated USING (app.is_top_level()) WITH CHECK (app.is_top_level());

-- task_instances — read all, write top-level OR assigned-to-self status updates
CREATE POLICY task_instances_read ON ops.task_instances
  FOR SELECT TO authenticated USING (true);
CREATE POLICY task_instances_write_top ON ops.task_instances
  FOR ALL TO authenticated USING (app.is_top_level()) WITH CHECK (app.is_top_level());

-- plan_runs
CREATE POLICY plan_runs_read ON ops.plan_runs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY plan_runs_write ON ops.plan_runs
  FOR ALL TO authenticated USING (app.is_top_level()) WITH CHECK (app.is_top_level());
