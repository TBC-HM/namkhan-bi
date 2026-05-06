-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505171925
-- Name:    phase_3_7_marketing_inv_units_lockdown
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- =================================================================
-- Marketing schema: drop anon access; consolidate
-- =================================================================
DROP POLICY IF EXISTS anon_read_compset ON marketing.calendar_event_types;
DROP POLICY IF EXISTS calendar_event_types_read ON marketing.calendar_event_types;
DROP POLICY IF EXISTS "anon read templates" ON marketing.campaign_templates;
DROP POLICY IF EXISTS gbp_snap_read ON marketing.gbp_snapshots;
DROP POLICY IF EXISTS anon_read ON marketing.influencers;
DROP POLICY IF EXISTS anon_read ON marketing.media_assets;
DROP POLICY IF EXISTS owner_write ON marketing.media_assets;
DROP POLICY IF EXISTS anon_read ON marketing.media_collection_items;
DROP POLICY IF EXISTS owner_write ON marketing.media_collection_items;
DROP POLICY IF EXISTS anon_read ON marketing.media_collections;
DROP POLICY IF EXISTS owner_write ON marketing.media_collections;
DROP POLICY IF EXISTS anon_read ON marketing.media_keywords_free;
DROP POLICY IF EXISTS owner_write ON marketing.media_keywords_free;
DROP POLICY IF EXISTS anon_read ON marketing.media_links;
DROP POLICY IF EXISTS anon_read ON marketing.media_renders;
DROP POLICY IF EXISTS owner_write ON marketing.media_renders;
DROP POLICY IF EXISTS anon_read ON marketing.media_tags;
DROP POLICY IF EXISTS owner_write ON marketing.media_tags;
DROP POLICY IF EXISTS anon_read ON marketing.media_taxonomy;
DROP POLICY IF EXISTS owner_write ON marketing.media_taxonomy;
DROP POLICY IF EXISTS anon_read ON marketing.media_usage_log;
DROP POLICY IF EXISTS owner_write ON marketing.media_usage_log;
DROP POLICY IF EXISTS anon_read ON marketing.reviews;
DROP POLICY IF EXISTS anon_read ON marketing.social_accounts;

-- Replace with proper authenticated/service policies (single-property today)
-- calendar_event_types: global lookup
CREATE POLICY cet_authenticated_read ON marketing.calendar_event_types
  FOR SELECT TO authenticated USING (true);
CREATE POLICY cet_service ON marketing.calendar_event_types
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- campaign_templates: global library
CREATE POLICY ct_service ON marketing.campaign_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- gbp_snapshots (has property_id)
CREATE POLICY gbp_snapshots_tenant ON marketing.gbp_snapshots
  FOR ALL TO authenticated
  USING (core.has_property_access(property_id))
  WITH CHECK (core.has_property_access(property_id));
CREATE POLICY gbp_snapshots_service ON marketing.gbp_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- influencers (no pid, treat as global lookup for now)
CREATE POLICY influencers_authenticated ON marketing.influencers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY influencers_service ON marketing.influencers
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- media_assets has property_id
CREATE POLICY media_assets_tenant ON marketing.media_assets
  FOR ALL TO authenticated
  USING (core.has_property_access(property_id))
  WITH CHECK (core.has_property_access(property_id));
CREATE POLICY media_assets_service ON marketing.media_assets
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- media_collections, collection_items, keywords, links, renders, tags, taxonomy, usage_log (no pid)
-- Lock to authenticated (single-property today; revisit at Donna)
CREATE POLICY media_collections_authenticated ON marketing.media_collections
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY media_collections_service ON marketing.media_collections
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY media_collection_items_authenticated ON marketing.media_collection_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY media_collection_items_service ON marketing.media_collection_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY media_keywords_free_authenticated ON marketing.media_keywords_free
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY media_keywords_free_service ON marketing.media_keywords_free
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY media_links_authenticated ON marketing.media_links
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY media_links_service ON marketing.media_links
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY media_renders_authenticated ON marketing.media_renders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY media_renders_service ON marketing.media_renders
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY media_tags_authenticated ON marketing.media_tags
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY media_tags_service ON marketing.media_tags
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY media_taxonomy_authenticated ON marketing.media_taxonomy
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY media_taxonomy_service ON marketing.media_taxonomy
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY media_usage_log_authenticated ON marketing.media_usage_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY media_usage_log_service ON marketing.media_usage_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- reviews (has property_id)
CREATE POLICY reviews_tenant ON marketing.reviews
  FOR ALL TO authenticated
  USING (core.has_property_access(property_id))
  WITH CHECK (core.has_property_access(property_id));
CREATE POLICY reviews_service ON marketing.reviews
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- social_accounts (no pid; brand assets, single-property today)
CREATE POLICY social_accounts_authenticated ON marketing.social_accounts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY social_accounts_service ON marketing.social_accounts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =================================================================
-- inv.units: drop legacy duplicate policies
-- =================================================================
DROP POLICY IF EXISTS inv_unit_read ON inv.units;
DROP POLICY IF EXISTS inv_unit_write ON inv.units;
-- Keep units_global_read (authenticated SELECT) and units_service

-- =================================================================
-- Fix unindexed FK on sales.email_category_rules
-- =================================================================
CREATE INDEX IF NOT EXISTS email_category_rules_category_key_idx
  ON sales.email_category_rules (category_key);
