-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504164304
-- Name:    staff_bank_columns_and_archive_loader
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


ALTER TABLE ops.staff_employment
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account_no text,
  ADD COLUMN IF NOT EXISTS bank_account_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS notes text;

-- ops.departments dept_code lookup helper
CREATE OR REPLACE FUNCTION ops.f_dept_id(p_code text) RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT dept_id FROM ops.departments WHERE LOWER(code) = LOWER(p_code) LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION ops.f_staff_archive_loader(p_rows jsonb)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ops, public
AS $$
DECLARE n int;
BEGIN
  WITH src AS (
    SELECT
      (j->>'emp_id') AS emp_id,
      (j->>'full_name') AS full_name,
      (j->>'dept_code') AS dept_code,
      NULLIF((j->>'position'), '') AS position_title,
      NULLIF((j->>'hire_date'), '')::date AS hire_date,
      NULLIF((j->>'end_date'), '')::date AS end_date,
      COALESCE((j->>'monthly_salary')::numeric, 0) AS monthly_salary,
      NULLIF((j->>'bank_name'), '') AS bank_name,
      NULLIF((j->>'bank_account_no'), '') AS bank_account_no,
      NULLIF((j->>'bank_account_name'), '') AS bank_account_name,
      NULLIF((j->>'phone'), '') AS phone,
      NULLIF((j->>'notes'), '') AS notes
    FROM jsonb_array_elements(p_rows) j
  )
  INSERT INTO ops.staff_employment (
    id, property_id, emp_id, full_name, position_title, dept_id,
    employment_type, monthly_salary, salary_currency, hourly_cost_lak,
    contract_hours_pw, hire_date, end_date, is_active,
    bank_name, bank_account_no, bank_account_name, phone, notes
  )
  SELECT
    COALESCE((SELECT id FROM ops.staff_employment WHERE emp_id = src.emp_id LIMIT 1), gen_random_uuid()),
    260955,
    src.emp_id,
    src.full_name,
    src.position_title,
    ops.f_dept_id(src.dept_code),
    'full_time',
    src.monthly_salary,
    'LAK',
    ROUND(src.monthly_salary / NULLIF(48*4.33, 0), 0),
    48,
    src.hire_date,
    COALESCE(src.end_date, CURRENT_DATE),
    false,
    src.bank_name,
    src.bank_account_no,
    src.bank_account_name,
    src.phone,
    src.notes
  FROM src
  ON CONFLICT (emp_id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, ops.staff_employment.full_name),
    position_title = COALESCE(EXCLUDED.position_title, ops.staff_employment.position_title),
    end_date = COALESCE(EXCLUDED.end_date, ops.staff_employment.end_date),
    is_active = false,
    bank_name = COALESCE(EXCLUDED.bank_name, ops.staff_employment.bank_name),
    bank_account_no = COALESCE(EXCLUDED.bank_account_no, ops.staff_employment.bank_account_no),
    bank_account_name = COALESCE(EXCLUDED.bank_account_name, ops.staff_employment.bank_account_name),
    phone = COALESCE(EXCLUDED.phone, ops.staff_employment.phone),
    notes = COALESCE(EXCLUDED.notes, ops.staff_employment.notes),
    updated_at = NOW();

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_archive_load(p_rows jsonb)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = ops, public
AS $$
  SELECT ops.f_staff_archive_loader(p_rows);
$$;
GRANT EXECUTE ON FUNCTION public.staff_archive_load(jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.staff_archive_load(jsonb) FROM PUBLIC, anon, authenticated;
