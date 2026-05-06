-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260429225208
-- Name:    fix_b3_channel_mix_no_zero_rows_2026_04_30
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- B3: dashboard "Channel Mix top 6" should exclude channels with zero 90d revenue.
-- Don't alter mv_channel_perf (it's the ledger source).
-- Provide a clean dashboard-facing VIEW.

CREATE OR REPLACE VIEW public.v_channel_mix_dashboard AS
WITH base AS (
  SELECT
    property_id,
    source_name,
    bookings_30d,
    revenue_30d,
    bookings_90d,
    revenue_90d,
    bookings_365d,
    revenue_365d,
    adr_90d,
    avg_lead_time_90d,
    avg_los_90d
  FROM mv_channel_perf
  WHERE COALESCE(revenue_90d, 0) > 0  -- B3: drop zero-90d-revenue rows from dashboard
),
totals AS (
  SELECT property_id, SUM(revenue_90d) AS total_rev_90d FROM base GROUP BY property_id
)
SELECT
  b.*,
  ROUND(100.0 * b.revenue_90d / NULLIF(t.total_rev_90d, 0), 1) AS pct_of_total_90d
FROM base b
JOIN totals t USING (property_id);

COMMENT ON VIEW public.v_channel_mix_dashboard IS
'Dashboard-only channel mix. B3 fix 2026-04-30: excludes channels with zero 90d revenue. Use mv_channel_perf for ledger / full history.';