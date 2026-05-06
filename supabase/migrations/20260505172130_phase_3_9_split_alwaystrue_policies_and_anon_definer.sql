-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505172130
-- Name:    phase_3_9_split_alwaystrue_policies_and_anon_definer
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ===========================================================
-- Replace FOR ALL USING(true) WITH CHECK(true) policies with
-- read-only authenticated + service-role writes
-- ===========================================================
-- marketing.influencers
DROP POLICY IF EXISTS influencers_authenticated ON marketing.influencers;
CREATE POLICY influencers_authenticated_read ON marketing.influencers
  FOR SELECT TO authenticated USING (true);

-- marketing.media_collection_items
DROP POLICY IF EXISTS media_collection_items_authenticated ON marketing.media_collection_items;
CREATE POLICY media_collection_items_authenticated_read ON marketing.media_collection_items
  FOR SELECT TO authenticated USING (true);

-- marketing.media_collections
DROP POLICY IF EXISTS media_collections_authenticated ON marketing.media_collections;
CREATE POLICY media_collections_authenticated_read ON marketing.media_collections
  FOR SELECT TO authenticated USING (true);

-- marketing.media_keywords_free
DROP POLICY IF EXISTS media_keywords_free_authenticated ON marketing.media_keywords_free;
CREATE POLICY media_keywords_free_authenticated_read ON marketing.media_keywords_free
  FOR SELECT TO authenticated USING (true);

-- marketing.media_links
DROP POLICY IF EXISTS media_links_authenticated ON marketing.media_links;
CREATE POLICY media_links_authenticated_read ON marketing.media_links
  FOR SELECT TO authenticated USING (true);

-- marketing.media_renders
DROP POLICY IF EXISTS media_renders_authenticated ON marketing.media_renders;
CREATE POLICY media_renders_authenticated_read ON marketing.media_renders
  FOR SELECT TO authenticated USING (true);

-- marketing.media_tags
DROP POLICY IF EXISTS media_tags_authenticated ON marketing.media_tags;
CREATE POLICY media_tags_authenticated_read ON marketing.media_tags
  FOR SELECT TO authenticated USING (true);

-- marketing.media_taxonomy
DROP POLICY IF EXISTS media_taxonomy_authenticated ON marketing.media_taxonomy;
CREATE POLICY media_taxonomy_authenticated_read ON marketing.media_taxonomy
  FOR SELECT TO authenticated USING (true);

-- marketing.media_usage_log
DROP POLICY IF EXISTS media_usage_log_authenticated ON marketing.media_usage_log;
CREATE POLICY media_usage_log_authenticated_read ON marketing.media_usage_log
  FOR SELECT TO authenticated USING (true);

-- marketing.social_accounts
DROP POLICY IF EXISTS social_accounts_authenticated ON marketing.social_accounts;
CREATE POLICY social_accounts_authenticated_read ON marketing.social_accounts
  FOR SELECT TO authenticated USING (true);

-- public.operational_overrides
DROP POLICY IF EXISTS operational_overrides_authenticated ON public.operational_overrides;
CREATE POLICY operational_overrides_authenticated_read ON public.operational_overrides
  FOR SELECT TO authenticated USING (true);

-- ===========================================================
-- Revoke anon EXECUTE on poster_finding_drilldown
-- ===========================================================
REVOKE EXECUTE ON FUNCTION public.poster_finding_drilldown(text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.poster_finding_drilldown(text) TO authenticated;
