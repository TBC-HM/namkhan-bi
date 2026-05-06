-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504213336
-- Name:    retreat_compiler_rls_policies_pgrst_merge
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- 9.1 catalog.* — authenticated read
DROP POLICY IF EXISTS catalog_authenticated_select ON catalog.vendors;
CREATE POLICY catalog_authenticated_select ON catalog.vendors          FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS catalog_authenticated_select ON catalog.vendor_rate_cards;
CREATE POLICY catalog_authenticated_select ON catalog.vendor_rate_cards FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS catalog_authenticated_select ON catalog.activities;
CREATE POLICY catalog_authenticated_select ON catalog.activities       FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS catalog_authenticated_select ON catalog.spa_treatments;
CREATE POLICY catalog_authenticated_select ON catalog.spa_treatments   FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS catalog_authenticated_select ON catalog.fnb_items;
CREATE POLICY catalog_authenticated_select ON catalog.fnb_items        FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS catalog_authenticated_select ON catalog.fnb_menus;
CREATE POLICY catalog_authenticated_select ON catalog.fnb_menus        FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS catalog_authenticated_select ON catalog.transport_options;
CREATE POLICY catalog_authenticated_select ON catalog.transport_options FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS catalog_authenticated_select ON catalog.addons;
CREATE POLICY catalog_authenticated_select ON catalog.addons           FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS catalog_authenticated_select ON catalog.ceremonies;
CREATE POLICY catalog_authenticated_select ON catalog.ceremonies       FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS catalog_authenticated_select ON catalog.workshops;
CREATE POLICY catalog_authenticated_select ON catalog.workshops        FOR SELECT TO authenticated USING (true);

-- 9.2 pricing.*
DROP POLICY IF EXISTS pricing_authenticated_select ON pricing.pricelist;
CREATE POLICY pricing_authenticated_select ON pricing.pricelist        FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS pricing_authenticated_select ON pricing.seasons;
CREATE POLICY pricing_authenticated_select ON pricing.seasons          FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS pricing_authenticated_select ON pricing.fx_locks;
CREATE POLICY pricing_authenticated_select ON pricing.fx_locks         FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS pricing_authenticated_select ON pricing.margin_overrides;
CREATE POLICY pricing_authenticated_select ON pricing.margin_overrides FOR SELECT TO authenticated USING (true);

-- 9.3 compiler.*
DROP POLICY IF EXISTS compiler_authenticated_select_own ON compiler.runs;
CREATE POLICY compiler_authenticated_select_own ON compiler.runs       FOR SELECT TO authenticated
  USING (operator_id = auth.uid() OR auth.role() = 'service_role');
DROP POLICY IF EXISTS compiler_authenticated_select ON compiler.variants;
CREATE POLICY compiler_authenticated_select ON compiler.variants       FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS compiler_authenticated_select ON compiler.itinerary_templates;
CREATE POLICY compiler_authenticated_select ON compiler.itinerary_templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS compiler_authenticated_select ON compiler.deploys;
CREATE POLICY compiler_authenticated_select ON compiler.deploys        FOR SELECT TO authenticated USING (true);

-- 9.4 book.*
DROP POLICY IF EXISTS book_authenticated_select ON book.bookings;
CREATE POLICY book_authenticated_select ON book.bookings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS book_authenticated_select ON book.payments;
CREATE POLICY book_authenticated_select ON book.payments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS book_authenticated_select ON book.cancellations;
CREATE POLICY book_authenticated_select ON book.cancellations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS book_authenticated_select ON book.reconcile_alerts;
CREATE POLICY book_authenticated_select ON book.reconcile_alerts FOR SELECT TO authenticated USING (true);

-- 9.5 web.*
DROP POLICY IF EXISTS web_sites_anon_active ON web.sites;
CREATE POLICY web_sites_anon_active ON web.sites FOR SELECT TO anon USING (is_active = true);
DROP POLICY IF EXISTS web_sites_authenticated ON web.sites;
CREATE POLICY web_sites_authenticated ON web.sites FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS web_pages_anon_live ON web.pages;
CREATE POLICY web_pages_anon_live ON web.pages FOR SELECT TO anon USING (status = 'live');
DROP POLICY IF EXISTS web_pages_authenticated ON web.pages;
CREATE POLICY web_pages_authenticated ON web.pages FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS web_retreats_anon_published ON web.retreats;
CREATE POLICY web_retreats_anon_published ON web.retreats FOR SELECT TO anon USING (status IN ('published','sold_out'));
DROP POLICY IF EXISTS web_retreats_authenticated ON web.retreats;
CREATE POLICY web_retreats_authenticated ON web.retreats FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS web_posts_anon_live ON web.posts;
CREATE POLICY web_posts_anon_live ON web.posts FOR SELECT TO anon USING (status = 'live');
DROP POLICY IF EXISTS web_posts_authenticated ON web.posts;
CREATE POLICY web_posts_authenticated ON web.posts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS web_series_anon ON web.series;
CREATE POLICY web_series_anon ON web.series FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS web_series_authenticated ON web.series;
CREATE POLICY web_series_authenticated ON web.series FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS web_authenticated_campaigns ON web.campaigns;
CREATE POLICY web_authenticated_campaigns ON web.campaigns FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS web_authenticated_campaign_pages ON web.campaign_pages;
CREATE POLICY web_authenticated_campaign_pages ON web.campaign_pages FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS web_authenticated_ab_tests ON web.ab_tests;
CREATE POLICY web_authenticated_ab_tests ON web.ab_tests FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS web_authenticated_subscribers ON web.subscribers;
CREATE POLICY web_authenticated_subscribers ON web.subscribers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS web_authenticated_consents ON web.consents;
CREATE POLICY web_authenticated_consents ON web.consents FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS web_authenticated_email_sends ON web.email_sends;
CREATE POLICY web_authenticated_email_sends ON web.email_sends FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS web_authenticated_events ON web.events;
CREATE POLICY web_authenticated_events ON web.events FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS web_authenticated_pages_history ON web.pages_history;
CREATE POLICY web_authenticated_pages_history ON web.pages_history FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS web_authenticated_retreats_versions ON web.retreats_versions;
CREATE POLICY web_authenticated_retreats_versions ON web.retreats_versions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS web_authenticated_configurations ON web.configurations;
CREATE POLICY web_authenticated_configurations ON web.configurations FOR SELECT TO authenticated USING (true);

-- 9.6 content.*
DROP POLICY IF EXISTS content_anon_select ON content.series;
CREATE POLICY content_anon_select ON content.series FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS content_anon_select ON content.lunar_events;
CREATE POLICY content_anon_select ON content.lunar_events FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS content_anon_select ON content.usali_categories;
CREATE POLICY content_anon_select ON content.usali_categories FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS content_anon_select ON content.legal_pages;
CREATE POLICY content_anon_select ON content.legal_pages FOR SELECT TO anon, authenticated USING (true);

-- pgrst.db_schemas — MERGE (preserve existing) — patched per project rule
DO $blk$
DECLARE
  v_current text;
  v_existing text[];
  v_target text[] := ARRAY['catalog','pricing','compiler','book','web','content'];
  v_final text[];
BEGIN
  SELECT setting INTO v_current
  FROM (
    SELECT unnest(setconfig) AS setting
    FROM pg_db_role_setting drs
    JOIN pg_roles r ON r.oid = drs.setrole
    WHERE r.rolname = 'authenticator'
  ) t
  WHERE setting LIKE 'pgrst.db_schemas=%';

  IF v_current IS NULL THEN
    v_existing := ARRAY['public','graphql_public'];
  ELSE
    v_existing := string_to_array(
      regexp_replace(replace(v_current, 'pgrst.db_schemas=', ''), '\s+', '', 'g'),
      ','
    );
  END IF;

  v_final := v_existing;
  FOR i IN 1..array_length(v_target,1) LOOP
    IF NOT (v_target[i] = ANY(v_final)) THEN
      v_final := array_append(v_final, v_target[i]);
    END IF;
  END LOOP;

  EXECUTE format('ALTER ROLE authenticator SET pgrst.db_schemas TO %L', array_to_string(v_final, ', '));
  PERFORM pg_notify('pgrst', 'reload config');
  RAISE NOTICE 'pgrst.db_schemas MERGED to: %', array_to_string(v_final, ', ');
END $blk$;