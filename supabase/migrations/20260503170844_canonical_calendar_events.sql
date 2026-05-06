-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503170844
-- Name:    canonical_calendar_events
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ============================================================
-- Canonical event registry - the ONE place where holidays,
-- festivals, and demand events are recorded. Used by:
-- - Rate-shop agent (which dates to scrape)
-- - Marketing campaigns (when to start promotion)
-- - Content calendar (Grace's video series)
-- - F&B planning (special menus)
-- - Retreat positioning
-- ============================================================

-- Event types lookup with default windows
CREATE TABLE IF NOT EXISTS marketing.calendar_event_types (
  type_code TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('religious','national','seasonal','market','lunar','property')),
  default_demand_score SMALLINT NOT NULL CHECK (default_demand_score BETWEEN 0 AND 100),
  -- Marketing lead times: when to start promo work
  marketing_lead_days_min SMALLINT NOT NULL DEFAULT 30,
  marketing_lead_days_max SMALLINT NOT NULL DEFAULT 90,
  -- Scraping lead times: how far before event we want comp data
  scrape_lead_days_min SMALLINT NOT NULL DEFAULT 14,
  scrape_lead_days_max SMALLINT NOT NULL DEFAULT 120,
  -- Default source markets impacted (comma list of ISO codes)
  default_source_markets TEXT[] DEFAULT ARRAY[]::TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE marketing.calendar_event_types IS 'Catalog of recurring event types. Each event in calendar_events references one of these.';

-- Event instances - one per occurrence of a type
CREATE TABLE IF NOT EXISTS marketing.calendar_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id BIGINT REFERENCES public.hotels(property_id),  -- NULL = applies to all properties
  type_code TEXT NOT NULL REFERENCES marketing.calendar_event_types(type_code),
  
  -- The actual event window
  date_start DATE NOT NULL,
  date_end DATE NOT NULL,
  
  -- Build-up window: when does demand/marketing pressure START before the event itself?
  -- For Christmas: build-up might start Nov 1 even though Christmas is Dec 25.
  buildup_start DATE,  -- nullable; if null, computed from type defaults
  
  -- Display
  display_name TEXT NOT NULL,  -- "Christmas / NYE 2026", "Pi Mai 2027", etc.
  
  -- Override default scoring if this instance is more/less significant
  demand_score_override SMALLINT CHECK (demand_score_override BETWEEN 0 AND 100),
  
  -- Source markets (overrides type defaults)
  source_markets TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Use cases this event matters for
  applies_to_rate_shop BOOLEAN DEFAULT true,
  applies_to_marketing BOOLEAN DEFAULT true,
  applies_to_content BOOLEAN DEFAULT true,
  applies_to_fnb BOOLEAN DEFAULT false,
  applies_to_retreat BOOLEAN DEFAULT false,
  
  -- Marketing campaign hooks
  marketing_brief TEXT,  -- "Christmas teaser series, Grace narration, full moon meditation tie-in"
  hashtags TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  is_confirmed BOOLEAN DEFAULT true,  -- false for tentative future dates
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CHECK (date_end >= date_start)
);

CREATE INDEX idx_calendar_events_dates ON marketing.calendar_events (date_start, date_end);
CREATE INDEX idx_calendar_events_type ON marketing.calendar_events (type_code);
CREATE INDEX idx_calendar_events_buildup ON marketing.calendar_events (buildup_start, date_start);

COMMENT ON TABLE marketing.calendar_events IS 'Canonical date events. Single source of truth for holidays, festivals, marketing windows.';

-- Auto-compute buildup_start from type defaults if not set
CREATE OR REPLACE FUNCTION marketing.fn_set_event_buildup() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.buildup_start IS NULL THEN
    SELECT NEW.date_start - INTERVAL '1 day' * t.marketing_lead_days_min
    INTO NEW.buildup_start
    FROM marketing.calendar_event_types t
    WHERE t.type_code = NEW.type_code;
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calendar_events_buildup ON marketing.calendar_events;
CREATE TRIGGER trg_calendar_events_buildup
BEFORE INSERT OR UPDATE ON marketing.calendar_events
FOR EACH ROW EXECUTE FUNCTION marketing.fn_set_event_buildup();

-- RLS
ALTER TABLE marketing.calendar_event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing.calendar_events ENABLE ROW LEVEL SECURITY;

-- Permissive read; restrict writes to authenticated
CREATE POLICY "calendar_event_types_read" ON marketing.calendar_event_types FOR SELECT USING (true);
CREATE POLICY "calendar_events_read" ON marketing.calendar_events FOR SELECT USING (true);
CREATE POLICY "calendar_events_write" ON marketing.calendar_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fix the demand_calendar RLS bug from earlier
ALTER TABLE revenue.demand_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demand_calendar_read" ON revenue.demand_calendar FOR SELECT USING (true);
