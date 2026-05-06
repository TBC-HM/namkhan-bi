-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503171034
-- Name:    demand_calendar_from_canonical_events
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ============================================================
-- Function to (re)build demand_calendar from canonical events
-- Re-run this whenever events are added/changed
-- ============================================================
CREATE OR REPLACE FUNCTION revenue.fn_rebuild_demand_calendar() RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Reset event tags
  UPDATE revenue.demand_calendar SET 
    events = ARRAY[]::TEXT[], 
    event_score = 0, 
    is_lp_peak = false,
    is_lunar_significant = false,
    source_markets = ARRAY[]::TEXT[];
  
  -- Apply each event to dates within its full window (buildup_start through date_end)
  -- Score decays during buildup, peaks during actual event window
  WITH event_dates AS (
    SELECT 
      d::date AS cal_date,
      e.type_code,
      e.demand_score_override,
      t.default_demand_score,
      e.date_start,
      e.date_end,
      e.buildup_start,
      e.source_markets AS event_markets,
      t.default_source_markets,
      -- During the event itself, full score
      -- During buildup window, scaled score (50-90% of full based on proximity)
      CASE 
        WHEN d::date BETWEEN e.date_start AND e.date_end THEN 1.0
        WHEN d::date < e.date_start AND d::date >= e.buildup_start THEN
          0.5 + (0.4 * (1.0 - (e.date_start - d::date)::float / NULLIF(e.date_start - e.buildup_start, 0)))
        ELSE 1.0
      END AS score_multiplier
    FROM marketing.calendar_events e
    JOIN marketing.calendar_event_types t ON t.type_code = e.type_code
    CROSS JOIN LATERAL generate_series(
      e.buildup_start, 
      e.date_end, 
      '1 day'::interval
    ) d
    WHERE e.applies_to_rate_shop = true
  ),
  scored_dates AS (
    SELECT 
      cal_date,
      ARRAY_AGG(DISTINCT type_code) AS events,
      MAX((COALESCE(demand_score_override, default_demand_score) * score_multiplier)::int)::smallint AS top_score,
      BOOL_OR(default_demand_score >= 90) AS has_peak,
      BOOL_OR(type_code IN ('full_moon', 'retreat_anchor_full_moon')) AS is_lunar,
      ARRAY_AGG(DISTINCT m) FILTER (WHERE m IS NOT NULL) AS markets
    FROM event_dates
    LEFT JOIN LATERAL unnest(COALESCE(NULLIF(event_markets, ARRAY[]::TEXT[]), default_source_markets)) AS m ON true
    GROUP BY cal_date
  )
  UPDATE revenue.demand_calendar dc
  SET 
    events = sd.events,
    event_score = sd.top_score,
    is_lp_peak = sd.has_peak,
    is_lunar_significant = sd.is_lunar,
    source_markets = sd.markets
  FROM scored_dates sd
  WHERE dc.cal_date = sd.cal_date;
  
  -- Apply seasons from marketing.seasons (Namkhan-specific authoritative)
  UPDATE revenue.demand_calendar dc SET season = 
    CASE s.season_code
      WHEN 'high' THEN 'high'
      WHEN 'green' THEN 'low'
      ELSE 'shoulder'
    END
  FROM marketing.seasons s
  WHERE s.is_active = true
    AND s.property_id = 260955
    AND dc.cal_date BETWEEN s.date_start AND s.date_end;
  
  -- Anything still null = shoulder
  UPDATE revenue.demand_calendar SET season = 'shoulder' WHERE season IS NULL;
END;
$$;

COMMENT ON FUNCTION revenue.fn_rebuild_demand_calendar IS 'Rebuilds revenue.demand_calendar event_score, events, and season tags from marketing.calendar_events (canonical) and marketing.seasons. Run after editing events.';

-- Run it now
SELECT revenue.fn_rebuild_demand_calendar();
