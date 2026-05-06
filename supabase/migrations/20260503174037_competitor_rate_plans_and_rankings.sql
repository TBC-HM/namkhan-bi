-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503174037
-- Name:    competitor_rate_plans_and_rankings
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ============================================================
-- TAXONOMY: canonical rate plan types
-- Maps messy OTA labels to standardized buckets for analysis
-- ============================================================
CREATE TABLE IF NOT EXISTS revenue.rate_plan_taxonomy (
  taxonomy_code TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('flex','non_ref','promo','member','package','corporate')),
  description TEXT,
  display_order SMALLINT DEFAULT 0
);

INSERT INTO revenue.rate_plan_taxonomy (taxonomy_code, display_name, category, description, display_order) VALUES
  ('flex_standard',    'Flexible / Standard',     'flex',      'Standard flexible rate. Free cancellation typically 24-48h before stay.', 10),
  ('flex_pay_later',   'Pay at property',         'flex',      'No prepayment required. Pay on arrival.', 20),
  ('non_ref_basic',    'Non-refundable',          'non_ref',   'Discount in exchange for no cancellation right.', 30),
  ('non_ref_advance',  'Non-refundable + Advance Purchase', 'non_ref', 'Pre-paid, non-refundable, often 7-30 day advance.', 40),
  ('promo_early_bird', 'Early Bird',              'promo',     'Discount for booking 30/60/90+ days ahead.', 50),
  ('promo_last_minute','Last Minute',             'promo',     'Discount within ~7 days of stay.', 60),
  ('promo_los',        'Length of Stay (3+/5+/7+)','promo',    'Discount for staying multiple nights.', 70),
  ('promo_seasonal',   'Seasonal Promotion',      'promo',     'Time-bound promo (Pi Mai, NYE, summer etc).', 80),
  ('promo_flash',      'Flash Sale / Limited',    'promo',     'Short-lived promo, usually <72h.', 90),
  ('member_genius',    'Booking Genius',          'member',    'BDC loyalty program rate.', 100),
  ('member_agoda',     'AgodaCash / Member',      'member',    'Agoda loyalty program rate.', 110),
  ('member_trip',      'Trip Coins / Member',     'member',    'Trip.com loyalty rate.', 120),
  ('member_direct',    'Direct Member',           'member',    'Direct/loyalty club rate (own).', 130),
  ('package_breakfast','Room + Breakfast',        'package',   'Includes breakfast in rate.', 140),
  ('package_half_board','Half Board',             'package',   'Includes breakfast + dinner.', 150),
  ('package_full_board','Full Board',             'package',   'Includes all meals.', 160),
  ('package_spa',      'Room + Spa',              'package',   'Bundled spa credit/treatment.', 170),
  ('package_romance',  'Romance / Honeymoon',     'package',   'Couples / honeymoon package.', 180),
  ('package_other',    'Other Package',           'package',   'Bundled with activities, transfers, etc.', 190),
  ('corporate_neg',    'Corporate Negotiated',    'corporate', 'Corporate contracted rate.', 200),
  ('unknown',          'Unknown / Unmapped',      'flex',      'Raw label could not be parsed. Manual review needed.', 999)
ON CONFLICT (taxonomy_code) DO UPDATE SET 
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description;

ALTER TABLE revenue.rate_plan_taxonomy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rate_taxonomy_read" ON revenue.rate_plan_taxonomy FOR SELECT USING (true);

COMMENT ON TABLE revenue.rate_plan_taxonomy IS 'Canonical rate plan categories. Maps messy OTA labels to standard buckets for like-for-like analysis.';

-- ============================================================
-- Mapping: raw OTA labels → canonical taxonomy
-- Auto-suggested by string match, RM verifies
-- ============================================================
CREATE TABLE IF NOT EXISTS revenue.rate_plan_label_map (
  map_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL CHECK (channel IN ('booking','agoda','expedia','trip','direct','traveloka')),
  raw_label_pattern TEXT NOT NULL,  -- exact match or regex
  is_regex BOOLEAN DEFAULT false,
  taxonomy_code TEXT NOT NULL REFERENCES revenue.rate_plan_taxonomy(taxonomy_code),
  priority SMALLINT DEFAULT 0,  -- higher checked first when multiple match
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (channel, raw_label_pattern)
);

CREATE INDEX idx_label_map_channel ON revenue.rate_plan_label_map(channel, priority DESC);

-- Seed common patterns
INSERT INTO revenue.rate_plan_label_map (channel, raw_label_pattern, is_regex, taxonomy_code, priority, notes) VALUES
  -- Booking.com
  ('booking', 'Genius', true, 'member_genius', 100, 'BDC Genius loyalty'),
  ('booking', 'Non-refundable', false, 'non_ref_basic', 90, 'Standard non-ref'),
  ('booking', 'Standard Rate', false, 'flex_standard', 80, ''),
  ('booking', 'Standard rate', false, 'flex_standard', 80, ''),
  ('booking', 'Flexible', true, 'flex_standard', 75, ''),
  ('booking', 'Pay at the property', true, 'flex_pay_later', 70, ''),
  ('booking', 'Early.{0,3}[Bb]ird', true, 'promo_early_bird', 85, 'Early bird variations'),
  ('booking', 'Bed.and.[Bb]reakfast', true, 'package_breakfast', 60, ''),
  ('booking', 'Half.{0,2}[Bb]oard', true, 'package_half_board', 60, ''),
  ('booking', 'Full.{0,2}[Bb]oard', true, 'package_full_board', 60, ''),
  -- Agoda
  ('agoda', 'AgodaCash', true, 'member_agoda', 100, ''),
  ('agoda', 'Member.{0,5}[Ee]xclusive', true, 'member_agoda', 95, ''),
  ('agoda', 'Non.{0,2}[Rr]efundable', true, 'non_ref_basic', 90, ''),
  ('agoda', 'Stay.\\d.[Pp]ay.\\d', true, 'promo_los', 85, ''),
  ('agoda', '[Ee]arly.{0,3}[Bb]ird', true, 'promo_early_bird', 85, ''),
  ('agoda', 'Free [Cc]ancellation', true, 'flex_standard', 75, ''),
  ('agoda', 'Breakfast.[Ii]ncluded', true, 'package_breakfast', 60, ''),
  -- Trip.com
  ('trip', 'Trip.{0,1}Coins', true, 'member_trip', 100, ''),
  ('trip', 'Member.{0,5}price', true, 'member_trip', 95, ''),
  ('trip', 'Non.{0,2}[Rr]efundable', true, 'non_ref_basic', 90, ''),
  ('trip', '[Ee]arly.{0,3}[Bb]ird', true, 'promo_early_bird', 85, ''),
  ('trip', '[Ll]ast.{0,2}[Mm]inute', true, 'promo_last_minute', 85, ''),
  -- Direct
  ('direct', 'Best.{0,3}[Aa]vailable', true, 'flex_standard', 80, 'BAR'),
  ('direct', 'Member', true, 'member_direct', 100, 'Loyalty/club'),
  ('direct', 'Non.{0,2}[Rr]efundable', true, 'non_ref_basic', 90, ''),
  ('direct', '[Ee]arly.{0,3}[Bb]ird', true, 'promo_early_bird', 85, ''),
  ('direct', '[Ll]ong.{0,3}[Ss]tay', true, 'promo_los', 80, ''),
  ('direct', '[Hh]alf.{0,2}[Bb]oard', true, 'package_half_board', 60, ''),
  ('direct', 'Romance', true, 'package_romance', 70, '')
ON CONFLICT (channel, raw_label_pattern) DO UPDATE SET
  taxonomy_code = EXCLUDED.taxonomy_code,
  priority = EXCLUDED.priority;

ALTER TABLE revenue.rate_plan_label_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "label_map_read" ON revenue.rate_plan_label_map FOR SELECT USING (true);
CREATE POLICY "label_map_write" ON revenue.rate_plan_label_map FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- TABLE: competitor_rate_plans
-- One row per (property × channel × shop_date × stay_date × rate plan)
-- This is what scraping actually populates
-- ============================================================
CREATE TABLE IF NOT EXISTS revenue.competitor_rate_plans (
  plan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id UUID NOT NULL REFERENCES revenue.competitor_property(comp_id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('booking','agoda','expedia','trip','direct','traveloka')),
  shop_date DATE NOT NULL DEFAULT CURRENT_DATE,
  stay_date DATE NOT NULL,
  
  -- Raw from OTA
  raw_label TEXT NOT NULL,             -- "Standard Rate Non-refundable" exactly as scraped
  raw_room_type TEXT,                   -- room name attached to this rate
  rate_usd NUMERIC(10,2),
  rate_native NUMERIC(12,2),
  native_currency TEXT,
  
  -- Canonical mapping
  taxonomy_code TEXT REFERENCES revenue.rate_plan_taxonomy(taxonomy_code),
  taxonomy_confidence TEXT CHECK (taxonomy_confidence IN ('high','medium','low','manual')),
  
  -- Plan attributes
  is_refundable BOOLEAN,
  cancellation_deadline_days INT,       -- how many days before stay can cancel free
  prepayment_required BOOLEAN,
  meal_plan TEXT,                       -- 'none','breakfast','half_board','full_board'
  min_los_required SMALLINT,            -- for LOS promos
  advance_purchase_days INT,            -- for early bird (was X days advance booking required)
  
  -- Promo signals
  has_strikethrough BOOLEAN,            -- shows discount markup vs original
  strikethrough_rate_usd NUMERIC(10,2), -- the "before" price if shown
  discount_pct NUMERIC(5,2),            -- computed: (strike - rate) / strike * 100
  promo_label TEXT,                     -- "20% OFF", "Limited time" etc
  
  is_member_only BOOLEAN,
  
  los_nights SMALLINT DEFAULT 1,
  geo_market TEXT,
  
  -- Lineage
  raw JSONB,
  agent_run_id UUID REFERENCES governance.agent_runs(run_id),
  scrape_status TEXT NOT NULL DEFAULT 'success' CHECK (scrape_status IN ('success','failed','no_availability','partial')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rate_plans_comp_stay ON revenue.competitor_rate_plans(comp_id, channel, stay_date, shop_date DESC);
CREATE INDEX idx_rate_plans_taxonomy ON revenue.competitor_rate_plans(taxonomy_code, shop_date DESC);
CREATE INDEX idx_rate_plans_promo ON revenue.competitor_rate_plans(comp_id, shop_date) WHERE has_strikethrough = true;
CREATE INDEX idx_rate_plans_run ON revenue.competitor_rate_plans(agent_run_id);

ALTER TABLE revenue.competitor_rate_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rate_plans_read" ON revenue.competitor_rate_plans FOR SELECT USING (true);

COMMENT ON TABLE revenue.competitor_rate_plans IS 'Per-rate-plan rows scraped from OTAs. Each search returns multiple plans per room (Flex, Non-Ref, Early Bird etc) — each becomes a row here. Maps to canonical taxonomy via rate_plan_label_map.';

-- ============================================================
-- TABLE: competitor_platform_rankings
-- Position of competitor on OTA search results — context-bound
-- ============================================================
CREATE TABLE IF NOT EXISTS revenue.competitor_platform_rankings (
  ranking_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_id UUID NOT NULL REFERENCES revenue.competitor_property(comp_id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('booking','agoda','expedia','trip','direct','traveloka','google')),
  shop_date DATE NOT NULL DEFAULT CURRENT_DATE,
  stay_date DATE,                       -- nullable: ranking can be queried without specific dates
  
  -- Search context (CRITICAL — ranking is meaningless without this)
  search_destination TEXT NOT NULL,     -- "Luang Prabang, Laos"
  sort_order TEXT NOT NULL,             -- 'recommended','price_asc','price_desc','rating','distance','popularity'
  filters_applied JSONB DEFAULT '{}'::jsonb,  -- {"stars":[4,5],"price_max":300} etc
  
  -- Position
  position INT NOT NULL,                -- 1-based rank
  total_results INT,                    -- total in result set
  page_number SMALLINT,                 -- which page it appeared on (10-25 results/page typically)
  
  -- Visibility metrics
  is_above_fold BOOLEAN,                -- top 5-10 results
  is_first_page BOOLEAN,
  has_sponsored_badge BOOLEAN,
  has_genius_badge BOOLEAN,
  has_preferred_badge BOOLEAN,
  
  -- Snapshot of competitive context
  position_review_score NUMERIC(3,1),
  position_lowest_rate_usd NUMERIC(10,2),
  
  geo_market TEXT,
  raw JSONB,
  agent_run_id UUID REFERENCES governance.agent_runs(run_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rankings_comp_channel_date ON revenue.competitor_platform_rankings(comp_id, channel, shop_date DESC);
CREATE INDEX idx_rankings_search_context ON revenue.competitor_platform_rankings(channel, search_destination, sort_order, shop_date DESC);
CREATE INDEX idx_rankings_run ON revenue.competitor_platform_rankings(agent_run_id);

ALTER TABLE revenue.competitor_platform_rankings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rankings_read" ON revenue.competitor_platform_rankings FOR SELECT USING (true);

COMMENT ON TABLE revenue.competitor_platform_rankings IS 'Position of property on OTA search results. ALWAYS context-bound (search query + sort + filters). Comparisons valid only across same context.';
