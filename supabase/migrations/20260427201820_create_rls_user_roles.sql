-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427201820
-- Name:    create_rls_user_roles
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE SCHEMA IF NOT EXISTS auth_ext;

-- Role registry with hierarchy
CREATE TABLE IF NOT EXISTS auth_ext.user_roles (
  user_id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  full_name text,
  role text NOT NULL CHECK (role IN ('owner','admin','manager','viewer','viewer_partner')),
  departments text[] DEFAULT ARRAY[]::text[],
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Helper: current user's role
CREATE OR REPLACE FUNCTION auth_ext.current_role()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT role FROM auth_ext.user_roles 
  WHERE user_id = auth.uid() AND is_active = true
$$;

-- Helper: current user's departments
CREATE OR REPLACE FUNCTION auth_ext.current_depts()
RETURNS text[]
LANGUAGE sql STABLE
AS $$
  SELECT departments FROM auth_ext.user_roles 
  WHERE user_id = auth.uid() AND is_active = true
$$;

-- Helper: can user see USALI department?
CREATE OR REPLACE FUNCTION auth_ext.can_see_dept(p_dept text)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT 
    CASE 
      WHEN auth_ext.current_role() IN ('owner','admin') THEN true
      WHEN auth_ext.current_role() IN ('viewer') THEN true  -- owner-level viewer (Paul)
      WHEN p_dept = ANY(auth_ext.current_depts()) THEN true
      ELSE false
    END;
$$;

-- Apply RLS to plan tables
ALTER TABLE plan.scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan.lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan.account_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl.pnl_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl.fx_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE dq.violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dq.rules ENABLE ROW LEVEL SECURITY;

-- Read policies: owner/admin/viewer see all; manager sees own dept
CREATE POLICY plan_scenarios_read ON plan.scenarios
  FOR SELECT USING (
    auth_ext.current_role() IN ('owner','admin','viewer','viewer_partner','manager')
  );

CREATE POLICY plan_lines_read ON plan.lines
  FOR SELECT USING (
    auth_ext.current_role() IN ('owner','admin','viewer','viewer_partner') OR
    (auth_ext.current_role() = 'manager' AND EXISTS (
      SELECT 1 FROM plan.account_map m 
      WHERE m.account_code = plan.lines.account_code 
        AND m.usali_dept = ANY(auth_ext.current_depts())
    ))
  );

CREATE POLICY plan_account_map_read ON plan.account_map
  FOR SELECT USING (
    auth_ext.current_role() IS NOT NULL
  );

CREATE POLICY plan_drivers_read ON plan.drivers
  FOR SELECT USING (
    auth_ext.current_role() IS NOT NULL
  );

CREATE POLICY gl_accounts_read ON gl.accounts
  FOR SELECT USING (
    auth_ext.current_role() IS NOT NULL
  );

CREATE POLICY gl_transactions_read ON gl.transactions
  FOR SELECT USING (
    auth_ext.current_role() IN ('owner','admin','viewer') OR
    (auth_ext.current_role() = 'manager' AND 'Finance' = ANY(auth_ext.current_depts()))
  );

CREATE POLICY gl_pnl_snapshot_read ON gl.pnl_snapshot
  FOR SELECT USING (
    auth_ext.current_role() IN ('owner','admin','viewer') OR
    (auth_ext.current_role() = 'manager' AND 'Finance' = ANY(auth_ext.current_depts()))
  );

CREATE POLICY gl_fx_rates_read ON gl.fx_rates
  FOR SELECT USING (
    auth_ext.current_role() IS NOT NULL
  );

CREATE POLICY dq_violations_read ON dq.violations
  FOR SELECT USING (
    auth_ext.current_role() IN ('owner','admin','viewer')
  );

CREATE POLICY dq_rules_read ON dq.rules
  FOR SELECT USING (
    auth_ext.current_role() IN ('owner','admin','viewer','manager')
  );

-- Write policies: only owner/admin can write to plan; only owner can manage rules
CREATE POLICY plan_scenarios_write ON plan.scenarios
  FOR ALL USING (auth_ext.current_role() IN ('owner','admin'));

CREATE POLICY plan_lines_write ON plan.lines
  FOR ALL USING (auth_ext.current_role() IN ('owner','admin'));

CREATE POLICY plan_account_map_write ON plan.account_map
  FOR ALL USING (auth_ext.current_role() IN ('owner','admin'));

CREATE POLICY gl_accounts_write ON gl.accounts
  FOR ALL USING (auth_ext.current_role() IN ('owner','admin'));

CREATE POLICY gl_transactions_write ON gl.transactions
  FOR ALL USING (auth_ext.current_role() IN ('owner','admin'));

CREATE POLICY gl_pnl_snapshot_write ON gl.pnl_snapshot
  FOR ALL USING (auth_ext.current_role() IN ('owner','admin'));

CREATE POLICY dq_rules_write ON dq.rules
  FOR ALL USING (auth_ext.current_role() = 'owner');

CREATE POLICY dq_violations_write ON dq.violations
  FOR ALL USING (auth_ext.current_role() IN ('owner','admin'));

-- Service role bypasses RLS (for cron jobs) — already default in Supabase
-- Anon role gets nothing — RLS denies by default

COMMENT ON TABLE auth_ext.user_roles IS 'User role registry. Roles: owner (full), admin (full minus DQ rule edits), manager (dept-scoped), viewer (read-all), viewer_partner (read narrow).';