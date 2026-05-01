-- =====================================================================
-- Migration: phase2_staff_detail
-- Purpose:
--   1) Resolve duplicate columns in ops.staff_employment (emp_id vs employee_code,
--      start_date vs hire_date) without breaking existing UI.
--   2) Replace ops.v_staff_register_extended with a richer master view.
--   3) Add ops.v_staff_detail for the per-employee drill-down page.
--   4) Fix ops.v_staff_anomalies — drop phantom "missing_employee_code" flag,
--      acknowledge that ops.payroll_monthly contains April 2026 payroll
--      (so payslip-missing flag now means: no PDF uploaded to docs.hr_docs).
-- Property: 260955 (The Namkhan)
-- Author:   PBS, 2026-05-01
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Backfill employee_code from emp_id so the column has parity
-- ---------------------------------------------------------------------
UPDATE ops.staff_employment
SET employee_code = emp_id
WHERE employee_code IS NULL AND emp_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 2. Recreate ops.v_staff_register (used by extended view)
--    Adds: missing_hire_date flag, missing_contract flag, dept colour key
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW ops.v_staff_register AS
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
  -- DQ flags exposed at row level
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

-- ---------------------------------------------------------------------
-- 3. Extended view: append last payslip + last payroll + service start
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW ops.v_staff_register_extended AS
SELECT
  r.*,
  -- Uploaded payslip PDF (docs.hr_docs)
  lp.last_payslip_period,
  COALESCE(lp.payslip_count, 0)               AS payslip_pdf_count,
  CASE
    WHEN lp.last_payslip_period IS NULL THEN 'never'
    WHEN lp.last_payslip_period >= (date_trunc('month', now())::date - interval '1 month')::date
      THEN 'current'
    ELSE 'overdue'
  END                                          AS payslip_pdf_status,
  -- Calculated payroll (ops.payroll_monthly) — what HR actually ran
  pm_last.period_month                         AS last_payroll_period,
  pm_last.grand_total_usd                      AS last_payroll_total_usd,
  pm_last.days_worked                          AS last_payroll_days_worked,
  -- Tenure (only meaningful once hire_date is filled)
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

-- ---------------------------------------------------------------------
-- 4. v_staff_detail — payload for /operations/staff/[empId]
--    Returns 1 row per staff with all aggregates the detail page needs.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW ops.v_staff_detail AS
SELECT
  r.*,
  ext.last_payslip_period,
  ext.payslip_pdf_count,
  ext.payslip_pdf_status,
  ext.last_payroll_period,
  ext.last_payroll_total_usd,
  ext.last_payroll_days_worked,
  ext.tenure_years,
  -- 12-month payroll trail
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
  -- Last 90-day attendance trail
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
  -- Weekly availability pattern
  (
    SELECT json_agg(row_to_json(t) ORDER BY t.weekday)
    FROM (
      SELECT av.weekday, av.start_time, av.end_time, av.break_minutes
      FROM ops.staff_availability av
      WHERE av.staff_id = r.staff_id
    ) t
  ) AS availability,
  -- Per-staff DQ flags (consolidated)
  (
    SELECT array_agg(va.issue)
    FROM ops.v_staff_anomalies va
    WHERE va.staff_id = r.staff_id
  ) AS dq_flags
FROM ops.v_staff_register r
LEFT JOIN ops.v_staff_register_extended ext ON ext.staff_id = r.staff_id;

COMMENT ON VIEW ops.v_staff_detail IS
  'Per-employee payload for /operations/staff/[empId] detail page.';

-- ---------------------------------------------------------------------
-- 5. Replace v_staff_anomalies — drop phantom alarms, keep real ones
--    Real flags:
--      - missing_hire_date: hire_date is the only true gap right now
--      - missing_contract:  no contract PDF uploaded
--      - contract_expiring: end_date within 60 days
--      - no_payslip_pdf_last_closed_month: docs.hr_docs missing
--      - no_calculated_payroll_last_closed_month: ops.payroll_monthly missing
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW ops.v_staff_anomalies AS
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
  -- "Last closed month" = last day of previous calendar month, normalised
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

COMMIT;

-- =====================================================================
-- Verification queries (run AFTER migration)
-- =====================================================================
-- SELECT issue, COUNT(*) FROM ops.v_staff_anomalies GROUP BY issue ORDER BY 2 DESC;
-- SELECT * FROM ops.v_staff_detail WHERE emp_id = 'TNK 1003';
-- SELECT COUNT(*) FROM ops.v_staff_register_extended;

-- =====================================================================
-- APPENDED 2026-05-01 — Public-schema proxies + grants
-- ops schema is NOT in PostgREST exposed_schemas. Without these proxies
-- the supabase-js anon client returns null/empty. See feedback memory:
-- "Supabase JS .schema('ops') silently returns empty unless ops is exposed".
-- =====================================================================

BEGIN;

-- Public proxies (replace any prior versions)
DROP VIEW IF EXISTS public.v_staff_register_extended CASCADE;
CREATE VIEW public.v_staff_register_extended AS
  SELECT * FROM ops.v_staff_register_extended;

DROP VIEW IF EXISTS public.v_staff_anomalies CASCADE;
CREATE VIEW public.v_staff_anomalies AS
  SELECT * FROM ops.v_staff_anomalies;

DROP VIEW IF EXISTS public.v_staff_detail CASCADE;
CREATE VIEW public.v_staff_detail AS
  SELECT * FROM ops.v_staff_detail;

-- Grants — anon needs SELECT for read-only pages. authenticated mirrored.
GRANT SELECT ON public.v_staff_register_extended TO anon, authenticated;
GRANT SELECT ON public.v_staff_anomalies         TO anon, authenticated;
GRANT SELECT ON public.v_staff_detail            TO anon, authenticated;

-- Grant SELECT on the underlying ops views too — required because the
-- public proxy is security_invoker=false (default), so reads run as the
-- view owner not as anon, but PostgREST still enforces ops grants for
-- nested calls. Cheap and safe.
GRANT USAGE ON SCHEMA ops TO anon, authenticated;
GRANT SELECT ON ops.v_staff_register         TO anon, authenticated;
GRANT SELECT ON ops.v_staff_register_extended TO anon, authenticated;
GRANT SELECT ON ops.v_staff_anomalies        TO anon, authenticated;
GRANT SELECT ON ops.v_staff_detail           TO anon, authenticated;

COMMIT;
