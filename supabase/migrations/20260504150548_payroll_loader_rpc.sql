-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504150548
-- Name:    payroll_loader_rpc
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Helper: bulk-load payroll rows from a JSONB array (UPSERT on (staff_id, period_month)).
-- Lets us push thousands of rows with one apply_migration call carrying compact JSON.
CREATE OR REPLACE FUNCTION ops.f_payroll_loader(p_rows jsonb, p_property_id bigint DEFAULT 260955)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ops, public
AS $$
DECLARE
  n int;
BEGIN
  WITH src AS (
    SELECT
      (j->>'staff_id')::uuid AS staff_id,
      (j->>'period_month')::date AS period_month,
      COALESCE((j->>'days_worked')::int, 0) AS days_worked,
      COALESCE((j->>'days_off')::int, 0) AS days_off,
      COALESCE((j->>'days_annual_leave')::int, 0) AS days_annual_leave,
      COALESCE((j->>'days_public_holiday')::int, 0) AS days_public_holiday,
      COALESCE((j->>'days_sick')::int, 0) AS days_sick,
      COALESCE((j->>'base_salary_lak')::numeric, 0) AS base_salary_lak,
      COALESCE((j->>'overtime_15x_lak')::numeric, 0) AS overtime_15x_lak,
      COALESCE((j->>'overtime_2x_lak')::numeric, 0) AS overtime_2x_lak,
      COALESCE((j->>'service_charge_lak')::numeric, 0) AS service_charge_lak,
      COALESCE((j->>'gasoline_allow_lak')::numeric, 0) AS gasoline_allow_lak,
      COALESCE((j->>'internet_allow_lak')::numeric, 0) AS internet_allow_lak,
      COALESCE((j->>'other_allow_lak')::numeric, 0) AS other_allow_lak,
      COALESCE((j->>'adjustment_lak')::numeric, 0) AS adjustment_lak,
      COALESCE((j->>'deduction_lak')::numeric, 0) AS deduction_lak,
      COALESCE((j->>'sso_5_5_lak')::numeric, 0) AS sso_5_5_lak,
      COALESCE((j->>'tax_lak')::numeric, 0) AS tax_lak,
      COALESCE((j->>'fx_lak_usd')::numeric, 21500) AS fx_lak_usd,
      (j->>'imported_from') AS imported_from
    FROM jsonb_array_elements(p_rows) j
  )
  INSERT INTO ops.payroll_monthly (
    staff_id, property_id, period_month,
    days_worked, days_off, days_annual_leave, days_public_holiday, days_sick,
    base_salary_lak, overtime_15x_lak, overtime_2x_lak,
    service_charge_lak, gasoline_allow_lak, internet_allow_lak, other_allow_lak,
    adjustment_lak, deduction_lak, sso_5_5_lak, tax_lak,
    fx_lak_usd, imported_from, imported_at
  )
  SELECT
    staff_id, p_property_id, period_month,
    days_worked, days_off, days_annual_leave, days_public_holiday, days_sick,
    base_salary_lak, overtime_15x_lak, overtime_2x_lak,
    service_charge_lak, gasoline_allow_lak, internet_allow_lak, other_allow_lak,
    adjustment_lak, deduction_lak, sso_5_5_lak, tax_lak,
    fx_lak_usd, imported_from, NOW()
  FROM src
  ON CONFLICT (staff_id, period_month) DO UPDATE SET
    days_worked = EXCLUDED.days_worked,
    days_off = EXCLUDED.days_off,
    days_annual_leave = EXCLUDED.days_annual_leave,
    days_public_holiday = EXCLUDED.days_public_holiday,
    days_sick = EXCLUDED.days_sick,
    base_salary_lak = EXCLUDED.base_salary_lak,
    overtime_15x_lak = EXCLUDED.overtime_15x_lak,
    overtime_2x_lak = EXCLUDED.overtime_2x_lak,
    service_charge_lak = EXCLUDED.service_charge_lak,
    gasoline_allow_lak = EXCLUDED.gasoline_allow_lak,
    internet_allow_lak = EXCLUDED.internet_allow_lak,
    other_allow_lak = EXCLUDED.other_allow_lak,
    adjustment_lak = EXCLUDED.adjustment_lak,
    deduction_lak = EXCLUDED.deduction_lak,
    sso_5_5_lak = EXCLUDED.sso_5_5_lak,
    tax_lak = EXCLUDED.tax_lak,
    fx_lak_usd = EXCLUDED.fx_lak_usd,
    imported_from = EXCLUDED.imported_from,
    imported_at = NOW();

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION ops.f_payroll_loader(jsonb, bigint) TO service_role;
