-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503173533
-- Name:    scoring_config_versioned
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ============================================================
-- TABLE: revenue.scoring_config
-- Versioned scoring weights for the date picker
-- Only one row has is_active=true at a time
-- ============================================================
CREATE TABLE IF NOT EXISTS revenue.scoring_config (
  config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  
  -- Top-level factor weights (must sum to 1.00)
  weight_dow NUMERIC(3,2) NOT NULL DEFAULT 0.25 CHECK (weight_dow >= 0 AND weight_dow <= 1),
  weight_event NUMERIC(3,2) NOT NULL DEFAULT 0.35 CHECK (weight_event >= 0 AND weight_event <= 1),
  weight_lead_time NUMERIC(3,2) NOT NULL DEFAULT 0.30 CHECK (weight_lead_time >= 0 AND weight_lead_time <= 1),
  weight_peak_bonus NUMERIC(3,2) NOT NULL DEFAULT 0.10 CHECK (weight_peak_bonus >= 0 AND weight_peak_bonus <= 1),
  
  -- DOW score table
  dow_scores JSONB NOT NULL DEFAULT jsonb_build_object(
    '0', 60, '1', 30, '2', 35, '3', 45, '4', 70, '5', 90, '6', 95
  ),
  
  -- Lead-time score bands (array of {max_days, score})
  lead_time_bands JSONB NOT NULL DEFAULT jsonb_build_array(
    jsonb_build_object('max_days', 2, 'score', 60, 'label', 'last-minute'),
    jsonb_build_object('max_days', 14, 'score', 100, 'label', 'prime'),
    jsonb_build_object('max_days', 30, 'score', 80, 'label', 'strong'),
    jsonb_build_object('max_days', 60, 'score', 60, 'label', 'medium'),
    jsonb_build_object('max_days', 90, 'score', 40, 'label', 'trend-only'),
    jsonb_build_object('max_days', 180, 'score', 25, 'label', 'long-tail'),
    jsonb_build_object('max_days', 9999, 'score', 10, 'label', 'noise')
  ),
  
  -- Audit
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  
  CHECK (
    (weight_dow + weight_event + weight_lead_time + weight_peak_bonus) BETWEEN 0.99 AND 1.01
  ),
  UNIQUE (version)
);

CREATE UNIQUE INDEX uniq_scoring_config_active 
  ON revenue.scoring_config(is_active) WHERE is_active = true;

ALTER TABLE revenue.scoring_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scoring_config_read" ON revenue.scoring_config FOR SELECT USING (true);
CREATE POLICY "scoring_config_write" ON revenue.scoring_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE revenue.scoring_config IS 'Versioned scoring weights for date picker. Only one is_active=true at a time. RM edits create new version, old retired.';

-- ============================================================
-- AUDIT TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS revenue.scoring_config_audit (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES revenue.scoring_config(config_id),
  version INT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created','activated','edited','retired')),
  changed_by UUID,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  diff JSONB,  -- {"weight_dow": {"old": 0.25, "new": 0.30}}
  reason TEXT
);
CREATE INDEX idx_scoring_audit_config ON revenue.scoring_config_audit(config_id, changed_at DESC);

-- ============================================================
-- Insert v1 default config and activate it
-- ============================================================
INSERT INTO revenue.scoring_config (
  version, is_active, notes, activated_at
) VALUES (
  1, true, 'Initial v1 config — defaults from rate-shop design doc.', NOW()
);

-- Audit row for v1 creation
INSERT INTO revenue.scoring_config_audit (config_id, version, action, reason)
SELECT config_id, 1, 'created', 'Seeded with default weights at system bootstrap.'
FROM revenue.scoring_config WHERE version = 1;

-- ============================================================
-- Refactor pick_scrape_dates to read from active config
-- ============================================================
CREATE OR REPLACE FUNCTION revenue.score_lead_time(stay_date DATE)
RETURNS SMALLINT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  days_out INT;
  band JSONB;
  active_bands JSONB;
BEGIN
  days_out := stay_date - CURRENT_DATE;
  IF days_out < 0 THEN RETURN 0; END IF;
  
  SELECT lead_time_bands INTO active_bands 
  FROM revenue.scoring_config WHERE is_active = true LIMIT 1;
  
  IF active_bands IS NULL THEN
    -- Fallback to hardcoded if no active config
    IF days_out <= 2 THEN RETURN 60;
    ELSIF days_out <= 14 THEN RETURN 100;
    ELSIF days_out <= 30 THEN RETURN 80;
    ELSIF days_out <= 60 THEN RETURN 60;
    ELSIF days_out <= 90 THEN RETURN 40;
    ELSIF days_out <= 180 THEN RETURN 25;
    ELSE RETURN 10;
    END IF;
  END IF;
  
  -- Walk bands ordered, return first matching score
  FOR band IN SELECT * FROM jsonb_array_elements(active_bands) LOOP
    IF days_out <= (band->>'max_days')::int THEN
      RETURN (band->>'score')::smallint;
    END IF;
  END LOOP;
  
  RETURN 10;
END;
$$;

CREATE OR REPLACE FUNCTION revenue.pick_scrape_dates(
  p_max_dates INT DEFAULT 8,
  p_horizon_days INT DEFAULT 120,
  p_min_score SMALLINT DEFAULT 40
)
RETURNS TABLE (
  stay_date DATE, total_score SMALLINT, dow_score SMALLINT, event_score SMALLINT,
  lead_time_score SMALLINT, events TEXT[], reason TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  cfg RECORD;
BEGIN
  SELECT weight_dow, weight_event, weight_lead_time, weight_peak_bonus, dow_scores
  INTO cfg
  FROM revenue.scoring_config WHERE is_active = true LIMIT 1;
  
  IF cfg IS NULL THEN
    -- Fallback to v1 defaults
    cfg.weight_dow := 0.25; cfg.weight_event := 0.35;
    cfg.weight_lead_time := 0.30; cfg.weight_peak_bonus := 0.10;
  END IF;
  
  RETURN QUERY
  WITH scored AS (
    SELECT
      dc.cal_date AS stay_date,
      -- Pull DOW score from active config
      COALESCE(
        (cfg.dow_scores ->> dc.day_of_week::text)::smallint,
        dc.dow_score
      ) AS dow_score,
      dc.event_score,
      revenue.score_lead_time(dc.cal_date) AS lead_time_score,
      dc.events,
      LEAST(100,
        ((COALESCE((cfg.dow_scores ->> dc.day_of_week::text)::int, dc.dow_score)) * cfg.weight_dow)::int
        + (dc.event_score * cfg.weight_event)::int
        + (revenue.score_lead_time(dc.cal_date) * cfg.weight_lead_time)::int
        + (CASE WHEN dc.is_lp_peak THEN (100 * cfg.weight_peak_bonus)::int ELSE 0 END)
      )::smallint AS total
    FROM revenue.demand_calendar dc
    WHERE dc.cal_date BETWEEN CURRENT_DATE + 2 AND CURRENT_DATE + p_horizon_days
  )
  SELECT
    s.stay_date, s.total AS total_score, s.dow_score, s.event_score, s.lead_time_score,
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

COMMENT ON FUNCTION revenue.pick_scrape_dates IS 'Reads weights from active revenue.scoring_config row. Falls back to hardcoded v1 defaults if no active config.';
