-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504141031
-- Name:    staff_payroll_canonical_trigger
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Force net_salary_lak / net_salary_usd / grand_total_usd to canonical truth on every
-- INSERT/UPDATE of ops.payroll_monthly. Belt-and-braces — replaces the dependency on
-- whatever XLSX importer ran in the past producing inconsistent values.
--
-- Definitions (locked):
--   canonical_net_lak   = base + OT 1.5× + OT 2× + SC + gas + internet + other + adjustment
--                       − SSO − tax − special_deduction
--   canonical_cost_lak  = same as net + SSO + tax + special_deduction
--                       (i.e. all gross earnings — what the company allocates as payroll cost)
--   net_salary_lak      ← canonical_net_lak
--   net_salary_usd      ← canonical_net_lak / fx_lak_usd
--   grand_total_usd     ← canonical_cost_lak / fx_lak_usd  (now means "company cost in USD")

CREATE OR REPLACE FUNCTION ops.f_payroll_canonical()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_net_lak numeric;
  v_cost_lak numeric;
BEGIN
  v_net_lak :=
    COALESCE(NEW.base_salary_lak,0)     + COALESCE(NEW.overtime_15x_lak,0) + COALESCE(NEW.overtime_2x_lak,0)
    + COALESCE(NEW.service_charge_lak,0) + COALESCE(NEW.gasoline_allow_lak,0)
    + COALESCE(NEW.internet_allow_lak,0) + COALESCE(NEW.other_allow_lak,0)
    + COALESCE(NEW.adjustment_lak,0)
    - COALESCE(NEW.deduction_lak,0)      - COALESCE(NEW.sso_5_5_lak,0)      - COALESCE(NEW.tax_lak,0);

  v_cost_lak :=
    COALESCE(NEW.base_salary_lak,0)     + COALESCE(NEW.overtime_15x_lak,0) + COALESCE(NEW.overtime_2x_lak,0)
    + COALESCE(NEW.service_charge_lak,0) + COALESCE(NEW.gasoline_allow_lak,0)
    + COALESCE(NEW.internet_allow_lak,0) + COALESCE(NEW.other_allow_lak,0)
    + COALESCE(NEW.adjustment_lak,0);

  NEW.net_salary_lak  := ROUND(v_net_lak, 0);
  NEW.net_salary_usd  := CASE WHEN COALESCE(NEW.fx_lak_usd,0) > 0
                              THEN ROUND(v_net_lak / NEW.fx_lak_usd, 2)
                              ELSE NEW.net_salary_usd
                         END;
  NEW.grand_total_usd := CASE WHEN COALESCE(NEW.fx_lak_usd,0) > 0
                              THEN ROUND(v_cost_lak / NEW.fx_lak_usd, 2)
                              ELSE NEW.grand_total_usd
                         END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payroll_canonical ON ops.payroll_monthly;
CREATE TRIGGER trg_payroll_canonical
BEFORE INSERT OR UPDATE ON ops.payroll_monthly
FOR EACH ROW
EXECUTE FUNCTION ops.f_payroll_canonical();

COMMENT ON FUNCTION ops.f_payroll_canonical() IS
  'Locks net_salary_lak / net_salary_usd / grand_total_usd to canonical line-item math. Source XLSX importer historically produced inconsistent values; this trigger guarantees future writes are consistent regardless of import path.';
