-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260501163715
-- Name:    phase2_02_marketing_media_views_and_rls
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- View: assets ready for use, license-aware (drops expired licenses)
CREATE OR REPLACE VIEW marketing.v_media_ready AS
SELECT
  a.asset_id, a.asset_type, a.original_filename, a.caption, a.alt_text,
  a.primary_tier, a.secondary_tiers,
  a.property_area, a.room_type_id,
  a.captured_at, a.license_type, a.usage_rights, a.do_not_modify,
  a.has_identifiable_people,
  a.raw_path, a.master_path,
  a.width_px, a.height_px, a.qc_score, a.ai_confidence,
  array_agg(DISTINCT t.tag_slug) FILTER (WHERE t.tag_slug IS NOT NULL) AS tags,
  jsonb_object_agg(r.render_purpose, r.file_path)
    FILTER (WHERE r.render_purpose IS NOT NULL) AS renders
FROM marketing.media_assets a
LEFT JOIN marketing.media_tags mt ON mt.asset_id = a.asset_id
LEFT JOIN marketing.media_taxonomy t ON t.tag_id = mt.tag_id AND t.is_active
LEFT JOIN marketing.media_renders r ON r.asset_id = a.asset_id
WHERE a.status = 'ready'
  AND (a.license_expiry IS NULL OR a.license_expiry > now())
GROUP BY a.asset_id;

-- Counts per tier (dashboard health card)
CREATE OR REPLACE VIEW marketing.v_media_by_tier AS
SELECT primary_tier,
       count(*) AS total,
       count(*) FILTER (WHERE asset_type = 'photo') AS photos,
       count(*) FILTER (WHERE asset_type IN ('video','reel')) AS videos
FROM marketing.media_assets
WHERE status = 'ready'
GROUP BY primary_tier;

-- Freshness: how many days since last published use
CREATE OR REPLACE VIEW marketing.v_media_unused_freshness AS
SELECT a.asset_id, a.original_filename, a.primary_tier,
       a.captured_at,
       max(u.used_at) AS last_used_at,
       extract(day FROM (now() - max(u.used_at)))::int AS days_since_last_use
FROM marketing.media_assets a
LEFT JOIN marketing.media_usage_log u ON u.asset_id = a.asset_id
WHERE a.status = 'ready'
GROUP BY a.asset_id;

-- ============================================================
-- RLS — match existing marketing.* anon_read pattern, add owner/gm writes
-- ============================================================
ALTER TABLE marketing.media_assets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing.media_renders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing.media_taxonomy          ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing.media_tags              ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing.media_keywords_free     ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing.media_usage_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing.media_collections       ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing.media_collection_items  ENABLE ROW LEVEL SECURITY;

-- READ: open to authenticated + anon (consistent with other marketing.* tables)
CREATE POLICY anon_read ON marketing.media_assets           FOR SELECT USING (true);
CREATE POLICY anon_read ON marketing.media_renders          FOR SELECT USING (true);
CREATE POLICY anon_read ON marketing.media_taxonomy         FOR SELECT USING (is_active = true);
CREATE POLICY anon_read ON marketing.media_tags             FOR SELECT USING (true);
CREATE POLICY anon_read ON marketing.media_keywords_free    FOR SELECT USING (true);
CREATE POLICY anon_read ON marketing.media_usage_log        FOR SELECT USING (true);
CREATE POLICY anon_read ON marketing.media_collections      FOR SELECT USING (true);
CREATE POLICY anon_read ON marketing.media_collection_items FOR SELECT USING (true);

-- WRITE: owner + gm (top-level) only — service_role bypasses RLS automatically
CREATE POLICY owner_write ON marketing.media_assets           FOR ALL USING (app.is_top_level()) WITH CHECK (app.is_top_level());
CREATE POLICY owner_write ON marketing.media_renders          FOR ALL USING (app.is_top_level()) WITH CHECK (app.is_top_level());
CREATE POLICY owner_write ON marketing.media_taxonomy         FOR ALL USING (app.is_top_level()) WITH CHECK (app.is_top_level());
CREATE POLICY owner_write ON marketing.media_tags             FOR ALL USING (app.is_top_level()) WITH CHECK (app.is_top_level());
CREATE POLICY owner_write ON marketing.media_keywords_free    FOR ALL USING (app.is_top_level()) WITH CHECK (app.is_top_level());
CREATE POLICY owner_write ON marketing.media_usage_log        FOR ALL USING (app.is_top_level()) WITH CHECK (app.is_top_level());
CREATE POLICY owner_write ON marketing.media_collections      FOR ALL USING (app.is_top_level()) WITH CHECK (app.is_top_level());
CREATE POLICY owner_write ON marketing.media_collection_items FOR ALL USING (app.is_top_level()) WITH CHECK (app.is_top_level());
