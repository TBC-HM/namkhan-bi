-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504151013
-- Name:    staff_photo_field_v2
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ADD column (idempotent) - already done if migration ran partially
ALTER TABLE ops.staff_employment
  ADD COLUMN IF NOT EXISTS photo_path text;

COMMENT ON COLUMN ops.staff_employment.photo_path IS
  'Storage path within bucket "staff-photos" — typically "{staff_id}/{filename}.{ext}".';

-- Public storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('staff-photos', 'staff-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='staff_photos_public_read') THEN
    EXECUTE 'CREATE POLICY staff_photos_public_read ON storage.objects FOR SELECT USING (bucket_id = ''staff-photos'')';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='staff_photos_authenticated_write') THEN
    EXECUTE 'CREATE POLICY staff_photos_authenticated_write ON storage.objects FOR INSERT WITH CHECK (bucket_id = ''staff-photos'' AND auth.role() IN (''authenticated'',''service_role''))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='staff_photos_authenticated_update') THEN
    EXECUTE 'CREATE POLICY staff_photos_authenticated_update ON storage.objects FOR UPDATE USING (bucket_id = ''staff-photos'' AND auth.role() IN (''authenticated'',''service_role''))';
  END IF;
END $$;

-- Add photo_path to v_staff_register_extended (requires drop+recreate because column shape change)
DROP VIEW IF EXISTS public.v_staff_register_extended CASCADE;
DROP VIEW IF EXISTS public.v_staff_detail CASCADE;
DROP VIEW IF EXISTS ops.v_staff_register_extended CASCADE;
DROP VIEW IF EXISTS ops.v_staff_detail CASCADE;

CREATE VIEW ops.v_staff_register_extended AS
SELECT
  r.staff_id, r.emp_id, r.full_name, r.position_title, r.dept_code, r.dept_name,
  r.employment_type, r.contract_hours_pw, r.monthly_salary, r.salary_currency, r.hourly_cost_lak,
  r.skills, r.hire_date, r.end_date, r.is_active, r.is_platform_user, r.user_id, r.contract_doc_id,
  se.photo_path,
  r.flag_missing_hire_date, r.flag_missing_contract, r.flag_contract_expiring,
  r.created_at, r.updated_at,
  lp.last_payslip_period,
  COALESCE(lp.payslip_count, 0::bigint) AS payslip_pdf_count,
  CASE
    WHEN lp.last_payslip_period IS NULL THEN 'never'::text
    WHEN lp.last_payslip_period >= (date_trunc('month', now())::date - '1 mon'::interval)::date THEN 'current'::text
    ELSE 'overdue'::text
  END AS payslip_pdf_status,
  pm_last.period_month AS last_payroll_period,
  pm_last.canonical_net_usd AS last_payroll_total_usd,
  pm_last.canonical_cost_usd AS last_payroll_cost_usd,
  pm_last.canonical_net_lak AS last_payroll_net_lak,
  pm_last.canonical_cost_lak AS last_payroll_cost_lak,
  pm_last.days_worked AS last_payroll_days_worked,
  CASE
    WHEN r.hire_date IS NOT NULL THEN ROUND((EXTRACT(EPOCH FROM (CURRENT_DATE::timestamp - r.hire_date::timestamp)) / 31557600.0)::numeric, 1)
    ELSE NULL::numeric
  END AS tenure_years
FROM ops.v_staff_register r
LEFT JOIN ops.staff_employment se ON se.id = r.staff_id
LEFT JOIN ops.v_staff_last_payslip lp ON lp.staff_id = r.staff_id
LEFT JOIN LATERAL (
  SELECT
    pm.period_month, pm.days_worked,
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

CREATE VIEW ops.v_staff_detail AS
SELECT
  r.staff_id, r.emp_id, r.full_name, r.position_title, r.dept_code, r.dept_name, r.employment_type,
  r.contract_hours_pw, r.monthly_salary, r.salary_currency, r.hourly_cost_lak, r.skills,
  r.hire_date, r.end_date, r.is_active, r.is_platform_user, r.user_id, r.contract_doc_id,
  se.photo_path,
  r.flag_missing_hire_date, r.flag_missing_contract, r.flag_contract_expiring, r.created_at, r.updated_at,
  ext.last_payslip_period, ext.payslip_pdf_count, ext.payslip_pdf_status,
  ext.last_payroll_period, ext.last_payroll_total_usd, ext.last_payroll_cost_usd,
  ext.last_payroll_net_lak, ext.last_payroll_cost_lak, ext.last_payroll_days_worked,
  ext.tenure_years,
  (SELECT json_agg(row_to_json(t.*) ORDER BY t.period_month DESC)
   FROM (
     SELECT
       pm.period_month, pm.days_worked, pm.days_off, pm.days_annual_leave, pm.days_public_holiday, pm.days_sick,
       pm.base_salary_lak, pm.overtime_15x_lak, pm.overtime_2x_lak, pm.service_charge_lak,
       pm.gasoline_allow_lak, pm.internet_allow_lak, pm.other_allow_lak,
       pm.adjustment_lak, pm.deduction_lak, pm.sso_5_5_lak, pm.tax_lak,
       pm.net_salary_lak, pm.net_salary_usd, pm.grand_total_usd, pm.fx_lak_usd, pm.imported_from,
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
     WHERE pm.staff_id = r.staff_id AND pm.period_month >= (CURRENT_DATE - '2 year'::interval)
     ORDER BY pm.period_month DESC
   ) t) AS payroll_12m,
  (SELECT json_agg(row_to_json(t.*) ORDER BY t.attendance_date DESC)
   FROM (
     SELECT a.attendance_date, a.code, a.hours_worked, a.overtime_15x_h, a.overtime_2x_h, a.notes
     FROM ops.staff_attendance a
     WHERE a.staff_id = r.staff_id AND a.attendance_date >= (CURRENT_DATE - '90 days'::interval)
     ORDER BY a.attendance_date DESC
   ) t) AS attendance_90d,
  (SELECT json_agg(row_to_json(t.*) ORDER BY t.weekday)
   FROM (
     SELECT av.weekday, av.start_time, av.end_time, av.break_minutes
     FROM ops.staff_availability av
     WHERE av.staff_id = r.staff_id
   ) t) AS availability,
  (SELECT array_agg(va.issue)
   FROM ops.v_staff_anomalies va
   WHERE va.staff_id = r.staff_id) AS dq_flags
FROM ops.v_staff_register r
LEFT JOIN ops.staff_employment se ON se.id = r.staff_id
LEFT JOIN ops.v_staff_register_extended ext ON ext.staff_id = r.staff_id;

CREATE VIEW public.v_staff_register_extended AS SELECT * FROM ops.v_staff_register_extended;
CREATE VIEW public.v_staff_detail AS SELECT * FROM ops.v_staff_detail;

GRANT SELECT ON public.v_staff_register_extended TO anon, authenticated, service_role;
GRANT SELECT ON public.v_staff_detail            TO anon, authenticated, service_role;
GRANT SELECT ON ops.v_staff_register_extended    TO authenticated, service_role;
GRANT SELECT ON ops.v_staff_detail               TO authenticated, service_role;
