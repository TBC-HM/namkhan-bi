-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504141412
-- Name:    create_v_cash_forecast_13w
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- 13-week cash forecast derived from Cloudbeds OTB + AR + planned outflows.
-- Inflows: confirmed reservation balances arriving each week + AR aging allocation
-- Outflows: monthly fixed costs (payroll + utilities + mgmt fees + A&G base) /4.33
-- Output: one row per week_start (ISO week Monday) with inflow/outflow/net.
-- Position is computed at render time (starting cash = configurable, default 0).

CREATE OR REPLACE VIEW gl.v_cash_forecast_13w AS
WITH weeks AS (
  -- Generate next 13 ISO weeks starting Monday
  SELECT
    (date_trunc('week', CURRENT_DATE) + (i * INTERVAL '1 week'))::date AS week_start,
    i AS week_idx
  FROM generate_series(0, 12) AS i
),
otb_inflow AS (
  -- Sum balance for confirmed reservations with check_in in each week
  SELECT
    date_trunc('week', r.check_in_date)::date AS week_start,
    SUM(r.balance)::numeric AS amt
  FROM public.reservations r
  WHERE r.property_id = 260955
    AND r.status = 'confirmed'
    AND r.check_in_date >= CURRENT_DATE
    AND r.check_in_date < CURRENT_DATE + INTERVAL '13 weeks'
  GROUP BY 1
),
ar_inflow AS (
  -- Aged AR collection schedule: 0-30 collected weeks 1-4, 31-60 collected weeks 5-8,
  -- 61-90 collected weeks 9-12, 90+ collected week 13 (best-effort)
  SELECT week_start, SUM(amt)::numeric AS amt
  FROM (
    SELECT (SELECT week_start FROM weeks WHERE week_idx = (n-1)) AS week_start,
           (SELECT SUM(open_balance) FROM public.mv_aged_ar WHERE bucket='0_30')/4.0 AS amt
    FROM generate_series(1, 4) n
    UNION ALL
    SELECT (SELECT week_start FROM weeks WHERE week_idx = (n+3)) AS week_start,
           (SELECT SUM(open_balance) FROM public.mv_aged_ar WHERE bucket='31_60')/4.0 AS amt
    FROM generate_series(1, 4) n
    UNION ALL
    SELECT (SELECT week_start FROM weeks WHERE week_idx = (n+7)) AS week_start,
           (SELECT SUM(open_balance) FROM public.mv_aged_ar WHERE bucket='61_90')/4.0 AS amt
    FROM generate_series(1, 4) n
    UNION ALL
    SELECT (SELECT week_start FROM weeks WHERE week_idx = 12) AS week_start,
           (SELECT SUM(open_balance) FROM public.mv_aged_ar WHERE bucket='90_plus') AS amt
  ) ar_buckets
  WHERE week_start IS NOT NULL
  GROUP BY 1
),
fixed_outflow AS (
  -- Sum of monthly fixed cost subcats from Budget 2026 v1, weekly = monthly / 4.33
  SELECT
    week_start,
    -1 * (
      COALESCE((SELECT SUM(amount_usd) FROM gl.v_budget_lines
                WHERE period_yyyymm = TO_CHAR(week_start, 'YYYY-MM')
                  AND usali_subcategory IN ('Payroll & Related','Utilities','Mgmt Fees','A&G')),
              35000)
    ) / 4.33 AS amt
  FROM weeks
),
supplier_outflow AS (
  -- Estimate from last 90 days of QB vendor payments (gl.v_supplier_transactions if exists)
  SELECT
    week_start,
    -1 * COALESCE(
      (SELECT SUM(ABS(amount_usd))
       FROM gl.gl_entries g JOIN gl.accounts a ON a.account_id = g.account_id
       WHERE g.txn_date >= CURRENT_DATE - 90
         AND a.usali_subcategory IN ('Cost of Sales','Other Operating Expenses','POM')) / 13.0,
      5000
    )::numeric AS amt
  FROM weeks
)
SELECT
  w.week_start,
  w.week_idx,
  TO_CHAR(w.week_start, 'IYYY-"W"IW') AS iso_week,
  COALESCE(o.amt, 0)::numeric(18,2) AS otb_inflow,
  COALESCE(a.amt, 0)::numeric(18,2) AS ar_inflow,
  COALESCE(f.amt, 0)::numeric(18,2) AS fixed_outflow,
  COALESCE(s.amt, 0)::numeric(18,2) AS supplier_outflow,
  (COALESCE(o.amt, 0) + COALESCE(a.amt, 0) + COALESCE(f.amt, 0) + COALESCE(s.amt, 0))::numeric(18,2) AS net_cash_flow
FROM weeks w
LEFT JOIN otb_inflow      o ON o.week_start = w.week_start
LEFT JOIN ar_inflow       a ON a.week_start = w.week_start
LEFT JOIN fixed_outflow   f ON f.week_start = w.week_start
LEFT JOIN supplier_outflow s ON s.week_start = w.week_start
ORDER BY w.week_idx;

COMMENT ON VIEW gl.v_cash_forecast_13w IS
'13-week rolling cash forecast. Inflows = OTB reservation balances + AR aging allocation. Outflows = monthly fixed (/4.33) + 90d supplier avg /13. Starting cash assumed $0 — overlay actual bank balance at render. Refreshes on every query.';

GRANT SELECT ON gl.v_cash_forecast_13w TO authenticated, anon, service_role;
