-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260430171644
-- Name:    phase1_17_ops_staff_planner_views_triggers
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ============================================================
-- v1.4 part 5 — useful views + updated_at triggers
-- ============================================================

-- updated_at triggers (function set_updated_at already exists in project)
CREATE TRIGGER trg_task_catalog_updated
  BEFORE UPDATE ON ops.task_catalog
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER trg_task_instances_updated
  BEFORE UPDATE ON ops.task_instances
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- View 1: staff register flat — for /operations/staff page
CREATE OR REPLACE VIEW ops.v_staff_register AS
SELECT
  se.id              AS staff_id,
  se.emp_id,
  se.full_name,
  se.position_title,
  d.code             AS dept_code,
  d.name             AS dept_name,
  se.employment_type,
  se.contract_hours_pw,
  se.monthly_salary,
  se.salary_currency,
  se.hourly_cost_lak,
  se.skills,
  se.start_date      AS hire_date,
  se.end_date,
  se.is_active,
  se.is_platform_user,
  se.user_id
FROM ops.staff_employment se
LEFT JOIN ops.departments d ON d.dept_id = se.dept_id;

-- View 2: payroll summary by department by month
CREATE OR REPLACE VIEW ops.v_payroll_dept_monthly AS
SELECT
  pm.period_month,
  d.code  AS dept_code,
  d.name  AS dept_name,
  COUNT(DISTINCT pm.staff_id)     AS headcount,
  SUM(pm.days_worked)             AS total_days_worked,
  SUM(pm.base_salary_lak)         AS total_base_lak,
  SUM(pm.overtime_15x_lak + pm.overtime_2x_lak) AS total_overtime_lak,
  SUM(pm.service_charge_lak)      AS total_sc_lak,
  SUM(pm.gasoline_allow_lak + pm.internet_allow_lak + pm.other_allow_lak) AS total_allow_lak,
  SUM(pm.sso_5_5_lak)             AS total_sso_lak,
  SUM(pm.tax_lak)                 AS total_tax_lak,
  SUM(pm.net_salary_lak)          AS total_net_lak,
  SUM(pm.grand_total_usd)         AS total_grand_usd
FROM ops.payroll_monthly pm
JOIN ops.staff_employment se ON se.id = pm.staff_id
LEFT JOIN ops.departments d ON d.dept_id = se.dept_id
GROUP BY pm.period_month, d.code, d.name;

-- View 3: tasks due this week — feeds the planner
CREATE OR REPLACE VIEW ops.v_tasks_due_next_7d AS
WITH last_done AS (
  SELECT task_id, MAX(completed_at) AS last_completed_at
  FROM ops.task_instances
  WHERE status = 'done'
  GROUP BY task_id
)
SELECT
  tc.task_id,
  tc.task_code,
  tc.title,
  tc.dept_id,
  d.code AS dept_code,
  tc.required_skills,
  tc.duration_minutes,
  tc.interval_days,
  tc.priority,
  tc.scope,
  tc.scope_target,
  tc.blocks_room,
  ld.last_completed_at,
  CASE
    WHEN ld.last_completed_at IS NULL THEN CURRENT_DATE  -- never done → due now
    ELSE (ld.last_completed_at + (tc.interval_days || ' days')::interval)::date
  END AS due_date,
  CASE
    WHEN ld.last_completed_at IS NULL THEN 999
    ELSE GREATEST(0, CURRENT_DATE - ((ld.last_completed_at + (tc.interval_days || ' days')::interval)::date))
  END AS days_overdue
FROM ops.task_catalog tc
LEFT JOIN ops.departments d ON d.dept_id = tc.dept_id
LEFT JOIN last_done ld ON ld.task_id = tc.task_id
WHERE tc.is_active
  AND tc.interval_days IS NOT NULL
  AND (
    ld.last_completed_at IS NULL
    OR (ld.last_completed_at + (tc.interval_days || ' days')::interval)::date <= CURRENT_DATE + 7
  );

-- View 4: staff availability for a date range — used by planner scoring
CREATE OR REPLACE VIEW ops.v_staff_capacity_week AS
SELECT
  se.id AS staff_id,
  se.full_name,
  d.code AS dept_code,
  se.skills,
  se.contract_hours_pw,
  se.contract_hours_pw / 7.0 * 6 AS estimated_weekly_work_hours  -- 6 working days/week
FROM ops.staff_employment se
LEFT JOIN ops.departments d ON d.dept_id = se.dept_id
WHERE se.is_active = true;

GRANT SELECT ON ops.v_staff_register, ops.v_payroll_dept_monthly,
               ops.v_tasks_due_next_7d, ops.v_staff_capacity_week
  TO authenticated;
