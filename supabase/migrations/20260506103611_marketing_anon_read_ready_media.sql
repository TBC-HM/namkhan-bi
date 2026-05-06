-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260506103611
-- Name:    marketing_anon_read_ready_media
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Restore public read on /marketing/library via anon, scoped to status='ready' only.
-- Also expose anon read to media_renders / media_tags / media_taxonomy so the
-- v_media_ready view's left-joins resolve to real rows for anon.

-- media_assets — only ready rows visible to anon
DROP POLICY IF EXISTS media_assets_anon_read_ready ON marketing.media_assets;
CREATE POLICY media_assets_anon_read_ready
  ON marketing.media_assets
  FOR SELECT
  TO anon
  USING (status = 'ready'::marketing.asset_status);

-- media_renders — derivative renders of ready assets
DROP POLICY IF EXISTS media_renders_anon_read ON marketing.media_renders;
CREATE POLICY media_renders_anon_read
  ON marketing.media_renders
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM marketing.media_assets a
      WHERE a.asset_id = media_renders.asset_id AND a.status = 'ready'::marketing.asset_status
    )
  );

-- media_tags — tags of ready assets (used by v_media_ready left join)
DROP POLICY IF EXISTS media_tags_anon_read ON marketing.media_tags;
CREATE POLICY media_tags_anon_read
  ON marketing.media_tags
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM marketing.media_assets a
      WHERE a.asset_id = media_tags.asset_id AND a.status = 'ready'::marketing.asset_status
    )
  );

-- media_taxonomy — controlled vocabulary, safe to expose
DROP POLICY IF EXISTS media_taxonomy_anon_read ON marketing.media_taxonomy;
CREATE POLICY media_taxonomy_anon_read
  ON marketing.media_taxonomy
  FOR SELECT
  TO anon
  USING (is_active);
