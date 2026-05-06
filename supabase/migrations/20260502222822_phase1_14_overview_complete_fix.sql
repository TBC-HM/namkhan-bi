-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502222822
-- Name:    phase1_14_overview_complete_fix
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- phase1_14_overview_complete_fix · 2026-05-03
-- Standardizes the dashboard overview page so that:
--   1. ONE view (v_overview_kpis) feeds the entire /overview page
--   2. ONE function returns period-comparison numbers for any window/compare combo
--   3. Definitions are explicit, documented, and match across tiles
--   4. LAK and USD are exposed as separate columns; frontend never multiplies
--   5. Open DQ count uses real definition (not whatever the page filters on)
--   6. Period window standard: trailing-N excluding today (stable through the day)
--      Today's metrics live in the LIVE tile only.

-- =============================================================================
-- 1) Helper: latest FX rate (USD→LAK) — single source of truth
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fx_usd_to_lak()
RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT rate FROM gl.fx_rates
  WHERE from_currency='USD' AND to_currency='LAK'
  ORDER BY rate_date DESC LIMIT 1
$$;

COMMENT ON FUNCTION public.fx_usd_to_lak() IS
  'Latest USD→LAK rate from gl.fx_rates. Use everywhere instead of hardcoded 21800. '
  'Currently ~21,617 (BCEL Apr 27 2026).';

-- =============================================================================
-- 2) Helper: period bounds for the WINDOW dropdown
-- =============================================================================
CREATE OR REPLACE FUNCTION public.period_bounds(p_window text)
RETURNS TABLE(period_start date, period_end date, label text, days int)
LANGUAGE sql STABLE AS $$
  SELECT
    CASE p_window
      WHEN 'TODAY'   THEN CURRENT_DATE
      WHEN '7D'      THEN CURRENT_DATE - 7
      WHEN '30D'     THEN CURRENT_DATE - 30
      WHEN '90D'     THEN CURRENT_DATE - 90
      WHEN 'YTD'     THEN date_trunc('year', CURRENT_DATE)::date
      WHEN 'NEXT_7'  THEN CURRENT_DATE
      WHEN 'NEXT_30' THEN CURRENT_DATE
      WHEN 'NEXT_90' THEN CURRENT_DATE
      ELSE CURRENT_DATE - 30
    END AS period_start,
    CASE p_window
      WHEN 'TODAY'   THEN CURRENT_DATE
      WHEN '7D'      THEN CURRENT_DATE - 1
      WHEN '30D'     THEN CURRENT_DATE - 1
      WHEN '90D'     THEN CURRENT_DATE - 1
      WHEN 'YTD'     THEN CURRENT_DATE - 1
      WHEN 'NEXT_7'  THEN CURRENT_DATE + 7
      WHEN 'NEXT_30' THEN CURRENT_DATE + 30
      WHEN 'NEXT_90' THEN CURRENT_DATE + 90
      ELSE CURRENT_DATE - 1
    END AS period_end,
    p_window AS label,
    CASE p_window
      WHEN 'TODAY'   THEN 1
      WHEN '7D'      THEN 7
      WHEN '30D'     THEN 30
      WHEN '90D'     THEN 90
      WHEN 'YTD'     THEN (CURRENT_DATE - date_trunc('year',CURRENT_DATE)::date)::int
      WHEN 'NEXT_7'  THEN 7
      WHEN 'NEXT_30' THEN 30
      WHEN 'NEXT_90' THEN 90
      ELSE 30
    END AS days
$$;

COMMENT ON FUNCTION public.period_bounds(text) IS
  'Returns [start, end] for the WINDOW dropdown values. '
  'Trailing windows END YESTERDAY (stable through the day, today shown in LIVE tile). '
  'Forward windows START TODAY. Pass 7D, 30D, 90D, YTD, TODAY, NEXT_7, NEXT_30, NEXT_90.';

-- =============================================================================
-- 3) Helper: comparison period bounds
-- =============================================================================
CREATE OR REPLACE FUNCTION public.compare_bounds(p_window text, p_compare text)
RETURNS TABLE(period_start date, period_end date, label text)
LANGUAGE sql STABLE AS $$
  WITH b AS (SELECT * FROM public.period_bounds(p_window))
  SELECT
    CASE p_compare
      WHEN 'NONE'       THEN NULL::date
      WHEN 'PREV_PERIOD' THEN (b.period_start - (b.period_end - b.period_start + 1))::date
      WHEN 'YOY'        THEN (b.period_start - INTERVAL '1 year')::date
      ELSE NULL::date
    END,
    CASE p_compare
      WHEN 'NONE'       THEN NULL::date
      WHEN 'PREV_PERIOD' THEN (b.period_start - 1)::date
      WHEN 'YOY'        THEN (b.period_end   - INTERVAL '1 year')::date
      ELSE NULL::date
    END,
    CASE p_compare
      WHEN 'NONE'        THEN 'No comparison'
      WHEN 'PREV_PERIOD' THEN 'Previous period'
      WHEN 'YOY'         THEN 'Same period last year'
      ELSE 'No comparison'
    END
  FROM b
$$;

COMMENT ON FUNCTION public.compare_bounds(text,text) IS
  'Returns comparison period for COMPARE dropdown. '
  'PREV_PERIOD: same length, immediately preceding. YOY: same window 1 year ago. NONE: nulls.';

-- =============================================================================
-- 4) THE single function the overview page calls.
--    Returns one row per (label, period_kind) combination — current + compare.
--    Filters by segment if provided.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.f_overview_kpis(
  p_window  text DEFAULT '30D',
  p_compare text DEFAULT 'NONE',
  p_segment text DEFAULT NULL  -- NULL = All segments
)
RETURNS TABLE(
  period_kind     text,    -- 'current' | 'compare'
  period_label    text,
  period_start    date,
  period_end      date,
  -- Capacity
  total_rooms     int,
  room_nights_capacity bigint,
  -- Volume
  rooms_sold      bigint,
  -- Pricing (USD primary; LAK derived from latest FX)
  occupancy_pct   numeric,
  adr_usd         numeric,
  revpar_usd      numeric,
  trevpar_usd     numeric,
  room_revenue_usd     numeric,
  total_revenue_usd    numeric,
  -- Per-occupied-room ancillaries
  fnb_per_occ_rn_usd       numeric,
  spa_per_occ_rn_usd       numeric,
  activity_per_occ_rn_usd  numeric,
  -- LAK display values (computed once, here)
  adr_lak         numeric,
  revpar_lak      numeric,
  trevpar_lak     numeric,
  room_revenue_lak     numeric,
  total_revenue_lak    numeric
)
LANGUAGE sql STABLE AS $$
  WITH
  fx AS (SELECT public.fx_usd_to_lak() AS r),
  windows AS (
    SELECT 'current'::text AS kind, period_start, period_end, label, days FROM public.period_bounds(p_window)
    UNION ALL
    SELECT 'compare'::text, period_start, period_end, label, NULL::int
    FROM public.compare_bounds(p_window, p_compare)
    WHERE p_compare <> 'NONE'
  ),
  agg AS (
    SELECT
      w.kind,
      w.label,
      w.period_start,
      w.period_end,
      24::int AS total_rooms,  -- TODO: reference v_property_totals.capacity_selling
      sum(d.rooms_inventory)                                          AS rn_capacity,
      sum(d.rooms_sold)                                                AS rs,
      sum(d.rooms_revenue)                                             AS room_rev,
      sum(d.fnb_revenue)                                               AS fnb_rev,
      sum(d.spa_revenue)                                               AS spa_rev,
      sum(d.activity_revenue)                                          AS act_rev,
      sum(d.rooms_revenue + d.total_ancillary_revenue)                 AS total_rev
    FROM windows w
    LEFT JOIN public.mv_kpi_daily d
           ON d.property_id = 260955
          AND d.night_date BETWEEN w.period_start AND w.period_end
    -- Segment filter joins through mv_kpi_daily_by_segment if requested
    WHERE (p_segment IS NULL OR p_segment = 'All' OR EXISTS (
            SELECT 1 FROM public.mv_kpi_daily_by_segment s
            WHERE s.metric_date = d.night_date AND s.segment = p_segment
          ))
    GROUP BY w.kind, w.label, w.period_start, w.period_end
  )
  SELECT
    a.kind                        AS period_kind,
    a.label                       AS period_label,
    a.period_start, a.period_end,
    a.total_rooms,
    a.rn_capacity                  AS room_nights_capacity,
    coalesce(a.rs, 0)              AS rooms_sold,
    -- Occupancy
    CASE WHEN a.rn_capacity > 0
         THEN round(100.0 * a.rs / a.rn_capacity, 1) ELSE 0 END        AS occupancy_pct,
    -- ADR / RevPAR / TRevPAR (USD, the unit of mv_kpi_daily)
    CASE WHEN a.rs > 0 THEN round(a.room_rev / a.rs, 0) ELSE 0 END     AS adr_usd,
    CASE WHEN a.rn_capacity > 0
         THEN round(a.room_rev / a.rn_capacity, 0) ELSE 0 END           AS revpar_usd,
    CASE WHEN a.rn_capacity > 0
         THEN round(a.total_rev / a.rn_capacity, 0) ELSE 0 END          AS trevpar_usd,
    coalesce(a.room_rev, 0)        AS room_revenue_usd,
    coalesce(a.total_rev, 0)       AS total_revenue_usd,
    -- Per-occupied-room ancillaries
    CASE WHEN a.rs > 0 THEN round(a.fnb_rev / a.rs, 0) ELSE 0 END      AS fnb_per_occ_rn_usd,
    CASE WHEN a.rs > 0 THEN round(a.spa_rev / a.rs, 0) ELSE 0 END      AS spa_per_occ_rn_usd,
    CASE WHEN a.rs > 0 THEN round(a.act_rev / a.rs, 0) ELSE 0 END      AS activity_per_occ_rn_usd,
    -- LAK (computed once here; frontend just reads the column)
    CASE WHEN a.rs > 0
         THEN round(a.room_rev / a.rs * fx.r, 0) ELSE 0 END             AS adr_lak,
    CASE WHEN a.rn_capacity > 0
         THEN round(a.room_rev / a.rn_capacity * fx.r, 0) ELSE 0 END    AS revpar_lak,
    CASE WHEN a.rn_capacity > 0
         THEN round(a.total_rev / a.rn_capacity * fx.r, 0) ELSE 0 END   AS trevpar_lak,
    coalesce(round(a.room_rev * fx.r, 0), 0)    AS room_revenue_lak,
    coalesce(round(a.total_rev * fx.r, 0), 0)   AS total_revenue_lak
  FROM agg a, fx
  ORDER BY a.kind DESC;  -- 'current' first, 'compare' second
$$;

COMMENT ON FUNCTION public.f_overview_kpis(text,text,text) IS
  'Single source for the overview page period KPIs. '
  'Returns 1 or 2 rows: current period and (if requested) comparison period. '
  'Both USD and LAK columns are pre-computed using latest FX. '
  'Frontend reads columns directly — never multiplies/converts.';

-- =============================================================================
-- 5) View: live "Right Now" tile
-- =============================================================================
CREATE OR REPLACE VIEW public.v_overview_live AS
SELECT
  property_id,
  as_of,
  in_house,
  arrivals_today          AS arriving_today,
  departures_today        AS departing_today,
  expected_arrivals_today,
  otb_next_90d,
  cancellation_pct_90d    AS cancellation_pct,
  no_show_pct_90d         AS no_show_pct,
  occupied_tonight,
  total_rooms
FROM public.mv_kpi_today;

COMMENT ON VIEW public.v_overview_live IS
  'Live tile: in-house/arriving/departing TODAY. '
  'Reads mv_kpi_today which now correctly filters in_house = checked_in only.';

-- =============================================================================
-- 6) DQ open count — real definition
-- =============================================================================
CREATE OR REPLACE VIEW public.v_overview_dq AS
SELECT
  count(*)                                              AS open_total,
  count(*) FILTER (WHERE severity = 'high')             AS open_high,
  count(*) FILTER (WHERE severity = 'med')              AS open_med,
  count(*) FILTER (WHERE severity = 'low')              AS open_low,
  count(*) FILTER (WHERE detected_at > now() - interval '24 hours') AS new_24h
FROM dq.violations
WHERE resolved_at IS NULL;

COMMENT ON VIEW public.v_overview_dq IS
  'Real DQ open count: any violation where resolved_at IS NULL. '
  'Use open_total for the OPEN DQ ISSUES tile. open_high alone is misleading.';

-- =============================================================================
-- 7) Segment dropdown source — only segments with data in last 365 days
-- =============================================================================
CREATE OR REPLACE VIEW public.v_overview_segments AS
SELECT
  'All' AS segment,
  0 AS sort_order,
  true AS has_recent_data
UNION ALL
SELECT DISTINCT
  ms.name AS segment,
  1 AS sort_order,
  EXISTS (
    SELECT 1 FROM public.mv_kpi_daily_by_segment s
    WHERE s.segment = ms.name
      AND s.metric_date >= CURRENT_DATE - 365
  ) AS has_recent_data
FROM public.market_segments ms
WHERE ms.is_active
ORDER BY 2, 1;

COMMENT ON VIEW public.v_overview_segments IS
  'Source for the SEGMENT dropdown. has_recent_data lets frontend grey out empty segments.';

-- =============================================================================
-- 8) Refresh today matview to make sure it is current
-- =============================================================================
REFRESH MATERIALIZED VIEW public.mv_kpi_today;