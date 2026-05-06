-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503173356
-- Name:    dq_payroll_demand_views_2026_05_03
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- DQ rollup across pillars
CREATE OR REPLACE VIEW gl.v_dq_summary AS
SELECT
  count(*) FILTER (WHERE resolved_at IS NULL)                            AS open_total,
  count(*) FILTER (WHERE resolved_at IS NULL AND severity = 'CRITICAL')  AS open_critical,
  count(*) FILTER (WHERE resolved_at IS NULL AND severity = 'WARNING')   AS open_warning,
  count(*) FILTER (WHERE resolved_at IS NULL AND severity = 'INFO')      AS open_info,
  max(detected_at) FILTER (WHERE resolved_at IS NULL)                    AS latest_open_at
FROM dq.violations;

GRANT USAGE ON SCHEMA dq TO anon, service_role;
GRANT SELECT ON dq.violations TO anon, service_role;
GRANT SELECT ON gl.v_dq_summary TO anon, service_role;

-- Payroll monthly rollup (ops.payroll_monthly → period × USD)
CREATE OR REPLACE VIEW gl.v_payroll_summary AS
SELECT
  to_char(period_month, 'YYYY-MM')                            AS period_yyyymm,
  count(DISTINCT staff_id)                                    AS staff_count,
  sum(grand_total_usd)::numeric(14, 2)                        AS gross_payroll_usd,
  sum(net_salary_usd)::numeric(14, 2)                         AS net_payroll_usd,
  sum(days_worked)                                            AS total_days_worked,
  sum(days_annual_leave + days_public_holiday + days_sick)    AS days_off
FROM ops.payroll_monthly
GROUP BY 1;

GRANT USAGE ON SCHEMA ops TO anon, service_role;
GRANT SELECT ON ops.payroll_monthly TO anon, service_role;
GRANT SELECT ON gl.v_payroll_summary TO anon, service_role;

-- Demand calendar rollup → forward 12 months: % days flagged peak/lunar
CREATE OR REPLACE VIEW gl.v_demand_summary AS
SELECT
  to_char(cal_date, 'YYYY-MM')                              AS period_yyyymm,
  count(*)                                                  AS days,
  count(*) FILTER (WHERE is_lp_peak)                        AS peak_days,
  count(*) FILTER (WHERE is_lunar_significant)              AS lunar_days,
  round(avg(dow_score)::numeric, 2)                         AS avg_dow_score,
  round(avg(event_score)::numeric, 2)                       AS avg_event_score
FROM revenue.demand_calendar
GROUP BY 1
ORDER BY 1;

GRANT USAGE ON SCHEMA revenue TO anon, service_role;
GRANT SELECT ON revenue.demand_calendar TO anon, service_role;
GRANT SELECT ON gl.v_demand_summary TO anon, service_role;