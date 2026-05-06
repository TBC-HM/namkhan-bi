-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503174939
-- Name:    final_room_mapping_and_adhoc_tables
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


CREATE TABLE IF NOT EXISTS revenue.competitor_room_mapping (
  mapping_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id UUID NOT NULL REFERENCES revenue.competitor_property(comp_id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('booking','agoda','expedia','trip','direct')),
  competitor_room_name TEXT NOT NULL,
  competitor_room_size_sqm NUMERIC(5,1),
  competitor_max_occupancy SMALLINT,
  competitor_bed_config TEXT,
  our_room_tier TEXT NOT NULL CHECK (our_room_tier IN ('entry','standard','premium','suite','villa')),
  our_room_type_id UUID,
  is_target_room BOOLEAN DEFAULT false,
  notes TEXT,
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (comp_id, channel, competitor_room_name)
);
CREATE INDEX IF NOT EXISTS idx_room_mapping_comp ON revenue.competitor_room_mapping(comp_id, is_target_room);
ALTER TABLE revenue.competitor_room_mapping ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "room_mapping_read" ON revenue.competitor_room_mapping;
DROP POLICY IF EXISTS "room_mapping_write" ON revenue.competitor_room_mapping;
CREATE POLICY "room_mapping_read" ON revenue.competitor_room_mapping FOR SELECT USING (true);
CREATE POLICY "room_mapping_write" ON revenue.competitor_room_mapping FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS revenue.ad_hoc_scrape_requests (
  request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by UUID,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  custom_dates DATE[] NOT NULL,
  comp_set_id UUID REFERENCES revenue.competitor_set(set_id),
  channels TEXT[] DEFAULT ARRAY['booking','agoda','direct']::TEXT[],
  geo_markets TEXT[] DEFAULT ARRAY['US']::TEXT[],
  los_nights SMALLINT DEFAULT 1,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed','cancelled')),
  agent_run_id UUID REFERENCES governance.agent_runs(run_id),
  estimated_cost_usd NUMERIC(8,2),
  actual_cost_usd NUMERIC(8,2),
  completed_at TIMESTAMPTZ,
  error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_adhoc_status ON revenue.ad_hoc_scrape_requests(status, requested_at DESC);
ALTER TABLE revenue.ad_hoc_scrape_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "adhoc_read" ON revenue.ad_hoc_scrape_requests;
DROP POLICY IF EXISTS "adhoc_write" ON revenue.ad_hoc_scrape_requests;
CREATE POLICY "adhoc_read" ON revenue.ad_hoc_scrape_requests FOR SELECT USING (true);
CREATE POLICY "adhoc_write" ON revenue.ad_hoc_scrape_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
