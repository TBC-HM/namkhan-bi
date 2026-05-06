-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260501203906
-- Name:    phase3_02_staff_public_proxies
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Public-schema proxies for the staff module so the v1 dashboard
-- (which queries the default `public` schema via PostgREST) can read.
-- Pure pass-through views; ops schema remains the source of truth.

CREATE OR REPLACE VIEW public.v_staff_register_extended AS
  SELECT * FROM ops.v_staff_register_extended;

CREATE OR REPLACE VIEW public.v_staff_anomalies AS
  SELECT * FROM ops.v_staff_anomalies;

CREATE OR REPLACE VIEW public.v_payroll_dept_monthly AS
  SELECT * FROM ops.v_payroll_dept_monthly;

GRANT SELECT ON public.v_staff_register_extended  TO anon, authenticated;
GRANT SELECT ON public.v_staff_anomalies          TO anon, authenticated;
GRANT SELECT ON public.v_payroll_dept_monthly     TO anon, authenticated;

COMMENT ON VIEW public.v_staff_register_extended IS
  'Public proxy for ops.v_staff_register_extended. Read by /operations/staff.';
COMMENT ON VIEW public.v_staff_anomalies IS
  'Public proxy for ops.v_staff_anomalies.';
COMMENT ON VIEW public.v_payroll_dept_monthly IS
  'Public proxy for ops.v_payroll_dept_monthly.';