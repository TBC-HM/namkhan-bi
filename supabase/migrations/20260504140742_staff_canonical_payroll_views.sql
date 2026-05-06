-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504140742
-- Name:    staff_canonical_payroll_views
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Replace ops.v_payroll_dept_monthly, ops.v_staff_register_extended, ops.v_staff_detail
-- with versions that expose canonical_net_lak / canonical_net_usd / canonical_cost_lak /
-- canonical_cost_usd / benefits_lak — computed from line items, ignoring the broken
-- net_salary_lak and grand_total_usd source columns.

DROP VIEW IF EXISTS public.v_staff_detail CASCADE;
DROP VIEW IF EXISTS public.v_staff_register_extended CASCADE;
DROP VIEW IF EXISTS public.v_payroll_dept_monthly CASCADE;
DROP VIEW IF EXISTS ops.v_staff_detail CASCADE;
DROP VIEW IF EXISTS ops.v_staff_register_extended CASCADE;
DROP VIEW IF EXISTS ops.v_payroll_dept_monthly CASCADE;

-- ===========================================================================
-- ops.v_payroll_dept_monthly
-- ===========================================================================
CREATE VIEW ops.v_payroll_dept_monthly AS
SELECT
  pm.period_month,
  d.code AS dept_code,
  d.name AS dept_name,
  COUNT(DISTINCT pm.staff_id) AS headcount,
  SUM(pm.days_worked) AS total_days_worked,
  SUM(pm.base_salary_lak) AS total_base_lak,
  SUM(pm.overtime_15x_lak + pm.overtime_2x_lak) AS total_overtime_lak,
  SUM(pm.service_charge_lak) AS total_sc_lak,
  SUM(pm.gasoline_allow_lak + pm.internet_allow_lak + pm.other_allow_lak) AS total_allow_lak,
  SUM(pm.sso_5_5_lak) AS total_sso_lak,
  SUM(pm.tax_lak) AS total_tax_lak,
  -- Legacy columns (kept for compatibility — DO NOT USE FOR NEW WORK)
  SUM(pm.net_salary_lak) AS total_net_lak,
  SUM(pm.grand_total_usd) AS total_grand_usd,
  -- Canonical truth: computed from line items
  SUM(
    COALESCE(pm.base_salary_lak,0) + COALESCE(pm.overtime_15x_lak,0) + COALESCE(pm.overtime_2x_lak,0)
    + COALESCE(pm.service_charge_lak,0) + COALESCE(pm.gasoline_allow_lak,0)
    + COALESCE(pm.internet_allow_lak,0) + COALESCE(pm.other_allow_lak,0) + COALESCE(pm.adjustment_lak,0)
    - COALESCE(pm.deduction_lak,0) - COALESCE(pm.sso_5_5_lak,0) - COALESCE(pm.tax_lak,0)
  ) AS total_canonical_net_lak,
  SUM(
    (COALESCE(pm.base_salary_lak,0) + COALESCE(pm.overtime_15x_lak,0) + COALESCE(pm.overtime_2x_lak,0)
     + COALESCE(pm.service_charge_lak,0) + COALESCE(pm.gasoline_allow_lak,0)
     + COALESCE(pm.internet_allow_lak,0) + COALESCE(pm.other_allow_lak,0) + COALESCE(pm.adjustment_lak,0)
     - COALESCE(pm.deduction_lak,0) - COALESCE(pm.sso_5_5_lak,0) - COALESCE(pm.tax_lak,0))
    / NULLIF(pm.fx_lak_usd, 0)
  ) AS total_canonical_net_usd,
  SUM(
    COALESCE(pm.base_salary_lak,0) + COALESCE(pm.overtime_15x_lak,0) + COALESCE(pm.overtime_2x_lak,0)
    + COALESCE(pm.service_charge_lak,0) + COALESCE(pm.gasoline_allow_lak,0)
    + COALESCE(pm.internet_allow_lak,0) + COALESCE(pm.other_allow_lak,0) + COALESCE(pm.adjustment_lak,0)
  ) AS total_canonical_cost_lak,
  SUM(
    (COALESCE(pm.base_salary_lak,0) + COALESCE(pm.overtime_15x_lak,0) + COALESCE(pm.overtime_2x_lak,0)
     + COALESCE(pm.service_charge_lak,0) + COALESCE(pm.gasoline_allow_lak,0)
     + COALESCE(pm.internet_allow_lak,0) + COALESCE(pm.other_allow_lak,0) + COALESCE(pm.adjustment_lak,0))
    / NULLIF(pm.fx_lak_usd, 0)
  ) AS total_canonical_cost_usd,
  SUM(
    COALESCE(pm.service_charge_lak,0) + COALESCE(pm.gasoline_allow_lak,0)
    + COALESCE(pm.internet_allow_lak,0) + COALESCE(pm.other_allow_lak,0)
  ) AS total_benefits_lak
FROM ops.payroll_monthly pm
JOIN ops.staff_employment se ON se.id = pm.staff_id
LEFT JOIN ops.departments d ON d.dept_id = se.dept_id
GROUP BY pm.period_month, d.code, d.name;

-- ===========================================================================
-- ops.v_staff_register_extended
-- ===========================================================================
CREATE VIEW ops.v_staff_register_extended AS
SELECT
  r.staff_id, r.emp_id, r.full_name, r.position_title, r.dept_code, r.dept_name,
  r.employment_type, r.contract_hours_pw, r.monthly_salary, r.salary_currency, r.hourly_cost_lak,
  r.skills, r.hire_date, r.end_date, r.is_active, r.is_platform_user, r.user_id, r.contract_doc_id,
  r.flag_missing_hire_date, r.flag_missing_contract, r.flag_contract_expiring,
  r.created_at, r.updated_at,
  lp.last_payslip_period,
  COALESCE(lp.payslip_count, 0::bigint) AS payslip_pdf_count,
  CASE
    WHEN lp.last_payslip_period IS NULL THEN 'never'::text
    WHEN lp.last_payslip_period >= (date_trunc('month'::text, now())::date - '1 mon'::interval)::date THEN 'current'::text
    ELSE 'overdue'::text
  END AS payslip_pdf_status,
  pm_last.period_month AS last_payroll_period,
  -- Legacy: was pm_last.grand_total_usd (unreliable). Now canonical.
  pm_last.canonical_net_usd AS last_payroll_total_usd,
  pm_last.canonical_cost_usd AS last_payroll_cost_usd,
  pm_last.canonical_net_lak AS last_payroll_net_lak,
  pm_last.canonical_cost_lak AS last_payroll_cost_lak,
  pm_last.days_worked AS last_payroll_days_worked,
  CASE
    WHEN r.hire_date IS NOT NULL THEN EXTRACT(year FROM age(CURRENT_DATE::timestamp with time zone, r.hire_date::timestamp with time zone))::integer
    ELSE NULL::integer
  END AS tenure_years
FROM ops.v_staff_register r
LEFT JOIN ops.v_staff_last_payslip lp ON lp.staff_id = r.staff_id
LEFT JOIN LATERAL (
  SELECT
    pm.period_month,
    pm.days_worked,
    (COALESCE(pm.base_salary_lak,0) + COALESCE(pm.overtime_15x_lak,0) + COALESCE(pm.overtime_2x_lak,0)
     + COALESCE(pm.service_charge_lak,0) + COALESCE(pm.gasoline_allow_lak,0)
     + COALESCE(pm.internet_allow_lak,0) + COALESCE(pm.other_allow_lak,0) + COALESCE(pm.adjustment_lak,0)
     - COALESCE(pm.deduction_lak,0) - COALESCE(pm.sso_5_5_lak,0) - COALESCE(pm.tax_lak,0)) AS canonical_net_lak,
    (COALESCE(pm.base_salary_lak,0) + COALESCE(pm.overtime_15x_lak,0) + COALESCE(pm.overtime_2x_lak,0)
     + COALESCE(pm.service_charge_lak,0) + COALESCE(pm.gasoline_allow_lak,0)
     + COALESCE(pm.internet_allow_lak,0) + COALESCE(pm.other_allow_lak,0) + COALESCE(pm.adjustment_lak,0)
     - COALESCE(pm.deduction_lak,0) - COALESCE(pm.sso_5_5_lak,0) - COALESCE(pm.tax_lak,0))
     / NULLIF(pm.fx_lak_usd, 0) AS canonical_net_usd,
    (COALESCE(pm.base_salary_lak,0) + COALESCE(pm.overtime_15x_lak,0) + COALESCE(pm.overtime_2x_lak,0)
     + COALESCE(pm.service_charge_lak,0) + COALESCE(pm.gasoline_allow_lak,0)
     + COALESCE(pm.internet_allow_lak,0) + COALESCE(pm.other_allow_lak,0) + COALESCE(pm.adjustment_lak,0)) AS canonical_cost_lak,
    (COALESCE(pm.base_salary_lak,0) + COALESCE(pm.overtime_15x_lak,0) + COALESCE(pm.overtime_2x_lak,0)
     + COALESCE(pm.service_charge_lak,0) + COALESCE(pm.gasoline_allow_lak,0)
     + COALESCE(pm.internet_allow_lak,0) + COALESCE(pm.other_allow_lak,0) + COALESCE(pm.adjustment_lak,0))
     / NULLIF(pm.fx_lak_usd, 0) AS canonical_cost_usd
  FROM ops.payroll_monthly pm
  WHERE pm.staff_id = r.staff_id
  ORDER BY pm.period_month DESC
  LIMIT 1
) pm_last ON true;

-- ===========================================================================
-- ops.v_staff_detail
-- ===========================================================================
CREATE VIEW ops.v_staff_detail AS
SELECT
  r.staff_id, r.emp_id, r.full_name, r.position_title, r.dept_code, r.dept_name, r.employment_type,
  r.contract_hours_pw, r.monthly_salary, r.salary_currency, r.hourly_cost_lak, r.skills,
  r.hire_date, r.end_date, r.is_active, r.is_platform_user, r.user_id, r.contract_doc_id,
  r.flag_missing_hire_date, r.flag_missing_contract, r.flag_contract_expiring, r.created_at, r.updated_at,
  ext.last_payslip_period, ext.payslip_pdf_count, ext.payslip_pdf_status,
  ext.last_payroll_period, ext.last_payroll_total_usd, ext.last_payroll_cost_usd,
  ext.last_payroll_net_lak, ext.last_payroll_cost_lak, ext.last_payroll_days_worked,
  ext.tenure_years,
  (SELECT json_agg(row_to_json(t.*) ORDER BY t.period_month DESC) AS json_agg
   FROM (
     SELECT
       pm.period_month, pm.days_worked, pm.days_off, pm.days_annual_leave, pm.days_public_holiday, pm.days_sick,
       pm.base_salary_lak, pm.overtime_15x_lak, pm.overtime_2x_lak, pm.service_charge_lak,
       pm.gasoline_allow_lak, pm.internet_allow_lak, pm.other_allow_lak,
       pm.adjustment_lak, pm.deduction_lak, pm.sso_5_5_lak, pm.tax_lak,
       pm.net_salary_lak, pm.net_salary_usd, pm.grand_total_usd, pm.fx_lak_usd, pm.imported_from,
       -- Canonical computed fields
       (COALESCE(pm.base_salary_lak,0) + COALESCE(pm.overtime_15x_lak,0) + COALESCE(pm.overtime_2x_lak,0)
        + COALESCE(pm.service_charge_lak,0) + COALESCE(pm.gasoline_allow_lak,0)
        + COALESCE(pm.internet_allow_lak,0) + COALESCE(pm.other_allow_lak,0) + COALESCE(pm.adjustment_lak,0)
        - COALESCE(pm.deduction_lak,0) - COALESCE(pm.sso_5_5_lak,0) - COALESCE(pm.tax_lak,0)) AS canonical_net_lak,
       (COALESCE(pm.base_salary_lak,0) + COALESCE(pm.overtime_15x_lak,0) + COALESCE(pm.overtime_2x_lak,0)
        + COALESCE(pm.service_charge_lak,0) + COALESCE(pm.gasoline_allow_lak,0)
        + COALESCE(pm.internet_allow_lak,0) + COALESCE(pm.other_allow_lak,0) + COALESCE(pm.adjustment_lak,0)
        - COALESCE(pm.deduction_lak,0) - COALESCE(pm.sso_5_5_lak,0) - COALESCE(pm.tax_lak,0))
        / NULLIF(pm.fx_lak_usd, 0) AS canonical_net_usd,
       (COALESCE(pm.base_salary_lak,0) + COALESCE(pm.overtime_15x_lak,0) + COALESCE(pm.overtime_2x_lak,0)
        + COALESCE(pm.service_charge_lak,0) + COALESCE(pm.gasoline_allow_lak,0)
        + COALESCE(pm.internet_allow_lak,0) + COALESCE(pm.other_allow_lak,0) + COALESCE(pm.adjustment_lak,0)) AS canonical_cost_lak,
       (COALESCE(pm.base_salary_lak,0) + COALESCE(pm.overtime_15x_lak,0) + COALESCE(pm.overtime_2x_lak,0)
        + COALESCE(pm.service_charge_lak,0) + COALESCE(pm.gasoline_allow_lak,0)
        + COALESCE(pm.internet_allow_lak,0) + COALESCE(pm.other_allow_lak,0) + COALESCE(pm.adjustment_lak,0))
        / NULLIF(pm.fx_lak_usd, 0) AS canonical_cost_usd,
       (COALESCE(pm.service_charge_lak,0) + COALESCE(pm.gasoline_allow_lak,0)
        + COALESCE(pm.internet_allow_lak,0) + COALESCE(pm.other_allow_lak,0)) AS benefits_lak
     FROM ops.payroll_monthly pm
     WHERE pm.staff_id = r.staff_id AND pm.period_month >= (CURRENT_DATE - '1 year'::interval)
     ORDER BY pm.period_month DESC
   ) t) AS payroll_12m,
  (SELECT json_agg(row_to_json(t.*) ORDER BY t.attendance_date DESC) AS json_agg
   FROM (
     SELECT a.attendance_date, a.code, a.hours_worked, a.overtime_15x_h, a.overtime_2x_h, a.notes
     FROM ops.staff_attendance a
     WHERE a.staff_id = r.staff_id AND a.attendance_date >= (CURRENT_DATE - '90 days'::interval)
     ORDER BY a.attendance_date DESC
   ) t) AS attendance_90d,
  (SELECT json_agg(row_to_json(t.*) ORDER BY t.weekday) AS json_agg
   FROM (
     SELECT av.weekday, av.start_time, av.end_time, av.break_minutes
     FROM ops.staff_availability av
     WHERE av.staff_id = r.staff_id
   ) t) AS availability,
  (SELECT array_agg(va.issue) AS array_agg
   FROM ops.v_staff_anomalies va
   WHERE va.staff_id = r.staff_id) AS dq_flags
FROM ops.v_staff_register r
LEFT JOIN ops.v_staff_register_extended ext ON ext.staff_id = r.staff_id;

-- ===========================================================================
-- Public proxies (PostgREST surface)
-- ===========================================================================
CREATE VIEW public.v_payroll_dept_monthly AS SELECT * FROM ops.v_payroll_dept_monthly;
CREATE VIEW public.v_staff_register_extended AS SELECT * FROM ops.v_staff_register_extended;
CREATE VIEW public.v_staff_detail AS SELECT * FROM ops.v_staff_detail;

-- Grants (mirror what was on the dropped views)
GRANT SELECT ON public.v_payroll_dept_monthly       TO anon, authenticated, service_role;
GRANT SELECT ON public.v_staff_register_extended    TO anon, authenticated, service_role;
GRANT SELECT ON public.v_staff_detail               TO anon, authenticated, service_role;
GRANT SELECT ON ops.v_payroll_dept_monthly          TO authenticated, service_role;
GRANT SELECT ON ops.v_staff_register_extended       TO authenticated, service_role;
GRANT SELECT ON ops.v_staff_detail                  TO authenticated, service_role;
