-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260430171523
-- Name:    phase1_14_ops_staff_planner_part2_attendance_payroll
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ============================================================
-- v1.4 part 2 — daily attendance, weekly availability, payroll
-- ============================================================

-- 1. Weekly availability template — Phase 1 simple
CREATE TABLE IF NOT EXISTS ops.staff_availability (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id        uuid NOT NULL REFERENCES ops.staff_employment(id) ON DELETE CASCADE,
  weekday         smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time      time,
  end_time        time,
  break_minutes   smallint DEFAULT 0,
  shift_template_id uuid REFERENCES ops.shift_templates(id),
  UNIQUE (staff_id, weekday)
);

-- 2. Daily attendance — D / X / AL / PH / SL / UPL
CREATE TABLE IF NOT EXISTS ops.staff_attendance (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     bigint NOT NULL DEFAULT 260955,
  staff_id        uuid NOT NULL REFERENCES ops.staff_employment(id),
  attendance_date date NOT NULL,
  code            text NOT NULL CHECK (code IN ('D','X','AL','PH','SL','UPL','MAT','TRN')),
  shift_template_id uuid REFERENCES ops.shift_templates(id),
  hours_worked    numeric(4,2),
  overtime_15x_h  numeric(4,2) DEFAULT 0,
  overtime_2x_h   numeric(4,2) DEFAULT 0,
  notes           text,
  imported_from   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS staff_attendance_date_idx
  ON ops.staff_attendance (property_id, attendance_date);
CREATE INDEX IF NOT EXISTS staff_attendance_staff_idx
  ON ops.staff_attendance (staff_id, attendance_date DESC);

-- 3. Monthly payroll snapshot — feeds Finance pillar
CREATE TABLE IF NOT EXISTS ops.payroll_monthly (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id           bigint NOT NULL DEFAULT 260955,
  staff_id              uuid NOT NULL REFERENCES ops.staff_employment(id),
  period_month          date NOT NULL,
  days_worked           smallint,
  days_off              smallint,
  days_annual_leave     smallint,
  days_public_holiday   smallint,
  days_sick             smallint,
  base_salary_lak       numeric(12,0) DEFAULT 0,
  base_salary_usd_equiv numeric(10,2) DEFAULT 0,
  overtime_15x_lak      numeric(12,0) DEFAULT 0,
  overtime_2x_lak       numeric(12,0) DEFAULT 0,
  service_charge_lak    numeric(12,0) DEFAULT 0,
  gasoline_allow_lak    numeric(12,0) DEFAULT 0,
  internet_allow_lak    numeric(12,0) DEFAULT 0,
  other_allow_lak       numeric(12,0) DEFAULT 0,
  adjustment_lak        numeric(12,0) DEFAULT 0,
  deduction_lak         numeric(12,0) DEFAULT 0,
  sso_5_5_lak           numeric(12,0) DEFAULT 0,
  tax_lak               numeric(12,0) DEFAULT 0,
  net_salary_lak        numeric(12,0) DEFAULT 0,
  net_salary_usd        numeric(10,2) DEFAULT 0,
  grand_total_usd       numeric(10,2) DEFAULT 0,
  fx_lak_usd            numeric(8,0),
  imported_from         text,
  imported_at           timestamptz DEFAULT now(),
  raw                   jsonb DEFAULT '{}'::jsonb,
  UNIQUE (staff_id, period_month)
);

CREATE INDEX IF NOT EXISTS payroll_monthly_period_idx
  ON ops.payroll_monthly (property_id, period_month DESC);
