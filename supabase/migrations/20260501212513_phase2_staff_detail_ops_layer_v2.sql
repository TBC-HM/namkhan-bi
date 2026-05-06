-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260501212513
-- Name:    phase2_staff_detail_ops_layer_v2
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Phase 2 Staff redesign — ops layer (v2: explicit DROPs to allow column reorder)
-- CREATE OR REPLACE VIEW won't allow column renames/reorders. Drop+recreate.

UPDATE ops.staff_employment
SET employee_code = emp_id
WHERE employee_code IS NULL AND emp_id IS NOT NULL;

-- Drop in dependency order (CASCADE removes public proxies + dependents)
DROP VIEW IF EXISTS ops.v_staff_detail              CASCADE;
DROP VIEW IF EXISTS ops.v_staff_anomalies           CASCADE;
DROP VIEW IF EXISTS ops.v_staff_register_extended   CASCADE;
DROP VIEW IF EXISTS ops.v_staff_register            CASCADE;

CREATE VIEW ops.v_staff_register AS
SELECT
  se.id                              AS staff_id,
  se.emp_id,
  se.full_name,
  se.position_title,
  d.code                             AS dept_code,
  d.name                             AS dept_name,
  se.employment_type,
  se.contract_hours_pw,
  se.monthly_salary,
  se.salary_currency,
  se.hourly_cost_lak,
  se.skills,
  COALESCE(se.start_date, se.hire_date) AS hire_date,
  se.end_date,
  se.is_active,
  se.is_platform_user,
  se.user_id,
  se.contract_doc_id,
  (COALESCE(se.start_date, se.hire_date) IS NULL) AS flag_missing_hire_date,
  (se.contract_doc_id IS NULL)                    AS flag_missing_contract,
  (se.end_date IS NOT NULL
   AND se.end_date BETWEEN current_date AND current_date + interval '60 days')
                                                  AS flag_contract_expiring,
  se.created_at,
  se.updated_at
FROM ops.staff_employment se
LEFT JOIN ops.departments d ON d.dept_id = se.dept_id;

COMMENT ON VIEW ops.v_staff_register IS
  'Master staff list. Source of truth for /operations/staff page.';

CREATE VIEW ops.v_staff_register_extended AS
SELECT
  r.*,
  lp.last_payslip_period,
  COALESCE(lp.payslip_count, 0)               AS payslip_pdf_count,
  CASE
    WHEN lp.last_payslip_period IS NULL THEN 'never'
    WHEN lp.last_payslip_period >= (date_trunc('month', now())::date - interval '1 month')::date
      THEN 'current'
    ELSE 'overdue'
  END                                          AS payslip_pdf_status,
  pm_last.period_month                         AS last_payroll_period,
  pm_last.grand_total_usd                      AS last_payroll_total_usd,
  pm_last.days_worked                          AS last_payroll_days_worked,
  CASE WHEN r.hire_date IS NOT NULL
       THEN EXTRACT(YEAR FROM age(current_date, r.hire_date))::int
       ELSE NULL
  END                                          AS tenure_years
FROM ops.v_staff_register r
LEFT JOIN ops.v_staff_last_payslip lp ON lp.staff_id = r.staff_id
LEFT JOIN LATERAL (
  SELECT pm.period_month, pm.grand_total_usd, pm.days_worked
  FROM ops.payroll_monthly pm
  WHERE pm.staff_id = r.staff_id
  ORDER BY pm.period_month DESC
  LIMIT 1
) pm_last ON TRUE;

COMMENT ON VIEW ops.v_staff_register_extended IS
  'Master staff list + last payslip PDF + last calculated payroll. /operations/staff.';

CREATE VIEW ops.v_staff_anomalies AS
WITH base AS (
  SELECT
    r.staff_id,
    r.full_name,
    r.dept_code,
    r.dept_name,
    r.hire_date,
    r.end_date,
    r.contract_doc_id,
    r.is_active
  FROM ops.v_staff_register r
  WHERE r.is_active = TRUE
),
last_closed_month AS (
  SELECT (date_trunc('month', current_date) - interval '1 day')::date AS d_end,
         date_trunc('month', current_date - interval '1 month')::date AS d_start
)
SELECT 'missing_hire_date'::text AS issue, b.staff_id, b.full_name, b.dept_code, b.dept_name
FROM base b WHERE b.hire_date IS NULL
UNION ALL
SELECT 'missing_contract', b.staff_id, b.full_name, b.dept_code, b.dept_name
FROM base b WHERE b.contract_doc_id IS NULL
UNION ALL
SELECT 'contract_expiring', b.staff_id, b.full_name, b.dept_code, b.dept_name
FROM base b
WHERE b.end_date IS NOT NULL
  AND b.end_date BETWEEN current_date AND current_date + interval '60 days'
UNION ALL
SELECT 'no_payslip_pdf_last_closed_month', b.staff_id, b.full_name, b.dept_code, b.dept_name
FROM base b
LEFT JOIN ops.v_staff_last_payslip lp ON lp.staff_id = b.staff_id
CROSS JOIN last_closed_month lcm
WHERE lp.last_payslip_period IS NULL
   OR lp.last_payslip_period < lcm.d_start
UNION ALL
SELECT 'no_calculated_payroll_last_closed_month', b.staff_id, b.full_name, b.dept_code, b.dept_name
FROM base b
CROSS JOIN last_closed_month lcm
WHERE NOT EXISTS (
  SELECT 1 FROM ops.payroll_monthly pm
  WHERE pm.staff_id = b.staff_id
    AND pm.period_month = lcm.d_start
);

COMMENT ON VIEW ops.v_staff_anomalies IS
  'Operational DQ flags per active staff. No phantom alarms on backfilled fields.';

CREATE VIEW ops.v_staff_detail AS
SELECT
  r.*,
  ext.last_payslip_period,
  ext.payslip_pdf_count,
  ext.payslip_pdf_status,
  ext.last_payroll_period,
  ext.last_payroll_total_usd,
  ext.last_payroll_days_worked,
  ext.tenure_years,
  (
    SELECT json_agg(row_to_json(t) ORDER BY t.period_month DESC)
    FROM (
      SELECT
        pm.period_month,
        pm.days_worked,
        pm.days_off,
        pm.days_annual_leave,
        pm.days_public_holiday,
        pm.days_sick,
        pm.base_salary_lak,
        pm.overtime_15x_lak,
        pm.overtime_2x_lak,
        pm.service_charge_lak,
        pm.gasoline_allow_lak,
        pm.internet_allow_lak,
        pm.other_allow_lak,
        pm.adjustment_lak,
        pm.deduction_lak,
        pm.sso_5_5_lak,
        pm.tax_lak,
        pm.net_salary_lak,
        pm.net_salary_usd,
        pm.grand_total_usd,
        pm.fx_lak_usd,
        pm.imported_from
      FROM ops.payroll_monthly pm
      WHERE pm.staff_id = r.staff_id
        AND pm.period_month >= (current_date - interval '12 months')
      ORDER BY pm.period_month DESC
    ) t
  ) AS payroll_12m,
  (
    SELECT json_agg(row_to_json(t) ORDER BY t.attendance_date DESC)
    FROM (
      SELECT
        a.attendance_date,
        a.code,
        a.hours_worked,
        a.overtime_15x_h,
        a.overtime_2x_h,
        a.notes
      FROM ops.staff_attendance a
      WHERE a.staff_id = r.staff_id
        AND a.attendance_date >= current_date - interval '90 days'
      ORDER BY a.attendance_date DESC
    ) t
  ) AS attendance_90d,
  (
    SELECT json_agg(row_to_json(t) ORDER BY t.weekday)
    FROM (
      SELECT av.weekday, av.start_time, av.end_time, av.break_minutes
      FROM ops.staff_availability av
      WHERE av.staff_id = r.staff_id
    ) t
  ) AS availability,
  (
    SELECT array_agg(va.issue)
    FROM ops.v_staff_anomalies va
    WHERE va.staff_id = r.staff_id
  ) AS dq_flags
FROM ops.v_staff_register r
LEFT JOIN ops.v_staff_register_extended ext ON ext.staff_id = r.staff_id;

COMMENT ON VIEW ops.v_staff_detail IS
  'Per-employee payload for /operations/staff/[empId] detail page.';