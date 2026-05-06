-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502222941
-- Name:    phase1_14a_overview_segment_filter_fix
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Fix the segment filter so it actually filters, not just selects days where segment appeared.
-- Two query paths: All-segments uses mv_kpi_daily (has F&B/Spa/Activity); a specific segment
-- uses mv_kpi_daily_by_segment (no ancillaries — those aren't tracked per-segment).

CREATE OR REPLACE FUNCTION public.f_overview_kpis(
  p_window  text DEFAULT '30D',
  p_compare text DEFAULT 'NONE',
  p_segment text DEFAULT NULL
)
RETURNS TABLE(
  period_kind     text,
  period_label    text,
  period_start    date,
  period_end      date,
  total_rooms     int,
  room_nights_capacity bigint,
  rooms_sold      bigint,
  occupancy_pct   numeric,
  adr_usd         numeric,
  revpar_usd      numeric,
  trevpar_usd     numeric,
  room_revenue_usd     numeric,
  total_revenue_usd    numeric,
  fnb_per_occ_rn_usd       numeric,
  spa_per_occ_rn_usd       numeric,
  activity_per_occ_rn_usd  numeric,
  adr_lak         numeric,
  revpar_lak      numeric,
  trevpar_lak     numeric,
  room_revenue_lak     numeric,
  total_revenue_lak    numeric
)
LANGUAGE sql STABLE AS $$
  WITH
  fx  AS (SELECT public.fx_usd_to_lak() AS r),
  cap AS (SELECT capacity_selling::int AS keys FROM public.v_property_totals LIMIT 1),
  windows AS (
    SELECT 'current'::text AS kind, period_start, period_end, label FROM public.period_bounds(p_window)
    UNION ALL
    SELECT 'compare'::text, period_start, period_end, label
    FROM public.compare_bounds(p_window, p_compare) WHERE p_compare <> 'NONE'
  ),
  -- All-segments path: mv_kpi_daily (full ancillaries)
  agg_all AS (
    SELECT
      w.kind, w.label, w.period_start, w.period_end,
      sum(d.rooms_inventory)                              AS rn_capacity,
      sum(d.rooms_sold)                                    AS rs,
      sum(d.rooms_revenue)                                 AS room_rev,
      sum(d.fnb_revenue)                                   AS fnb_rev,
      sum(d.spa_revenue)                                   AS spa_rev,
      sum(d.activity_revenue)                              AS act_rev,
      sum(d.rooms_revenue + d.total_ancillary_revenue)     AS total_rev
    FROM windows w
    LEFT JOIN public.mv_kpi_daily d
           ON d.property_id = 260955 AND d.night_date BETWEEN w.period_start AND w.period_end
    GROUP BY w.kind, w.label, w.period_start, w.period_end
  ),
  -- Per-segment path: mv_kpi_daily_by_segment (no ancillaries — set to 0)
  agg_seg AS (
    SELECT
      w.kind, w.label, w.period_start, w.period_end,
      ((w.period_end - w.period_start + 1) * (SELECT keys FROM cap))::bigint AS rn_capacity,
      coalesce(sum(s.rooms_sold), 0)        AS rs,
      coalesce(sum(s.revenue_usd), 0)       AS room_rev,
      0::numeric AS fnb_rev,
      0::numeric AS spa_rev,
      0::numeric AS act_rev,
      coalesce(sum(s.revenue_usd), 0)       AS total_rev  -- segment data has no ancillaries
    FROM windows w
    LEFT JOIN public.mv_kpi_daily_by_segment s
           ON s.metric_date BETWEEN w.period_start AND w.period_end
          AND s.segment = p_segment
    GROUP BY w.kind, w.label, w.period_start, w.period_end
  ),
  agg AS (
    SELECT * FROM agg_all WHERE p_segment IS NULL OR p_segment = 'All' OR p_segment = ''
    UNION ALL
    SELECT * FROM agg_seg WHERE p_segment IS NOT NULL AND p_segment <> 'All' AND p_segment <> ''
  )
  SELECT
    a.kind, a.label, a.period_start, a.period_end,
    (SELECT keys FROM cap) AS total_rooms,
    a.rn_capacity,
    coalesce(a.rs, 0)     AS rooms_sold,
    CASE WHEN a.rn_capacity > 0
         THEN round(100.0 * a.rs / a.rn_capacity, 1) ELSE 0 END        AS occupancy_pct,
    CASE WHEN a.rs > 0 THEN round(a.room_rev / a.rs, 0) ELSE 0 END     AS adr_usd,
    CASE WHEN a.rn_capacity > 0
         THEN round(a.room_rev / a.rn_capacity, 0) ELSE 0 END           AS revpar_usd,
    CASE WHEN a.rn_capacity > 0
         THEN round(a.total_rev / a.rn_capacity, 0) ELSE 0 END          AS trevpar_usd,
    coalesce(a.room_rev, 0)        AS room_revenue_usd,
    coalesce(a.total_rev, 0)       AS total_revenue_usd,
    CASE WHEN a.rs > 0 THEN round(a.fnb_rev / a.rs, 0) ELSE 0 END      AS fnb_per_occ_rn_usd,
    CASE WHEN a.rs > 0 THEN round(a.spa_rev / a.rs, 0) ELSE 0 END      AS spa_per_occ_rn_usd,
    CASE WHEN a.rs > 0 THEN round(a.act_rev / a.rs, 0) ELSE 0 END      AS activity_per_occ_rn_usd,
    CASE WHEN a.rs > 0
         THEN round(a.room_rev / a.rs * fx.r, 0) ELSE 0 END             AS adr_lak,
    CASE WHEN a.rn_capacity > 0
         THEN round(a.room_rev / a.rn_capacity * fx.r, 0) ELSE 0 END    AS revpar_lak,
    CASE WHEN a.rn_capacity > 0
         THEN round(a.total_rev / a.rn_capacity * fx.r, 0) ELSE 0 END   AS trevpar_lak,
    coalesce(round(a.room_rev * fx.r, 0), 0)    AS room_revenue_lak,
    coalesce(round(a.total_rev * fx.r, 0), 0)   AS total_revenue_lak
  FROM agg a, fx
  ORDER BY (CASE a.kind WHEN 'current' THEN 0 ELSE 1 END);
$$;