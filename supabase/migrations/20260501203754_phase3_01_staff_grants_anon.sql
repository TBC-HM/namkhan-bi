-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260501203754
-- Name:    phase3_01_staff_grants_anon
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Grant SELECT to anon on ops staff/payroll views so the v1 dashboard
-- (which hits Supabase as `anon` via NEXT_PUBLIC_SUPABASE_ANON_KEY) can read.
-- Sensitive aggregate data is gated at the frontend by DASHBOARD_PASSWORD.
-- For multi-user production: replace with real Supabase Auth + RLS.

-- Tables already RLS-open via qual=true policies — just need GRANT.
GRANT SELECT ON ops.staff_employment       TO anon;
GRANT SELECT ON ops.departments            TO anon;

-- Views (bypass underlying RLS via security_invoker=false default).
GRANT SELECT ON ops.v_staff_register             TO anon;
GRANT SELECT ON ops.v_staff_register_extended    TO anon;
GRANT SELECT ON ops.v_staff_anomalies            TO anon;
GRANT SELECT ON ops.v_staff_last_payslip         TO anon;
GRANT SELECT ON ops.v_payroll_dept_monthly       TO anon;