-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503170422
-- Name:    demand_calendar_for_smart_date_picker
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ============================================================
-- TABLE: revenue.demand_calendar
-- One row per date. Drives smart date selection for rate-shop agent.
-- Seeded for 2026-2028. Re-seed annually.
-- ============================================================
CREATE TABLE IF NOT EXISTS revenue.demand_calendar (
  cal_date DATE PRIMARY KEY,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Sun, 6=Sat
  iso_week SMALLINT NOT NULL,
  month SMALLINT NOT NULL,
  
  -- Day-of-week score (Fri/Sat highest for LP leisure market)
  dow_score SMALLINT NOT NULL,  -- 0-100
  
  -- Calendar events
  events TEXT[] DEFAULT ARRAY[]::TEXT[],  -- ['pi_mai','full_moon','xmas']
  event_score SMALLINT NOT NULL DEFAULT 0,  -- 0-100
  
  -- Season tags
  season TEXT,  -- 'high'|'shoulder'|'low'
  is_lp_peak BOOLEAN DEFAULT false,
  is_lunar_significant BOOLEAN DEFAULT false,
  
  -- Source markets impact (which feeders care about this date)
  source_markets TEXT[] DEFAULT ARRAY[]::TEXT[],  -- ['EU','US','CN','TH']
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demand_calendar_events ON revenue.demand_calendar USING GIN (events);
CREATE INDEX IF NOT EXISTS idx_demand_calendar_score ON revenue.demand_calendar (event_score DESC);
CREATE INDEX IF NOT EXISTS idx_demand_calendar_peak ON revenue.demand_calendar (is_lp_peak) WHERE is_lp_peak = true;

COMMENT ON TABLE revenue.demand_calendar IS 'Per-date demand intelligence. Used by rate-shop agent to select WHICH dates to scrape, not just dumb T+N offsets.';

-- ============================================================
-- FUNCTION: revenue.score_lead_time
-- Returns 0-100 based on days until stay date.
-- T+3 to T+14 = highest (close-in, actionable). T+90+ = lowest.
-- ============================================================
CREATE OR REPLACE FUNCTION revenue.score_lead_time(stay_date DATE)
RETURNS SMALLINT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  days_out INT;
BEGIN
  days_out := stay_date - CURRENT_DATE;
  
  IF days_out < 0 THEN RETURN 0;          -- past date
  ELSIF days_out <= 2 THEN RETURN 60;     -- last-minute (less actionable)
  ELSIF days_out <= 14 THEN RETURN 100;   -- prime window
  ELSIF days_out <= 30 THEN RETURN 80;
  ELSIF days_out <= 60 THEN RETURN 60;
  ELSIF days_out <= 90 THEN RETURN 40;
  ELSIF days_out <= 180 THEN RETURN 25;
  ELSE RETURN 10;                          -- noise
  END IF;
END;
$$;

-- ============================================================
-- FUNCTION: revenue.pick_scrape_dates
-- Returns top N dates for scraping, weighted by all factors.
-- Used by the agent to build its job list.
-- ============================================================
CREATE OR REPLACE FUNCTION revenue.pick_scrape_dates(
  p_max_dates INT DEFAULT 8,
  p_horizon_days INT DEFAULT 120,
  p_min_score SMALLINT DEFAULT 40
)
RETURNS TABLE (
  stay_date DATE,
  total_score SMALLINT,
  dow_score SMALLINT,
  event_score SMALLINT,
  lead_time_score SMALLINT,
  events TEXT[],
  reason TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH scored AS (
    SELECT
      dc.cal_date AS stay_date,
      dc.dow_score,
      dc.event_score,
      revenue.score_lead_time(dc.cal_date) AS lead_time_score,
      dc.events,
      -- Weighted total: 25% DOW + 35% events + 30% lead-time + 10% peak bonus
      LEAST(100,
        (dc.dow_score * 0.25)::INT
        + (dc.event_score * 0.35)::INT
        + (revenue.score_lead_time(dc.cal_date) * 0.30)::INT
        + (CASE WHEN dc.is_lp_peak THEN 10 ELSE 0 END)
      )::SMALLINT AS total
    FROM revenue.demand_calendar dc
    WHERE dc.cal_date BETWEEN CURRENT_DATE + 2 AND CURRENT_DATE + p_horizon_days
  )
  SELECT
    s.stay_date,
    s.total AS total_score,
    s.dow_score,
    s.event_score,
    s.lead_time_score,
    s.events,
    CASE
      WHEN array_length(s.events, 1) > 0 THEN 'event:' || array_to_string(s.events, ',')
      WHEN s.dow_score >= 80 THEN 'weekend'
      WHEN s.lead_time_score >= 80 THEN 'close_in'
      ELSE 'baseline'
    END AS reason
  FROM scored s
  WHERE s.total >= p_min_score
  ORDER BY s.total DESC, s.stay_date ASC
  LIMIT p_max_dates;
END;
$$;

COMMENT ON FUNCTION revenue.pick_scrape_dates IS 'Returns top N dates to scrape, weighted by day-of-week, calendar events, lead time, and peak-season flag. Default 8 dates, 120-day horizon, score floor 40.';
