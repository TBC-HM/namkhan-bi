-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505155419
-- Name:    multitenant_phase_2_3_flagged_rls_part1
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- =====================================================================
-- PHASE 2.3a — Add property_id to flagged tables that need it directly
-- and replace USING(true) RLS with tenant-scoped policies.
-- This batch: marketing + revenue.
-- =====================================================================

-- ---------------------------------------------------------------------
-- governance.dmc_reservation_mapping  (was USING(true) for ALL roles)
-- ---------------------------------------------------------------------
ALTER TABLE governance.dmc_reservation_mapping ADD COLUMN IF NOT EXISTS property_id BIGINT;
UPDATE governance.dmc_reservation_mapping SET property_id = 260955 WHERE property_id IS NULL;
ALTER TABLE governance.dmc_reservation_mapping ALTER COLUMN property_id SET NOT NULL;
ALTER TABLE governance.dmc_reservation_mapping
  ADD CONSTRAINT dmc_reservation_mapping_property_id_fk
  FOREIGN KEY (property_id) REFERENCES core.properties(property_id);
CREATE INDEX IF NOT EXISTS dmc_reservation_mapping_property_id_idx
  ON governance.dmc_reservation_mapping(property_id);

DROP POLICY IF EXISTS dmc_mapping_write ON governance.dmc_reservation_mapping;
CREATE POLICY dmc_reservation_mapping_tenant ON governance.dmc_reservation_mapping
  FOR ALL TO authenticated
  USING (core.has_property_access(property_id))
  WITH CHECK (core.has_property_access(property_id));

-- ---------------------------------------------------------------------
-- marketing.calendar_events  (already has property_id BIGINT)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS calendar_events_write ON marketing.calendar_events;
CREATE POLICY calendar_events_tenant ON marketing.calendar_events
  FOR ALL TO authenticated
  USING (core.has_property_access(property_id))
  WITH CHECK (core.has_property_access(property_id));

CREATE INDEX IF NOT EXISTS calendar_events_property_id_idx
  ON marketing.calendar_events(property_id);

-- ---------------------------------------------------------------------
-- marketing.campaigns
-- ---------------------------------------------------------------------
ALTER TABLE marketing.campaigns ADD COLUMN IF NOT EXISTS property_id BIGINT;
UPDATE marketing.campaigns SET property_id = 260955 WHERE property_id IS NULL;
ALTER TABLE marketing.campaigns ALTER COLUMN property_id SET NOT NULL;
ALTER TABLE marketing.campaigns
  ADD CONSTRAINT campaigns_property_id_fk
  FOREIGN KEY (property_id) REFERENCES core.properties(property_id);
CREATE INDEX IF NOT EXISTS campaigns_property_id_idx ON marketing.campaigns(property_id);

DROP POLICY IF EXISTS "auth write campaigns" ON marketing.campaigns;
CREATE POLICY campaigns_tenant ON marketing.campaigns
  FOR ALL TO authenticated
  USING (core.has_property_access(property_id))
  WITH CHECK (core.has_property_access(property_id));

-- ---------------------------------------------------------------------
-- marketing.campaign_assets
-- ---------------------------------------------------------------------
ALTER TABLE marketing.campaign_assets ADD COLUMN IF NOT EXISTS property_id BIGINT;
UPDATE marketing.campaign_assets SET property_id = 260955 WHERE property_id IS NULL;
ALTER TABLE marketing.campaign_assets ALTER COLUMN property_id SET NOT NULL;
ALTER TABLE marketing.campaign_assets
  ADD CONSTRAINT campaign_assets_property_id_fk
  FOREIGN KEY (property_id) REFERENCES core.properties(property_id);
CREATE INDEX IF NOT EXISTS campaign_assets_property_id_idx ON marketing.campaign_assets(property_id);

DROP POLICY IF EXISTS "auth write campaign_assets" ON marketing.campaign_assets;
CREATE POLICY campaign_assets_tenant ON marketing.campaign_assets
  FOR ALL TO authenticated
  USING (core.has_property_access(property_id))
  WITH CHECK (core.has_property_access(property_id));

-- ---------------------------------------------------------------------
-- revenue.ad_hoc_scrape_requests
-- ---------------------------------------------------------------------
ALTER TABLE revenue.ad_hoc_scrape_requests ADD COLUMN IF NOT EXISTS property_id BIGINT;
UPDATE revenue.ad_hoc_scrape_requests SET property_id = 260955 WHERE property_id IS NULL;
ALTER TABLE revenue.ad_hoc_scrape_requests ALTER COLUMN property_id SET NOT NULL;
ALTER TABLE revenue.ad_hoc_scrape_requests
  ADD CONSTRAINT ad_hoc_scrape_requests_property_id_fk
  FOREIGN KEY (property_id) REFERENCES core.properties(property_id);
CREATE INDEX IF NOT EXISTS ad_hoc_scrape_requests_property_id_idx ON revenue.ad_hoc_scrape_requests(property_id);

DROP POLICY IF EXISTS adhoc_write ON revenue.ad_hoc_scrape_requests;
CREATE POLICY ad_hoc_scrape_requests_tenant ON revenue.ad_hoc_scrape_requests
  FOR ALL TO authenticated
  USING (core.has_property_access(property_id))
  WITH CHECK (core.has_property_access(property_id));

-- ---------------------------------------------------------------------
-- revenue.competitor_property
-- (already has property_name TEXT, also bdc_property_id etc. — those are
-- competitor identifiers, not OUR property. Add a separate property_id
-- meaning "which of our hotels does this competitor watch belong to".)
-- ---------------------------------------------------------------------
ALTER TABLE revenue.competitor_property ADD COLUMN IF NOT EXISTS property_id BIGINT;
UPDATE revenue.competitor_property SET property_id = 260955 WHERE property_id IS NULL;
ALTER TABLE revenue.competitor_property ALTER COLUMN property_id SET NOT NULL;
ALTER TABLE revenue.competitor_property
  ADD CONSTRAINT competitor_property_property_id_fk
  FOREIGN KEY (property_id) REFERENCES core.properties(property_id);
CREATE INDEX IF NOT EXISTS competitor_property_property_id_idx ON revenue.competitor_property(property_id);

DROP POLICY IF EXISTS compset_property_write ON revenue.competitor_property;
CREATE POLICY competitor_property_tenant ON revenue.competitor_property
  FOR ALL TO authenticated
  USING (core.has_property_access(property_id))
  WITH CHECK (core.has_property_access(property_id));

-- ---------------------------------------------------------------------
-- revenue.competitor_rates
-- ---------------------------------------------------------------------
ALTER TABLE revenue.competitor_rates ADD COLUMN IF NOT EXISTS property_id BIGINT;
UPDATE revenue.competitor_rates SET property_id = 260955 WHERE property_id IS NULL;
ALTER TABLE revenue.competitor_rates ALTER COLUMN property_id SET NOT NULL;
ALTER TABLE revenue.competitor_rates
  ADD CONSTRAINT competitor_rates_property_id_fk
  FOREIGN KEY (property_id) REFERENCES core.properties(property_id);
CREATE INDEX IF NOT EXISTS competitor_rates_property_id_idx ON revenue.competitor_rates(property_id);

DROP POLICY IF EXISTS compset_rates_write ON revenue.competitor_rates;
CREATE POLICY competitor_rates_tenant ON revenue.competitor_rates
  FOR ALL TO authenticated
  USING (core.has_property_access(property_id))
  WITH CHECK (core.has_property_access(property_id));

-- ---------------------------------------------------------------------
-- revenue.competitor_room_mapping
-- ---------------------------------------------------------------------
ALTER TABLE revenue.competitor_room_mapping ADD COLUMN IF NOT EXISTS property_id BIGINT;
UPDATE revenue.competitor_room_mapping SET property_id = 260955 WHERE property_id IS NULL;
ALTER TABLE revenue.competitor_room_mapping ALTER COLUMN property_id SET NOT NULL;
ALTER TABLE revenue.competitor_room_mapping
  ADD CONSTRAINT competitor_room_mapping_property_id_fk
  FOREIGN KEY (property_id) REFERENCES core.properties(property_id);
CREATE INDEX IF NOT EXISTS competitor_room_mapping_property_id_idx ON revenue.competitor_room_mapping(property_id);

DROP POLICY IF EXISTS room_mapping_write ON revenue.competitor_room_mapping;
CREATE POLICY competitor_room_mapping_tenant ON revenue.competitor_room_mapping
  FOR ALL TO authenticated
  USING (core.has_property_access(property_id))
  WITH CHECK (core.has_property_access(property_id));

-- ---------------------------------------------------------------------
-- revenue.competitor_set  (already has property_id BIGINT)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS compset_set_write ON revenue.competitor_set;
CREATE POLICY competitor_set_tenant ON revenue.competitor_set
  FOR ALL TO authenticated
  USING (core.has_property_access(property_id))
  WITH CHECK (core.has_property_access(property_id));

CREATE INDEX IF NOT EXISTS competitor_set_property_id_idx ON revenue.competitor_set(property_id);

-- ---------------------------------------------------------------------
-- revenue.flag_rules
-- ---------------------------------------------------------------------
ALTER TABLE revenue.flag_rules ADD COLUMN IF NOT EXISTS property_id BIGINT;
UPDATE revenue.flag_rules SET property_id = 260955 WHERE property_id IS NULL;
ALTER TABLE revenue.flag_rules ALTER COLUMN property_id SET NOT NULL;
ALTER TABLE revenue.flag_rules
  ADD CONSTRAINT flag_rules_property_id_fk
  FOREIGN KEY (property_id) REFERENCES core.properties(property_id);
CREATE INDEX IF NOT EXISTS flag_rules_property_id_idx ON revenue.flag_rules(property_id);

DROP POLICY IF EXISTS flag_rules_write ON revenue.flag_rules;
CREATE POLICY flag_rules_tenant ON revenue.flag_rules
  FOR ALL TO authenticated
  USING (core.has_property_access(property_id))
  WITH CHECK (core.has_property_access(property_id));

-- ---------------------------------------------------------------------
-- revenue.flags
-- ---------------------------------------------------------------------
ALTER TABLE revenue.flags ADD COLUMN IF NOT EXISTS property_id BIGINT;
UPDATE revenue.flags SET property_id = 260955 WHERE property_id IS NULL;
ALTER TABLE revenue.flags ALTER COLUMN property_id SET NOT NULL;
ALTER TABLE revenue.flags
  ADD CONSTRAINT flags_property_id_fk
  FOREIGN KEY (property_id) REFERENCES core.properties(property_id);
CREATE INDEX IF NOT EXISTS flags_property_id_idx ON revenue.flags(property_id);

DROP POLICY IF EXISTS flags_write ON revenue.flags;
CREATE POLICY flags_tenant ON revenue.flags
  FOR ALL TO authenticated
  USING (core.has_property_access(property_id))
  WITH CHECK (core.has_property_access(property_id));

-- ---------------------------------------------------------------------
-- revenue.rate_plan_label_map
-- ---------------------------------------------------------------------
ALTER TABLE revenue.rate_plan_label_map ADD COLUMN IF NOT EXISTS property_id BIGINT;
UPDATE revenue.rate_plan_label_map SET property_id = 260955 WHERE property_id IS NULL;
ALTER TABLE revenue.rate_plan_label_map ALTER COLUMN property_id SET NOT NULL;
ALTER TABLE revenue.rate_plan_label_map
  ADD CONSTRAINT rate_plan_label_map_property_id_fk
  FOREIGN KEY (property_id) REFERENCES core.properties(property_id);
CREATE INDEX IF NOT EXISTS rate_plan_label_map_property_id_idx ON revenue.rate_plan_label_map(property_id);

DROP POLICY IF EXISTS label_map_write ON revenue.rate_plan_label_map;
CREATE POLICY rate_plan_label_map_tenant ON revenue.rate_plan_label_map
  FOR ALL TO authenticated
  USING (core.has_property_access(property_id))
  WITH CHECK (core.has_property_access(property_id));

-- ---------------------------------------------------------------------
-- revenue.scoring_config
-- ---------------------------------------------------------------------
ALTER TABLE revenue.scoring_config ADD COLUMN IF NOT EXISTS property_id BIGINT;
UPDATE revenue.scoring_config SET property_id = 260955 WHERE property_id IS NULL;
ALTER TABLE revenue.scoring_config ALTER COLUMN property_id SET NOT NULL;
ALTER TABLE revenue.scoring_config
  ADD CONSTRAINT scoring_config_property_id_fk
  FOREIGN KEY (property_id) REFERENCES core.properties(property_id);
CREATE INDEX IF NOT EXISTS scoring_config_property_id_idx ON revenue.scoring_config(property_id);

DROP POLICY IF EXISTS scoring_config_write ON revenue.scoring_config;
CREATE POLICY scoring_config_tenant ON revenue.scoring_config
  FOR ALL TO authenticated
  USING (core.has_property_access(property_id))
  WITH CHECK (core.has_property_access(property_id));
